// /api/payouts — THE PAYOUT ENGINE.
//
// ══ THE ONE ARCHITECTURAL RULE ══════════════════════════════════════════════
// THIS SERVICE NEVER HOLDS A PRIVATE KEY. It cannot sign, and it cannot move
// money. It PLANS (who is owed what), ARMS (freezes an idempotent batch), and
// AUDITS (records the txid the operator reports back). The signature happens on
// the operator's own node, from a capped hot wallet, against a batch spec this
// service produced. A web service on shared infrastructure holding spend
// authority is the failure mode that ends projects; there is no version of this
// where that is worth the convenience.
//
// The flow, end to end:
//   1. plan    → dry run. Who clears the floor, what the batch would cost.
//   2. arm     → freeze amounts into an immutable batch + emit a `sendmany`.
//   3. (operator's node signs and broadcasts — outside this service)
//   4. settle  → operator reports the txid; nodes are marked paid. Idempotent.
//   5. fail    → release the batch; nothing is marked paid.
//
// Steps 2/4/5 require the operator secret. Step 1 requires it too — knowing the
// exact balance owed to each address is operational detail, not public data.
// The RESULT of every batch is public: /api/payouts GET is the audit log.
import { freshRead, freshWrite } from '../_blob';
import {
  MOTUS, EMPTY_LEDGER, owedDash, settleable, shortAddr, MAX_PAYOUTS,
  type Ledger, type Node, type Payout,
} from '../_motus';

export const dynamic = 'force-dynamic';

const PREFIX = 'semble-live/compute-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-live-secret',
  'cache-control': 'no-store',
};

const operator = (req: Request) => {
  const s = process.env.LIVE_SECRET;
  return !!s && req.headers.get('x-live-secret') === s;    // unset ⇒ fail CLOSED
};

function hydrate(l: Partial<Ledger> | null): Ledger {
  const led: Ledger = { ...EMPTY_LEDGER, ...(l || {}) } as Ledger;
  led.nodes = (led.nodes || []).map((n) => ({
    ...n, accrued: Number(n.accrued) || 0, paid: Number(n.paid) || 0,
    byDj: n.byDj || {}, byMode: n.byMode || {}, features: n.features || [],
  }));
  led.payouts = led.payouts || [];
  led.totals = { sessions: 0, seconds: 0, accrued: 0, paid: 0, ...(led.totals || {}) };
  return led;
}

