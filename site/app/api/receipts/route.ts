// /api/receipts — WHAT YOUR MACHINE ACTUALLY DID.
//
// A pledge counter says "you were available". A receipt says "you computed unit
// u3f2, it was checked against another machine, they agreed, and it fed this
// task." That difference is the whole point of rung 5: a contributor should be
// able to see the WORK, not just the time.
//
// Receipts are public and permanent within retention. They survive the operator
// clearing the work queue on purpose — the queue is the operator's, but the
// receipt is the contributor's evidence, and one person must never be able to
// erase another's proof.
import { freshRead } from '../_blob';
import {
  EMPTY_LEDGER, MOTUS, owedOnRail, TRUST_USD, shortAddr,
  type Ledger, type Receipt, type Unit,
} from '../_motus';

export const dynamic = 'force-dynamic';

const PREFIX = 'semble-live/compute-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store',
};

type WLedger = Ledger & { units: Unit[]; receipts: Receipt[]; quarantine: string[] };

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET(req: Request) {
  const raw = await freshRead<WLedger>(PREFIX, { ...EMPTY_LEDGER, units: [], receipts: [], quarantine: [] } as WLedger);
  const receipts: Receipt[] = raw.receipts || [];
  const units: Unit[] = raw.units || [];
  const nodes = raw.nodes || [];
  const url = new URL(req.url);
  const node = (url.searchParams.get('node') || '').slice(0, 40);

  const rows = node ? receipts.filter((r) => r.node === node || r.node.startsWith(node)) : receipts;
  const sorted = rows.slice().sort((a, b) => b.ts - a.ts);

  const totalMotus = Math.round(rows.reduce((a, r) => a + r.motusSeconds, 0) * 1000) / 1000;
  const byTask = Object.values(rows.reduce((acc, r) => {
    const k = r.task || 'unattributed';
    acc[k] = acc[k] || { task: k, units: 0, motusSeconds: 0, ms: 0 };
    acc[k].units++; acc[k].motusSeconds += r.motusSeconds; acc[k].ms += r.ms;
    return acc;
  }, {} as Record<string, { task: string; units: number; motusSeconds: number; ms: number }>))
    .map((t) => ({ ...t, motusSeconds: Math.round(t.motusSeconds * 100) / 100 }))
    .sort((a, b) => b.units - a.units);

  const body: Record<string, unknown> = {
    what: 'A receipt is proof that a specific unit of work was computed on a specific machine, checked against an independent machine, and agreed. Not a promise, not availability — a completed, verified result.',
    scope: node ? `node ${node.slice(0, 6)}` : 'everyone',
    count: rows.length,
    motusSeconds: totalMotus,
    computeMs: rows.reduce((a, r) => a + r.ms, 0),
    byTask,
    verified: 'Each of these settled only because two independent machines produced the same digest, or because it was a known-answer probe that came back correct.',
    receipts: sorted.slice(0, 100).map((r) => ({
      id: r.id, node: r.node.slice(0, 6), unit: r.unit, kind: r.kind,
      task: r.task, ts: r.ts, ms: r.ms, agreed: r.agreed,
      motusSeconds: Math.round(r.motusSeconds * 1000) / 1000,
      dj: r.dj,
      // the agreed digest is the auditable artefact: anyone can re-run the unit
      // with the shared kernel and check they get the same 8 hex characters
      digest: (units.find((u) => u.id === r.unit) || { digest: '' }).digest,
    })),
  };

  // A contributor asking about themselves gets their payout position too —
  // on WHICHEVER rail they chose. Same earned value, their currency.
  if (node) {
    const n = nodes.find((x) => x.id === node || x.id.startsWith(node));
    if (n) {
      const open = Math.round((n.accrued - n.paid) * 1000) / 1000;
      const pref = (n as unknown as { payoutPref?: string }).payoutPref === 'trust' ? 'trust' : 'dash';
      body.you = {
        node: n.id.slice(0, 6),
        unitsCompleted: rows.length,
        accrued: Math.round(n.accrued * 1000) / 1000,
        paid: Math.round(n.paid * 1000) / 1000,
        open,
        payoutPref: pref,
        owed: owedOnRail(open, pref as 'dash' | 'trust'),
        owedUsd: Math.round(open * MOTUS.DASH_PER_MOTUS_SECOND * MOTUS.DASH_USD * 100) / 100,
        unit: pref === 'trust' ? '$TRUST' : '$DASH',
        dash: shortAddr(n.dash), trust: shortAddr(n.trust),
        quarantined: (raw.quarantine || []).includes(n.id),
        rates: { dashUsd: MOTUS.DASH_USD, trustUsd: TRUST_USD, settleFloorUsd: MOTUS.MIN_SETTLE_USD },
        note: pref === 'trust'
          ? 'You chose $TRUST. You are paid the same earned VALUE, transferred from the operator\'s own holdings — this is a payment in your currency of choice, not protocol emissions. Nobody can earn $TRUST from Intuition for off-chain work.'
          : 'You chose $DASH — ~2s InstantSend finality and a real off-ramp.',
      };
    }
  }

  return Response.json(body, { headers: CORS });
}
