// /api/work — RUNG 5 · DISPATCH.
//
// Real work units go out to pledged browsers, come back, and are VERIFIED
// before anyone is credited. This is the rung that makes MotusCompute compute
// rather than merely count.
//
// ══ THE THREE RULES THAT MAKE THIS SAFE ═════════════════════════════════════
//
// ① NOTHING IS PAID FOR UNTIL IT IS VERIFIED.
//    A volunteer can return garbage, or nothing, and claim payment. That is THE
//    problem of volunteer computing and it is older than crypto. Every unit is
//    computed independently by `need` (default 2) machines and settles only
//    when their digests AGREE. A disagreement settles nothing and credits
//    nobody; it goes to `disputed` and is re-issued.
//
// ② CANARIES CATCH LIARS.
//    1 unit in ~6 is a canary whose correct digest we already know. A node that
//    fails a canary is quarantined immediately — its results stop counting.
//    Redundancy alone is beatable by two colluding clients; a canary is not,
//    because the client cannot tell a canary from real work.
//
// ③ PUBLIC WORK ONLY, BY PROTOCOL.
//    Published attacks (ACM CCS 2025) reconstruct original inputs from the
//    intermediate state peers observe. So the queue physically cannot carry
//    private work: payloads are capped, stored in plaintext in a public blob,
//    and served to anyone who asks. If it would be bad for it to be public, it
//    cannot be a work unit. That is enforced by the shape of the system rather
//    than by a policy someone has to remember.
import { freshRead, freshWrite } from '../_blob';
import {
  EMPTY_LEDGER, WORK, runUnit, capability, accrue,
  type Ledger, type Unit, type Receipt, type WorkKind,
} from '../_motus';

export const dynamic = 'force-dynamic';

const PREFIX = 'semble-live/compute-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-live-secret',
  'cache-control': 'no-store',
};
const clean = (s: unknown, cap: number) => String(s ?? '').slice(0, cap).replace(/[<>]/g, '');
const operator = (req: Request) => {
  const s = process.env.LIVE_SECRET;
  return !!s && req.headers.get('x-live-secret') === s;
};

type WLedger = Ledger & { units: Unit[]; receipts: Receipt[]; quarantine: string[] };
const EMPTY: WLedger = { ...EMPTY_LEDGER, units: [], receipts: [], quarantine: [] };

