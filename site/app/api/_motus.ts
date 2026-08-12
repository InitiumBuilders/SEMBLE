// _motus.ts — the shared MotusCompute model: types, accrual math, and the
// honest units. Everything that touches contribution or money agrees here, so
// the ledger, the payout engine and the dashboards can never disagree.
//
// THE UNITS, stated once:
//   capability   "tab-equivalents". 1.0 ≈ a typical laptop-class WebGPU adapter.
//                A RELATIVE measure of pledged capability. Never a FLOPS claim.
//   MOTUS-second 1 second of capability-1.0 compute. The only accrual unit.
//   accrued      MOTUS-seconds earned. A ledger entry, NOT money.
//   owed         accrued converted at the operator's DECLARED rate. Still not
//                money until a payout batch is armed and sent.
//
// Money never moves from a number computed here. It moves from an armed,
// idempotent batch in /api/payouts, signed by an operator who holds the keys.

export const MOTUS = {
  // Declared conversion. The operator sets this; it is published in every
  // payout record so a contributor can always audit what rate they were paid at.
  DASH_PER_MOTUS_SECOND: 0.0000004,      // ~$0.0000121/MOTUS-sec at DASH $30.30
  // ⚠ The practical settlement floor is the OFF-RAMP, not the fee. Nobody can
  // exit $0.42. Measured: exchange withdrawals $0.03–$0.30, fiat ramps $10–$25.
  MIN_SETTLE_USD: 5,
  DASH_USD: 30.30,                        // refreshed by the operator, stamped per batch
  // Dash dust limit is ~$0.000165; a $5 settle is ~30,000x it. Not a constraint.
  DUST_DASH: 0.00000546,
};

export type Tier = 'tab' | 'node' | 'rented' | 'pool';
export const TIERS: Tier[] = ['tab', 'node', 'rented', 'pool'];
export const TIER_MUL: Record<Tier, number> = { tab: 1, node: 3, pool: 6, rented: 12 };

export type Node = {
  id: string; tier: Tier;
  vendor: string; arch: string; klass: string;
  maxBufferMB: number; invocations: number;
  features: string[];                     // WebGPU features the adapter reports
  dash: string; trust: string;
  first: number; last: number; seconds: number;
  byDj: Record<string, number>;           // djId -> seconds contributed while live
  byMode: Record<string, number>;         // direct|relay|theater -> seconds
  accrued: number;                        // MOTUS-seconds
  paid: number;                           // MOTUS-seconds already settled
};

export type Bucket = {
  t: number;                              // hour start, ms
  seconds: number; capability: number; nodes: number;
  // ⚠ ACCUMULATED at write time from each beat's real accrual — never derived
  // as seconds×capability. That derivation over-counts badly (measured 11,010
  // vs a true 3,225) because bucket capability is the whole live pool while
  // bucket seconds belong to individual beats. This is a headline number; it
  // has to be the same number the payout engine would pay on.
  motusSeconds: number;
  byDj: Record<string, number>;
};

export type Payout = {
  id: string; batchId: string; ts: number;
  rail: 'dash' | 'trust';
  status: 'dry-run' | 'armed' | 'sent' | 'failed';
  recipients: number;
  motusSeconds: number;
  amount: number;                         // DASH for the dash rail, 0 for trust
  rate: number; dashUsd: number;          // stamped so every batch is auditable
  dj: string; mode: string;
  txid: string; note: string;
};

export type Ledger = {
  nodes: Node[];
  history: Bucket[];
  djs: Record<string, { seconds: number; capability: number; nodes: number; sessions: number }>;
  modes: Record<string, { seconds: number; nodes: number }>;
  payouts: Payout[];
  totals: { sessions: number; seconds: number; accrued: number; paid: number };
};

export const EMPTY_LEDGER: Ledger = {
  nodes: [], history: [], djs: {}, modes: {}, payouts: [],
  totals: { sessions: 0, seconds: 0, accrued: 0, paid: 0 },
};

/** Relative pledged capability in tab-equivalents. Never a FLOPS claim. */
export function capability(n: Pick<Node, 'maxBufferMB' | 'invocations' | 'tier'>) {
  const buf = Math.min(4096, n.maxBufferMB || 0) / 256;      // 256MB ≈ 1.0
  const inv = Math.min(2048, n.invocations || 0) / 1024;
  const mul = TIER_MUL[n.tier as Tier] ?? 1;
  return Math.round(Math.max(0.1, buf * 0.7 + inv * 0.3) * mul * 100) / 100;
}

/** MOTUS-seconds for a beat of contribution. The only accrual path. */
export function accrue(seconds: number, cap: number) {
  return Math.round(Math.max(0, seconds) * Math.max(0, cap) * 1000) / 1000;
}

/** What a contributor is owed, in DASH, at the declared rate. Not money yet. */
export function owedDash(motusSeconds: number, rate = MOTUS.DASH_PER_MOTUS_SECOND) {
  return Math.round(Math.max(0, motusSeconds) * rate * 1e8) / 1e8;   // 8dp, Dash precision
}

/** Is this balance worth sending? The off-ramp floor, not the fee floor. */
export function settleable(motusSeconds: number, dashUsd = MOTUS.DASH_USD, rate = MOTUS.DASH_PER_MOTUS_SECOND) {
  const dash = owedDash(motusSeconds, rate);
  return dash * dashUsd >= MOTUS.MIN_SETTLE_USD && dash > MOTUS.DUST_DASH;
}

/** Truncate an address for public display. Recognisable, never harvestable. */
export const shortAddr = (a: string) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');

/** Hour bucket key. History is hourly — fine grain enough to see a set, coarse
 *  enough that a long stream does not produce an unbounded array. */
export const hourOf = (ts: number) => Math.floor(ts / 3_600_000) * 3_600_000;

export const HISTORY_HOURS = 336;         // 14 days of hourly buckets
export const MAX_NODES = 500;
export const MAX_PAYOUTS = 400;