/** Who is owed, and does it clear the off-ramp floor? Pure — no state change. */
function plan(led: Ledger, rail: 'dash' | 'trust', rate: number, dashUsd: number) {
  const addrOf = (n: Node) => (rail === 'dash' ? n.dash : n.trust);
  const eligible = led.nodes
    .map((n) => ({ n, open: Math.round((n.accrued - n.paid) * 1000) / 1000 }))
    .filter((x) => x.open > 0 && addrOf(x.n));

  // Aggregate by ADDRESS, not by node — one contributor may lend several
  // machines, and paying each separately burns the floor for no reason.
  const byAddr = new Map<string, { motusSeconds: number; nodes: string[]; djs: Record<string, number> }>();
  for (const { n, open } of eligible) {
    const a = addrOf(n);
    const e = byAddr.get(a) || { motusSeconds: 0, nodes: [], djs: {} };
    e.motusSeconds += open;
    e.nodes.push(n.id);
    for (const [dj, s] of Object.entries(n.byDj || {})) e.djs[dj] = (e.djs[dj] || 0) + s;
    byAddr.set(a, e);
  }

  const rows = [...byAddr.entries()].map(([address, e]) => {
    const amount = owedDash(e.motusSeconds, rate);
    return {
      address, short: shortAddr(address),
      motusSeconds: Math.round(e.motusSeconds * 1000) / 1000,
      amount, usd: Math.round(amount * dashUsd * 100) / 100,
      nodes: e.nodes.length,
      topDj: Object.entries(e.djs).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      clears: rail === 'trust' ? true : settleable(e.motusSeconds, dashUsd, rate),
    };
  }).sort((a, b) => b.amount - a.amount);

  const paying = rows.filter((r) => r.clears);
  const held = rows.filter((r) => !r.clears);
  return {
    rail, rate, dashUsd,
    recipients: paying.length,
    total: Math.round(paying.reduce((a, r) => a + r.amount, 0) * 1e8) / 1e8,
    totalUsd: Math.round(paying.reduce((a, r) => a + r.usd, 0) * 100) / 100,
    motusSeconds: Math.round(paying.reduce((a, r) => a + r.motusSeconds, 0) * 1000) / 1000,
    paying, held,
    heldReason: `below the $${MOTUS.MIN_SETTLE_USD} off-ramp floor — accrues until it clears, never expires`,
    // Batched sendmany: 1-in/N-out costs ~$0.0000108 per recipient on Dash.
    // Emitting the exact RPC keeps the operator's step mechanical, not creative.
    sendmany: rail === 'dash'
      ? Object.fromEntries(paying.map((r) => [r.address, r.amount]))
      : null,
  };
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

/** Public audit log. Every batch, every DJ, every mode, every rail. */
export async function GET(req: Request) {
  const led = hydrate(await freshRead<Ledger>(PREFIX, EMPTY_LEDGER));
  const url = new URL(req.url);
  const railQ = url.searchParams.get('rail');
  const djQ = url.searchParams.get('dj');

  let rows = led.payouts.slice().sort((a, b) => b.ts - a.ts);
  if (railQ) rows = rows.filter((p) => p.rail === railQ);
  if (djQ) rows = rows.filter((p) => p.dj === djQ);

  const sent = led.payouts.filter((p) => p.status === 'sent');
  const open = Math.round((led.totals.accrued - led.totals.paid) * 1000) / 1000;

  return Response.json({
    // no key ever reaches this service — say it in the payload, not just the docs
    custody: 'This service never holds a private key. It plans, arms and audits; the operator\'s own node signs.',
    moneyMoved: sent.length > 0,

    summary: {
      batches: led.payouts.length,
      sent: sent.length,
      dryRuns: led.payouts.filter((p) => p.status === 'dry-run').length,
      armed: led.payouts.filter((p) => p.status === 'armed').length,
      failed: led.payouts.filter((p) => p.status === 'failed').length,
      dashSent: Math.round(sent.filter((p) => p.rail === 'dash').reduce((a, p) => a + p.amount, 0) * 1e8) / 1e8,
      trustAttestations: sent.filter((p) => p.rail === 'trust').length,
      recipientsPaid: sent.reduce((a, p) => a + p.recipients, 0),
      motusSecondsSettled: Math.round(led.totals.paid * 1000) / 1000,
      motusSecondsOpen: open,
      openOwedDash: owedDash(open),
      openOwedUsd: Math.round(owedDash(open) * MOTUS.DASH_USD * 100) / 100,
    },

    // per-DJ payout record — which sets actually earned their contributors money
    byDj: Object.entries(
      led.payouts.filter((p) => p.status === 'sent').reduce((acc, p) => {
        const k = p.dj || 'unknown';
        acc[k] = acc[k] || { dj: k, batches: 0, amount: 0, recipients: 0, motusSeconds: 0 };
        acc[k].batches++; acc[k].amount += p.amount; acc[k].recipients += p.recipients;
        acc[k].motusSeconds += p.motusSeconds;
        return acc;
      }, {} as Record<string, { dj: string; batches: number; amount: number; recipients: number; motusSeconds: number }>),
    ).map(([, v]) => ({ ...v, amount: Math.round(v.amount * 1e8) / 1e8 }))
      .sort((a, b) => b.amount - a.amount),

    byRail: (['dash', 'trust'] as const).map((r) => ({
      rail: r,
      batches: led.payouts.filter((p) => p.rail === r).length,
      sent: sent.filter((p) => p.rail === r).length,
      amount: Math.round(sent.filter((p) => p.rail === r).reduce((a, p) => a + p.amount, 0) * 1e8) / 1e8,
      note: r === 'trust'
        ? 'TRUST is the RECEIPT, never the reward. Contributors cannot earn $TRUST for off-chain work — emissions go to veTRUST bonders. Amount is always 0 by design.'
        : 'DASH is the reward rail: ~2s InstantSend, median fee $0.000069.',
    })),

    // the log itself — public, addresses truncated
    log: rows.slice(0, 200).map((p) => ({
      id: p.id, batchId: p.batchId, ts: p.ts, rail: p.rail, status: p.status,
      recipients: p.recipients, amount: p.amount,
      motusSeconds: Math.round(p.motusSeconds * 1000) / 1000,
      rate: p.rate, dashUsd: p.dashUsd, dj: p.dj, mode: p.mode,
      txid: p.txid, note: p.note,
    })),
  }, { headers: CORS });
}

export async function POST(req: Request) {
  if (!operator(req)) {
    return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  }
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'unreadable' }, { status: 400, headers: CORS });

  const op = String(b.op || 'plan');
  const rail: 'dash' | 'trust' = b.rail === 'trust' ? 'trust' : 'dash';
  const rate = Number(b.rate) > 0 ? Number(b.rate) : MOTUS.DASH_PER_MOTUS_SECOND;
  const dashUsd = Number(b.dashUsd) > 0 ? Number(b.dashUsd) : MOTUS.DASH_USD;
  const dj = String(b.dj || 'all').slice(0, 24);
  const mode = String(b.mode || 'all').slice(0, 16);

  const led = hydrate(await freshRead<Ledger>(PREFIX, EMPTY_LEDGER));

  // ── 1 · PLAN — pure dry run, no state change, nothing armed ──────────────
  if (op === 'plan') {
    const p = plan(led, rail, rate, dashUsd);
    return Response.json({ ok: true, op: 'plan', dryRun: true, ...p }, { headers: CORS });
  }

  // ── 2 · ARM — freeze an immutable batch and emit the sendmany spec ───────
  if (op === 'arm') {
    const p = plan(led, rail, rate, dashUsd);
    if (!p.recipients) {
      return Response.json({
        ok: false, op: 'arm', error: 'nothing clears the floor yet',
        held: p.held.length, heldReason: p.heldReason,
      }, { status: 409, headers: CORS });
    }
    const batchId = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const rec: Payout = {
      id: batchId, batchId, ts: Date.now(), rail, status: 'armed',
      recipients: p.recipients, motusSeconds: p.motusSeconds,
      amount: rail === 'dash' ? p.total : 0,
      rate, dashUsd, dj, mode, txid: '',
      note: rail === 'trust'
        ? 'attestation batch — receipt only, no value transferred'
        : `armed for ${p.recipients} recipient(s)`,
    };
    led.payouts.push(rec);
    led.payouts = led.payouts.slice(-MAX_PAYOUTS);
    const ok = await freshWrite(PREFIX, led);
    return Response.json({
      ok, op: 'arm', batchId, ...p,
      next: rail === 'dash'
        ? 'Sign this sendmany on YOUR node, then POST {op:"settle", batchId, txid}. This service cannot sign it.'
        : 'Write the attestations from YOUR signer, then POST {op:"settle", batchId, txid}.',
    }, { headers: CORS });
  }

  // ── 4 · SETTLE — operator reports the txid; mark paid. IDEMPOTENT. ───────
  if (op === 'settle') {
    const batchId = String(b.batchId || '');
    const txid = String(b.txid || '').slice(0, 128).replace(/[^A-Za-z0-9x]/g, '');
    const rec = led.payouts.find((p) => p.batchId === batchId);
    if (!rec) return Response.json({ ok: false, error: 'unknown batch' }, { status: 404, headers: CORS });

    // Replaying a settle must never double-credit. This is the single most
    // important line in the file: a retried webhook is normal, and a payout
    // system that double-pays on retry is a payout system that drains.
    if (rec.status === 'sent') {
      return Response.json({ ok: true, op: 'settle', already: true, batchId, txid: rec.txid }, { headers: CORS });
    }
    if (rec.status !== 'armed') {
      return Response.json({ ok: false, error: `batch is ${rec.status}, not armed` }, { status: 409, headers: CORS });
    }

    // Mark the contributing nodes paid, up to what the batch actually covered.
    const p = plan(led, rec.rail, rec.rate, rec.dashUsd);
    const payingAddrs = new Set(p.paying.map((r) => r.address));
    let settled = 0;
    for (const n of led.nodes) {
      const a = rec.rail === 'dash' ? n.dash : n.trust;
      if (a && payingAddrs.has(a)) {
        const open = n.accrued - n.paid;
        if (open > 0) { n.paid = n.accrued; settled += open; }
      }
    }
    led.totals.paid = Math.round((led.totals.paid + settled) * 1000) / 1000;
    rec.status = 'sent'; rec.txid = txid;
    rec.note = rec.rail === 'trust'
      ? `attested — ${rec.recipients} receipt(s), no value transferred`
      : `sent — ${rec.recipients} recipient(s)`;

    const ok = await freshWrite(PREFIX, led);
    return Response.json({ ok, op: 'settle', batchId, txid, motusSecondsSettled: Math.round(settled * 1000) / 1000 }, { headers: CORS });
  }

  // ── 5 · FAIL — release the batch; nothing is marked paid ─────────────────
  if (op === 'fail') {
    const rec = led.payouts.find((p) => p.batchId === String(b.batchId || ''));
    if (!rec) return Response.json({ ok: false, error: 'unknown batch' }, { status: 404, headers: CORS });
    if (rec.status === 'sent') return Response.json({ ok: false, error: 'already sent — cannot fail a settled batch' }, { status: 409, headers: CORS });
    rec.status = 'failed';
    rec.note = String(b.note || 'released by operator').slice(0, 200);
    const ok = await freshWrite(PREFIX, led);
    return Response.json({ ok, op: 'fail', batchId: rec.batchId, note: rec.note }, { headers: CORS });
  }

  // ── dry-run record — log a plan without arming it ────────────────────────
  if (op === 'record-dry-run') {
    const p = plan(led, rail, rate, dashUsd);
    led.payouts.push({
      id: `d${Date.now().toString(36)}`, batchId: `d${Date.now().toString(36)}`,
      ts: Date.now(), rail, status: 'dry-run', recipients: p.recipients,
      motusSeconds: p.motusSeconds, amount: rail === 'dash' ? p.total : 0,
      rate, dashUsd, dj, mode, txid: '', note: 'dry run — nothing armed, nothing sent',
    });
    led.payouts = led.payouts.slice(-MAX_PAYOUTS);
    const ok = await freshWrite(PREFIX, led);
    return Response.json({ ok, op: 'record-dry-run', ...p }, { headers: CORS });
  }

  return Response.json({ ok: false, error: `unknown op '${op}' — use plan|arm|settle|fail|record-dry-run` }, { status: 400, headers: CORS });
}