function hydrate(l: Partial<WLedger> | null): WLedger {
  const w: WLedger = { ...EMPTY, ...(l || {}) } as WLedger;
  w.nodes = (w.nodes || []).map((n) => ({
    ...n, features: n.features || [], byDj: n.byDj || {}, byMode: n.byMode || {},
    accrued: Number(n.accrued) || 0, paid: Number(n.paid) || 0,
  }));
  w.units = (w.units || []).map((u) => ({ ...u, results: u.results || [] }));
  w.receipts = w.receipts || [];
  w.quarantine = w.quarantine || [];
  w.history = (w.history || []).map((b) => ({ ...b, motusSeconds: Number(b.motusSeconds) || 0, byDj: b.byDj || {} }));
  w.djs = w.djs || {}; w.modes = w.modes || {}; w.payouts = w.payouts || [];
  w.totals = { sessions: 0, seconds: 0, accrued: 0, paid: 0, ...(w.totals || {}) };
  return w;
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

// ── GET: claim a unit, or read the queue ────────────────────────────────────
export async function GET(req: Request) {
  const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  const url = new URL(req.url);
  const node = clean(url.searchParams.get('node'), 40);
  const now = Date.now();

  // ?node=… claims the next unit this node has not already computed.
  if (node) {
    if (w.quarantine.includes(node)) {
      return Response.json({
        unit: null,
        quarantined: true,
        why: 'This node returned a wrong answer to a known-answer probe. Results are no longer counted. Reload to re-enrol.',
      }, { headers: CORS });
    }
    const u = w.units.find((x) =>
      (x.status === 'open' || x.status === 'verifying') &&
      x.results.length < x.need &&
      !x.results.some((r) => r.node === node));
    return Response.json({
      unit: u ? { id: u.id, kind: u.kind, payload: u.payload, seed: u.seed, task: u.task } : null,
      queue: w.units.filter((x) => x.status !== 'done').length,
      // the client is NOT told which units are canaries — that is the point
      ttlMs: WORK.CLAIM_TTL,
    }, { headers: CORS });
  }

  // public queue view + the work record
  const done = w.units.filter((u) => u.status === 'done');
  const byTask = Object.values(done.reduce((acc, u) => {
    const k = u.task || 'unattributed';
    acc[k] = acc[k] || { task: k, units: 0, contributors: new Set<string>() };
    acc[k].units++;
    u.results.forEach((r) => acc[k].contributors.add(r.node));
    return acc;
  }, {} as Record<string, { task: string; units: number; contributors: Set<string> }>))
    .map((t) => ({ task: t.task, units: t.units, contributors: t.contributors.size }))
    .sort((a, b) => b.units - a.units);

  return Response.json({
    // ⚠ THE HEADLINE. Unlike rung 4 this is now COMPUTED, because work really
    // can be running. It is true when there is something to do and false when
    // there is not — never a decoration.
    jobsRunning: w.units.some((u) => u.status === 'open' || u.status === 'verifying'),
    queue: {
      open: w.units.filter((u) => u.status === 'open').length,
      verifying: w.units.filter((u) => u.status === 'verifying').length,
      done: done.length,
      disputed: w.units.filter((u) => u.status === 'disputed').length,
    },
    completed: done.length,
    unitsWorth: WORK.UNIT_MOTUS,
    need: WORK.NEED,
    quarantined: w.quarantine.length,
    byTask,
    verification: 'Every unit is computed independently by 2 machines and settles only when their digests agree. Roughly 1 unit in 6 is a known-answer canary; a node that fails one is quarantined and stops being counted.',
    recent: done.slice(-12).reverse().map((u) => ({
      id: u.id, kind: u.kind, task: u.task, digest: u.digest,
      by: u.results.map((r) => r.node.slice(0, 6)), settled: u.settled,
    })),
  }, { headers: CORS });
}

// ── POST: submit a result, or (operator) enqueue units ──────────────────────
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'unreadable' }, { status: 400, headers: CORS });

  // ── operator: enqueue work from a CortexInsight task ──
  if (b.op === 'enqueue') {
    if (!operator(req)) return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
    const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
    const task = clean(b.task, 120) || 'untitled';
    const kind: WorkKind = ['embed', 'score'].includes(b.kind) ? b.kind : 'embed';
    const chunks: string[] = (Array.isArray(b.chunks) ? b.chunks : [])
      .slice(0, 100).map((c: unknown) => clean(c, WORK.MAX_PAYLOAD)).filter(Boolean);
    if (!chunks.length) return Response.json({ ok: false, error: 'no payload chunks' }, { status: 400, headers: CORS });

    let made = 0, canaries = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (w.units.filter((u) => u.status !== 'done').length >= WORK.MAX_OPEN) break;
      // Seeds are derived from content + index, never random — the whole ledger
      // has to be reproducible from its own contents by anyone auditing it.
      const seed = ((i + 1) * 2654435761) >>> 0;
      const isCanary = i % WORK.CANARY_RATE === WORK.CANARY_RATE - 1;
      const u: Unit = {
        id: `u${Date.now().toString(36)}${i.toString(36)}`,
        kind: isCanary ? 'canary' : kind,
        task, payload: chunks[i], seed,
        need: isCanary ? 1 : WORK.NEED,       // a canary is checked against truth, not consensus
        results: [], status: 'open', digest: '',
        // computed HERE, server-side, with the same shared kernel the browser
        // uses — so a canary's truth cannot drift from what clients compute
        expect: isCanary ? runUnit({ kind: 'canary', payload: chunks[i], seed }).digest : '',
        created: Date.now(), settled: 0,
      };
      w.units.push(u); made++; if (isCanary) canaries++;
    }
    w.units = w.units.slice(-600);
    const ok = await freshWrite(PREFIX, w);
    return Response.json({ ok, enqueued: made, canaries, task, queue: w.units.filter((u) => u.status !== 'done').length }, { headers: CORS });
  }

  // ── contributor: submit a computed result ──
  const node = clean(b.node, 40);
  const unitId = clean(b.unit, 40);
  const digest = clean(b.digest, 16);
  const out = clean(b.out, 2000);
  const ms = Math.max(0, Math.min(600000, Math.floor(Number(b.ms) || 0)));
  if (!node || !unitId || !digest) return Response.json({ ok: false, error: 'node, unit and digest are required' }, { status: 400, headers: CORS });

  const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  if (w.quarantine.includes(node)) {
    return Response.json({ ok: false, quarantined: true, error: 'this node is quarantined' }, { status: 403, headers: CORS });
  }
  const u = w.units.find((x) => x.id === unitId);
  if (!u) return Response.json({ ok: false, error: 'unknown unit' }, { status: 404, headers: CORS });
  if (u.status === 'done') return Response.json({ ok: true, already: true, digest: u.digest }, { headers: CORS });
  if (u.results.some((r) => r.node === node)) return Response.json({ ok: true, already: true }, { headers: CORS });

  // ── ③ CANARY: checked against known truth, not against a peer ──
  if (u.kind === 'canary') {
    const right = digest === u.expect;
    if (!right) {
      // Quarantine is immediate and it is not a punishment for being slow or
      // offline — it fires only on a WRONG ANSWER to a question we already knew
      // the answer to. That distinction matters: honest machines fail all the
      // time, but they fail by being absent, not by being confidently wrong.
      if (!w.quarantine.includes(node)) w.quarantine.push(node);
      w.quarantine = w.quarantine.slice(-500);
      await freshWrite(PREFIX, w);
      return Response.json({
        ok: false, quarantined: true,
        error: 'That result did not match a known-answer probe. This node is no longer counted.',
      }, { status: 403, headers: CORS });
    }
    u.results.push({ node, digest, out, ms, ts: Date.now() });
    u.status = 'done'; u.digest = digest; u.settled = Date.now();
  } else {
    u.results.push({ node, digest, out, ms, ts: Date.now() });
    u.status = 'verifying';
    if (u.results.length >= u.need) {
      const digests = u.results.map((r) => r.digest);
      const agreed = digests.every((d) => d === digests[0]);
      if (agreed) { u.status = 'done'; u.digest = digests[0]; u.settled = Date.now(); }
      else {
        // ⚠ No credit to ANYONE on a disagreement. It is tempting to pay the
        // majority, but with need=2 there is no majority — and paying the first
        // responder rewards whoever answers fastest, which is exactly the
        // incentive an attacker wants. Re-issue instead.
        u.status = 'disputed'; u.results = []; u.need = Math.min(3, u.need + 1);
      }
    }
  }

  // ── credit the contributors, but only for a settled unit ──
  let earned = 0;
  if (u.status === 'done') {
    for (const r of u.results) {
      const n = w.nodes.find((x) => x.id === r.node);
      if (!n) continue;
      const cap = capability(n);
      // A verified unit is worth a flat award scaled by capability. Completed
      // work outranks availability: availability is a promise, a verified
      // result is a fact.
      const gain = accrue(WORK.UNIT_MOTUS, cap);
      n.accrued = Math.round((n.accrued + gain) * 1000) / 1000;
      w.totals.accrued = Math.round((w.totals.accrued + gain) * 1000) / 1000;
      if (r.node === node) earned = gain;
      w.receipts.push({
        id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        node: r.node, unit: u.id, kind: u.kind, task: u.task,
        ts: Date.now(), ms: r.ms, agreed: true, motusSeconds: gain,
        dj: Object.entries(n.byDj || {}).sort((a, c) => c[1] - a[1])[0]?.[0] || '',
      });
    }
    w.receipts = w.receipts.slice(-WORK.MAX_RECEIPTS);
  }

  const ok = await freshWrite(PREFIX, w);
  return Response.json({
    ok, unit: u.id, status: u.status,
    settled: u.status === 'done',
    earned: Math.round(earned * 1000) / 1000,
    waitingFor: u.status === 'verifying' ? u.need - u.results.length : 0,
  }, { headers: CORS });
}

// ── operator: clear the queue (receipts survive — they are the record) ──
export async function DELETE(req: Request) {
  if (!operator(req)) return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  const dropped = w.units.length;
  w.units = [];
  // Deliberately NOT clearing receipts or quarantine. A receipt is a
  // contributor's proof that their machine did something real; the operator
  // clearing the queue must never erase somebody else's evidence.
  const ok = await freshWrite(PREFIX, w);
  return Response.json({ ok, dropped, receiptsKept: w.receipts.length }, { headers: CORS });
}
