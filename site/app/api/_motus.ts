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
  // WHICH RAIL THEY CHOSE. Default 'dash' because it has a real off-ramp, but
  // it is the contributor's call — being paid in an asset you did not pick is
  // its own kind of harm, so nobody is ever moved onto a rail silently.
  payoutPref: Rail;
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

export type Rail = 'dash' | 'trust';

export type Payout = {
  id: string; batchId: string; ts: number;
  rail: Rail;
  status: 'dry-run' | 'armed' | 'sent' | 'failed';
  recipients: number;
  motusSeconds: number;
  amount: number;                         // DASH or TRUST, per rail
  rate: number; dashUsd: number; unitUsd: number;
  dj: string; mode: string;
  txid: string; note: string;
};

// ── THE TWO THINGS $TRUST CAN BE, AND WHY ONLY ONE WAS EVER FALSE ───────────
//
// ❌ EMISSIONS — "lend your GPU, earn $TRUST from the protocol". This is
//    factually wrong: Intuition emissions go to veTRUST bonders, not to
//    off-chain contributors. We never say it, anywhere.
//
// ✅ TRANSFER — the operator holds $TRUST and SENDS it to a contributor who
//    chose that rail. That is an ordinary payment in a currency of choice, and
//    it is completely honest. Funded from the operator's own holdings, never
//    minted, never promised as yield.
//
// ✅ ATTESTATION — a permanent public record that you contributed. Zero value
//    transferred, and that is the point: it is a receipt, not a reward.
//
// The rail carries which of the three it is, so no surface can blur them.
export const TRUST_USD = 0.0512;          // operator-refreshed, stamped per batch
export type TrustKind = 'transfer' | 'attestation';

/** Value of one MOTUS-second in USD, at the operator's declared DASH rate. */
export function motusUsd(rate = MOTUS.DASH_PER_MOTUS_SECOND, dashUsd = MOTUS.DASH_USD) {
  return rate * dashUsd;
}
/** The same earned value, expressed on whichever rail the contributor chose.
 *  Equal value, different currency — never a different amount of work. */
export function owedOnRail(motusSeconds: number, rail: Rail, rate = MOTUS.DASH_PER_MOTUS_SECOND, dashUsd = MOTUS.DASH_USD, trustUsd = TRUST_USD) {
  const usd = Math.max(0, motusSeconds) * motusUsd(rate, dashUsd);
  return rail === 'trust'
    ? Math.round((usd / Math.max(1e-9, trustUsd)) * 1e6) / 1e6      // TRUST, 6dp
    : Math.round((usd / Math.max(1e-9, dashUsd)) * 1e8) / 1e8;      // DASH, 8dp
}

/* ═══════════════════════════════════════════════════════════════════════════
   RUNG 5 · DISPATCH — real work units, and the receipts they produce.

   ⚠ THE CONSTRAINT THAT SHAPES EVERYTHING HERE: verification works by having
   two independent machines compute the same unit and comparing digests. That
   only works if the result is BIT-IDENTICAL across vendors — and WebGPU/JS
   float operations are NOT guaranteed identical across GPU vendors, drivers, or
   even instruction orderings. So every kernel is INTEGER-ONLY. No floats, no
   Math.random, no Date, no iteration over unordered structures. A kernel that
   is not deterministic is not verifiable, and work that is not verifiable must
   never be paid for.
   ═══════════════════════════════════════════════════════════════════════════ */

export type WorkKind = 'embed' | 'score' | 'canary';

export type Unit = {
  id: string; kind: WorkKind;
  task: string;                           // the CortexInsight task this serves
  payload: string;                        // PUBLIC text only — never private work
  seed: number;                           // integer seed; part of the digest
  need: number;                           // agreeing results required (default 2)
  results: { node: string; digest: string; out: string; ms: number; ts: number }[];
  status: 'open' | 'verifying' | 'done' | 'disputed';
  digest: string;                         // the agreed digest, once settled
  expect: string;                         // canary only: the known-good digest
  created: number; settled: number;
};

export type Receipt = {
  id: string; node: string; unit: string; kind: WorkKind;
  task: string; ts: number; ms: number;
  agreed: boolean;                        // did it match the consensus?
  motusSeconds: number;                   // what this unit actually earned
  dj: string;
};

export const WORK = {
  NEED: 2,                                // agreeing results to settle a unit
  MAX_OPEN: 200,                          // queue depth cap
  MAX_RECEIPTS: 2000,
  CANARY_RATE: 6,                         // 1 in N units is a known-answer probe
  CLAIM_TTL: 120_000,                     // a claim expires; nobody can squat
  MAX_PAYLOAD: 4000,
  // A unit is worth a flat accrual on top of pledged time, because completed
  // work is worth more than availability. Availability is a promise; a verified
  // result is a fact.
  UNIT_MOTUS: 25,
};

/* ── THE KERNELS — integer-only, deterministic, identical on every machine ──
   These run in the browser (live.js) AND on the server (to make canaries and
   to spot-check). Both import this file, so there is exactly one definition and
   the two can never drift apart. */

/** FNV-1a, 32-bit, unsigned. Pure integer; identical everywhere. */
export function fnv1a(s: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Hashed term-frequency embedding, 64 integer buckets. The hashing trick with
 *  exact integer counts — no floats, so no vendor can round it differently. */
export function embed(text: string, seed: number, dims = 64): number[] {
  const v = new Array(dims).fill(0);
  const toks = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const t of toks) {
    if (t.length < 2) continue;
    v[fnv1a(t, (seed >>> 0) || 2166136261) % dims]++;
  }
  return v;
}

/** Integer square root — Newton's method with explicit parentheses and only
 *  integer state. Written plainly on purpose: this is load-bearing for
 *  determinism, and clever precedence here would be a silent correctness bug on
 *  some machines and not others. */
export function isqrt(n: number): number {
  if (n < 2) return n < 0 ? 0 : n;
  let x = n;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}

/** Integer cosine-like similarity ×10000. Integer dot, integer magnitudes, one
 *  final integer division — no float ever enters the result, so two different
 *  GPUs cannot disagree in the last bit and fail verification. */
export function scoreVec(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return Math.floor((dot * 10000) / Math.max(1, isqrt(na) * isqrt(nb)));
}

/** Run a unit. THE definition — browser and server both call this one. */
export function runUnit(u: Pick<Unit, 'kind' | 'payload' | 'seed'>): { out: string; digest: string } {
  let out = '';
  if (u.kind === 'embed' || u.kind === 'canary') {
    out = embed(u.payload, u.seed).join(',');
  } else if (u.kind === 'score') {
    // payload: "<query> <doc>"
    const [q, d] = u.payload.split(' ');
    out = String(scoreVec(embed(q || '', u.seed), embed(d || '', u.seed)));
  }
  return { out, digest: (fnv1a(out, (u.seed >>> 0) || 2166136261) >>> 0).toString(16).padStart(8, '0') };
}

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
