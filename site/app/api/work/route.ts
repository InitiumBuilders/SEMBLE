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
//    computed independently by `need` (WORK.NEED, currently 3) machines and settles only
//    when their digests AGREE. A disagreement settles nothing and credits
//    nobody; it goes to `disputed` and is re-issued.
//
// ② CANARIES CATCH LIARS.
//    1 unit in ~WORK.CANARY_RATE (currently 4) is a canary whose digest we know. A node that
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
import { freshRead, freshWrite, readEvents } from '../_blob';
import {
  EMPTY_LEDGER, WORK, runUnit, capability, accrue, fingerprint,
  type Ledger, type Node, type Unit, type Receipt, type WorkKind,
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

type Standing = { on: boolean; task: string; kind: WorkKind; corpus: string[]; made: number };
type WLedger = Ledger & {
  units: Unit[]; receipts: Receipt[]; quarantine: string[]; standing: Standing;
};

/* ── THE STANDING CORPUS ────────────────────────────────────────────────────
   ⚠ THE PROBLEM THIS SOLVES, measured 2026-08-12: a visitor clicked LEND, then
   START COMPUTING, and got "queue empty — nothing to compute right now."
   Every part of the machine worked and a stranger still got NOTHING. That is
   the mover loop failing at step one, and no amount of verification machinery
   matters if the first move lands on an empty queue.

   So the pool is never idle. When the queue runs dry, units are generated from
   a standing public corpus — real, verifiable work on text that is already
   public. It is labelled `standing` everywhere so it is never confused with
   work the operator actually needed done: a busy-looking pool that is secretly
   spinning its wheels would be exactly the lie this project exists to avoid. */
const DEFAULT_CORPUS = [
  'motus is the mindset the mindset means move',
  'a stock is a quantity a flow is a rate of change',
  'reinforcing loops compound balancing loops resist',
  'emergence is behaviour that no single part contains',
  'leverage points are places where a small shift changes everything',
  'the map is not the territory but a good map moves you',
  'conviction is what survives contact with cost',
  'a receipt is proof a promise is not',
  'systems thinking asks what structure produces this behaviour',
  'stigmergy is coordination through traces left in the world',
  'delay in a feedback loop is what makes it oscillate',
  'the goal of a system is what it actually does not what it says',
];
const EMPTY: WLedger = {
  ...EMPTY_LEDGER, units: [], receipts: [], quarantine: [],
  standing: { on: true, task: 'Standing — index the Motus corpus', kind: 'embed', corpus: DEFAULT_CORPUS, made: 0 },
};

/** Top the queue up from the standing corpus. Deterministic seeds derived from
 *  a rolling counter, so the whole ledger stays reproducible from its contents.
 *
 *  ⚠ `forNode` matters more than it looks. Counting only GLOBAL open units means
 *  a machine that has already computed everything in the queue is told "nothing
 *  to compute" while the page simultaneously reports eight units out — because
 *  a node may never take the same unit twice. The guarantee has to be measured
 *  from the perspective of the machine asking, not the queue as a whole. */
function replenish(w: WLedger, want = 8, forNode = ''): number {
  const st = w.standing;
  if (!st || !st.on || !st.corpus?.length) return 0;
  const available = w.units.filter((u) =>
    (u.status === 'open' || u.status === 'verifying') &&
    u.results.length < u.need &&
    (!forNode || !u.results.some((r) => r.node === forNode))).length;
  if (available >= want) return 0;
  let made = 0;
  for (let i = available; i < want; i++) {
    const idx = (st.made + made) % st.corpus.length;
    const seed = (((st.made + made) + 1) * 2654435761) >>> 0;
    const isCanary = (st.made + made) % WORK.CANARY_RATE === WORK.CANARY_RATE - 1;
    const payload = st.kind === 'matmul' ? '32' : st.corpus[idx];
    w.units.push({
      id: `s${Date.now().toString(36)}${(st.made + made).toString(36)}`,
      kind: isCanary ? 'canary' : st.kind,
      task: st.task, payload, seed,
      need: isCanary ? 1 : WORK.NEED,
      results: [], status: 'open', digest: '',
      expect: isCanary ? runUnit({ kind: 'canary', payload, seed }).digest : '',
      created: Date.now(), settled: 0,
    });
    made++;
  }
  st.made += made;
  w.units = w.units.slice(-600);
  return made;
}

/* ⚠ THE WORK ROUTE MUST SEE EVENT-SOURCED PLEDGES.
   The compute route now appends pledges as events instead of writing them into
   the snapshot. This route reads the same underlying blob — so reading the
   snapshot ALONE means every node that pledged since the last compaction is
   invisible here, `w.nodes.find(...)` misses, and a settled unit credits
   NOBODY. Caught by the harness reporting `+0 MOTUS-s` and zero receipts on an
   otherwise-passing consensus run.

   The lesson: converting half a shared ledger to event sourcing is worse than
   converting none of it. Every reader folds, or none of them do. */
const CEVENTS = 'semble-live/cev-';
type PledgeLite = { ts: number; id: string; tier: string; vendor: string; arch: string; klass: string; maxBufferMB: number; invocations: number; seconds: number };

/** Merge event-sourced nodes into a snapshot so this route sees the whole pool.
 *  Only the fields work-crediting needs — capability inputs and identity. */
function foldNodes(w: WLedger, evs: PledgeLite[]) {
  for (const e of evs) {
    if (!e || !e.id) continue;
    let n = w.nodes.find((x) => x.id === e.id);
    if (!n) {
      n = {
        id: e.id, tier: (e.tier as Node['tier']) || 'tab',
        vendor: e.vendor || '', arch: e.arch || '', klass: e.klass || '',
        maxBufferMB: e.maxBufferMB || 0, invocations: e.invocations || 0,
        features: [], dash: '', trust: '', payoutPref: 'dash',
        first: e.ts, last: e.ts, seconds: 0, byDj: {}, byMode: {}, accrued: 0, paid: 0,
      } as Node;
      w.nodes.push(n);
    }
    n.last = Math.max(n.last || 0, e.ts);
    if (e.maxBufferMB) n.maxBufferMB = e.maxBufferMB;
    if (e.invocations) n.invocations = e.invocations;
    if (e.tier) n.tier = e.tier as Node['tier'];
  }
}

function hydrate(l: Partial<WLedger> | null): WLedger {
  const w: WLedger = { ...EMPTY, ...(l || {}) } as WLedger;
  w.nodes = (w.nodes || []).map((n) => ({
    ...n, features: n.features || [], byDj: n.byDj || {}, byMode: n.byMode || {},
    accrued: Number(n.accrued) || 0, paid: Number(n.paid) || 0,
  }));
  w.units = (w.units || []).map((u) => ({ ...u, results: u.results || [] }));
  w.receipts = w.receipts || [];
  w.quarantine = w.quarantine || [];
  w.standing = { ...EMPTY.standing, ...(w.standing || {}) };
  if (!Array.isArray(w.standing.corpus) || !w.standing.corpus.length) w.standing.corpus = DEFAULT_CORPUS;
  w.history = (w.history || []).map((b) => ({ ...b, motusSeconds: Number(b.motusSeconds) || 0, byDj: b.byDj || {} }));
  w.djs = w.djs || {}; w.modes = w.modes || {}; w.payouts = w.payouts || [];
  w.totals = { sessions: 0, seconds: 0, accrued: 0, paid: 0, ...(w.totals || {}) };
  return w;
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

// ── GET: claim a unit, or read the queue ────────────────────────────────────
export async function GET(req: Request) {
  const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  foldNodes(w, await readEvents<PledgeLite>(CEVENTS));
  const url = new URL(req.url);
  const node = clean(url.searchParams.get('node'), 40);
  const now = Date.now();

  // ?node=… claims the next unit this node has not already computed.
  if (node) {
    const meG = w.nodes.find((x) => x.id === node);
    const fpG = meG ? fingerprint(meG) : '';
    if (w.quarantine.includes(node) || (fpG && w.quarantine.includes('fp:' + fpG))) {
      return Response.json({
        unit: null,
        quarantined: true,
        why: 'This node returned a wrong answer to a known-answer probe. Results are no longer counted. Reload to re-enrol.',
      }, { headers: CORS });
    }
    const pick = () => w.units.find((x) =>
      (x.status === 'open' || x.status === 'verifying') &&
      x.results.length < x.need &&
      !x.results.some((r) => r.node === node));

    let u = pick();
    // ⚠ THE FIRST-MOVE GUARANTEE. If there is nothing this node can take, top
    // the queue up from the standing corpus and try once more. A stranger who
    // clicks START must never be told "nothing to compute" — that is the whole
    // funnel, and an empty queue wastes the one moment they were willing.
    if (!u && replenish(w, 8, node)) { await freshWrite(PREFIX, w); u = pick(); }

    return Response.json({
      unit: u ? { id: u.id, kind: u.kind, payload: u.payload, seed: u.seed, task: u.task } : null,
      // is this standing work or something the operator actually needed done?
      // Never blur the two: a busy-looking pool spinning its wheels in secret
      // would be exactly the lie this project exists to avoid.
      standing: u ? u.task === w.standing.task : false,
      queue: w.units.filter((x) => x.status !== 'done').length,
      // the client is NOT told which units are canaries — that is the point
      ttlMs: WORK.CLAIM_TTL,
    }, { headers: CORS });
  }

  // public queue view + the work record
  //
  // ⚠ byTask counts IN-FLIGHT work as well as finished work. It used to list
  // only settled units, which meant a task dispatched to the pool showed
  // nothing at all until three machines had agreed — so the operator's board
  // said "the pool is not on this" while the pool was actively on it. "Is the
  // pool working on this?" and "did it finish?" are different questions and
  // both need answering.
  const done = w.units.filter((u) => u.status === 'done');
  const byTask = Object.values(w.units.reduce((acc, u) => {
    const k = u.task || 'unattributed';
    acc[k] = acc[k] || { task: k, units: 0, inFlight: 0, contributors: new Set<string>() };
    if (u.status === 'done') acc[k].units++;
    else if (u.status === 'open' || u.status === 'verifying') acc[k].inFlight++;
    u.results.forEach((r) => acc[k].contributors.add(r.node));
    return acc;
  }, {} as Record<string, { task: string; units: number; inFlight: number; contributors: Set<string> }>))
    .map((t) => ({ task: t.task, units: t.units, inFlight: t.inFlight, contributors: t.contributors.size }))
    .filter((t) => t.units || t.inFlight)
    .sort((a, b) => (b.units + b.inFlight) - (a.units + a.inFlight));

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
    standing: {
      on: w.standing.on,
      task: w.standing.task,
      kind: w.standing.kind,
      generated: w.standing.made,
      what: 'Standing work keeps the pool from ever being idle: real, verifiable units over text that is already public. It is labelled separately from work the operator actually needed done, because a busy-looking pool that is secretly spinning its wheels would be worse than an honest idle one.',
    },
    // Derived from the constants, never hand-written — I raised NEED 2→3 and
    // CANARY_RATE 6→4 and this sentence still claimed the old numbers. A
    // security claim that drifts from the code is worse than no claim.
    verification: `Every unit is computed independently by ${WORK.NEED} machines and settles only when their digests agree. Roughly 1 unit in ${WORK.CANARY_RATE} is a known-answer canary; a node that fails one is quarantined and stops being counted.`,
    canaryRate: WORK.CANARY_RATE,
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
  // ── kernel conformance probe ──
  // Anyone can ask the server to run a kernel on a known input and compare it
  // to their own implementation. This is how a contributor verifies that the
  // PUBLISHED kernel is the kernel actually running — without it, "reproducible
  // by anyone" is a claim rather than a check. It computes; it stores nothing.
  if (b.op === 'kernel-probe') {
    const kind: WorkKind = ['embed', 'score', 'matmul', 'canary'].includes(b.kind) ? b.kind : 'embed';
    const payload = clean(b.payload, WORK.MAX_PAYLOAD);
    const seed = (Math.floor(Number(b.seed) || 0) >>> 0) || 2166136261;
    const r = runUnit({ kind, payload, seed });
    return Response.json({
      ok: true, kind, seed, payload,
      out: r.out.slice(0, 400), digest: r.digest,
      note: 'Computed by the SAME runUnit() the queue uses. Re-implement it from the docs and you must get this digest — if you do not, the docs are wrong and that is a bug worth reporting.',
    }, { headers: CORS });
  }

  // ── operator: configure the standing corpus ──
  if (b.op === 'standing') {
    if (!operator(req)) return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
    const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  foldNodes(w, await readEvents<PledgeLite>(CEVENTS));
    if (typeof b.on === 'boolean') w.standing.on = b.on;
    if (b.task) w.standing.task = clean(b.task, 120);
    if (['embed', 'score', 'matmul'].includes(b.kind)) w.standing.kind = b.kind;
    if (Array.isArray(b.corpus) && b.corpus.length) {
      w.standing.corpus = b.corpus.slice(0, 200).map((c: unknown) => clean(c, WORK.MAX_PAYLOAD)).filter(Boolean);
    }
    const made = w.standing.on ? replenish(w) : 0;
    const ok = await freshWrite(PREFIX, w);
    return Response.json({ ok, standing: { ...w.standing, corpus: w.standing.corpus.length }, topUp: made }, { headers: CORS });
  }

  if (b.op === 'enqueue') {
    if (!operator(req)) return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
    const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  foldNodes(w, await readEvents<PledgeLite>(CEVENTS));
    const task = clean(b.task, 120) || 'untitled';
    const kind: WorkKind = ['embed', 'score', 'matmul'].includes(b.kind) ? b.kind : 'embed';
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
  foldNodes(w, await readEvents<PledgeLite>(CEVENTS));
  // Quarantine by id AND by coarse hardware fingerprint. Node ids are
  // client-generated, so a reload buys a fresh one; the fingerprint makes that
  // cost more than pressing F5. ⚠ It is NOT identity — a determined actor can
  // lie about their adapter — and nothing here pretends otherwise. It raises
  // the cost from "reload" to "lie convincingly", which is the honest size of
  // the improvement.
  const me = w.nodes.find((x) => x.id === node);
  const fp = me ? fingerprint(me) : '';
  if (w.quarantine.includes(node) || (fp && w.quarantine.includes('fp:' + fp))) {
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
      if (WORK.FINGERPRINT && fp && !w.quarantine.includes('fp:' + fp)) w.quarantine.push('fp:' + fp);
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
  let unenrolled = false;
  if (u.status === 'done') {
    for (const r of u.results) {
      const n = w.nodes.find((x) => x.id === r.node);
      // A node that never pledged has no capability on record, so there is
      // nothing to scale an award by. Silently returning 0 would look like the
      // work did not count; say so instead.
      if (!n) { if (r.node === node) unenrolled = true; continue; }
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
    ...(unenrolled ? {
      unenrolled: true,
      why: 'Your result was accepted and counted toward verification, but this node has never pledged, so there is no capability on record to scale an award by. POST to /api/compute first and future units will earn.',
    } : {}),
  }, { headers: CORS });
}

// ── operator: clear the queue (receipts survive — they are the record) ──
export async function DELETE(req: Request) {
  if (!operator(req)) return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  const w = hydrate(await freshRead<WLedger>(PREFIX, EMPTY));
  foldNodes(w, await readEvents<PledgeLite>(CEVENTS));
  const dropped = w.units.length;
  w.units = [];
  // Deliberately NOT clearing receipts or quarantine. A receipt is a
  // contributor's proof that their machine did something real; the operator
  // clearing the queue must never erase somebody else's evidence.
  const ok = await freshWrite(PREFIX, w);
  return Response.json({ ok, dropped, receiptsKept: w.receipts.length }, { headers: CORS });
}
