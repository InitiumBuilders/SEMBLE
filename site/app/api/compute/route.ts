// /api/compute — THE MOTUSCOMPUTE LEDGER.
//
// What this is: an honest telemetry ledger of pledged capability, contributed
// time, per-DJ and per-mode attribution, hourly history, and accrued
// MOTUS-seconds. What it is NOT: a job scheduler. No work is dispatched, and
// the API says so in its own response (`jobsRunning: false`) so no surface can
// imply otherwise. The accounting exists BEFORE the work, on purpose — a payout
// system you cannot audit before it moves money is a payout system you should
// not turn on.
//
// PAYOUT ADDRESSES ARE PUBLIC KEYS, NOT SECRETS — a Dash address or an EVM
// address is safe to hold and safe to show truncated. We still never accept a
// private key, seed phrase or xprv: those shapes are refused outright, because
// the commonest way to hurt a contributor is to let them paste the wrong thing.
import { freshRead, freshWrite } from '../_blob';
import {
  MOTUS, TIERS, EMPTY_LEDGER, capability, accrue, owedDash, settleable,
  shortAddr, hourOf, HISTORY_HOURS, MAX_NODES,
  type Ledger, type Node, type Tier, type Bucket,
} from '../_motus';

export const dynamic = 'force-dynamic';

const PREFIX = 'semble-live/compute-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-live-secret',
  'cache-control': 'no-store',
};

// Shapes we must NEVER store. A contributor pasting a seed phrase into a
// "wallet" box is a real and common accident; refusing loudly protects them.
const NEVER = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bxprv[0-9A-Za-z]{50,}/, /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/,  // WIF
  /\b0x[a-fA-F0-9]{64}\b/,                                            // raw EVM privkey
];
function looksLikeSecret(s: string) {
  if (NEVER.some((re) => re.test(s))) return true;
  const w = s.trim().split(/\s+/);
  return w.length >= 12 && w.length <= 26 && w.every((x) => /^[a-z]{3,8}$/.test(x)); // BIP39
}
// Dash addresses: base58, mainnet P2PKH starts 'X', P2SH '7'. EVM: 0x + 40 hex.
const isDash = (s: string) => /^[X7][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(s);
const isEvm = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

const clean = (s: unknown, cap: number) => String(s ?? '').slice(0, cap).replace(/[<>]/g, '');
const num = (v: unknown, max: number) => {
  const n = Math.floor(Number(v) || 0);
  return n < 0 ? 0 : n > max ? max : n;
};

/** Migrate any older ledger shape forward. A field added later must never make
 *  an existing ledger unreadable — the pledges are real and irreplaceable. */
function hydrate(l: Partial<Ledger> | null): Ledger {
  const led: Ledger = { ...EMPTY_LEDGER, ...(l || {}) } as Ledger;
  led.nodes = (led.nodes || []).map((n) => ({
    ...n,
    features: Array.isArray(n.features) ? n.features : [],
    byDj: n.byDj && typeof n.byDj === 'object' ? n.byDj : {},
    byMode: n.byMode && typeof n.byMode === 'object' ? n.byMode : {},
    accrued: Number(n.accrued) || 0,
    paid: Number(n.paid) || 0,
    payoutPref: n.payoutPref === 'trust' ? 'trust' : 'dash',
  }));
  // buckets written before motusSeconds existed carry 0 rather than a bad
  // derived value — an honest gap beats a confident wrong number
  led.history = (Array.isArray(led.history) ? led.history : [])
    .map((b) => ({ ...b, motusSeconds: Number(b.motusSeconds) || 0, byDj: b.byDj || {} }));
  led.djs = led.djs || {}; led.modes = led.modes || {}; led.payouts = led.payouts || [];
  led.totals = { sessions: 0, seconds: 0, accrued: 0, paid: 0, ...(led.totals || {}) };
  return led;
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET(req: Request) {
  const led = hydrate(await freshRead<Ledger>(PREFIX, EMPTY_LEDGER));
  const url = new URL(req.url);
  const nodes = led.nodes;
  const now = Date.now();
  const live = nodes.filter((n) => now - n.last < 5 * 60_000);
  const sum = (arr: Node[]) => Math.round(arr.reduce((a, n) => a + capability(n), 0) * 100) / 100;

  // ── per-DJ record: who was on when the compute arrived ───────────────────
  const djTable = Object.entries(led.djs)
    .map(([id, d]) => ({
      dj: id, seconds: Math.round(d.seconds), nodes: d.nodes, sessions: d.sessions,
      capability: Math.round(d.capability * 100) / 100,
      hours: Math.round((d.seconds / 3600) * 100) / 100,
      share: 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);
  const djTotal = djTable.reduce((a, d) => a + d.seconds, 0) || 1;
  djTable.forEach((d) => { d.share = Math.round((d.seconds / djTotal) * 1000) / 10; });

  // ── history: hourly buckets, oldest→newest, trimmed to the window ─────────
  const cutoff = hourOf(now) - HISTORY_HOURS * 3_600_000;
  const history = led.history
    .filter((b) => b.t >= cutoff)
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t, seconds: Math.round(b.seconds), nodes: b.nodes,
      capability: Math.round(b.capability * 100) / 100,
      motusSeconds: Math.round(Number(b.motusSeconds) || 0),   // accumulated, not derived
      byDj: b.byDj || {},
    }));

  const accruedOpen = Math.round((led.totals.accrued - led.totals.paid) * 1000) / 1000;

  const body: Record<string, unknown> = {
    // the honest headline, hard-coded — never a computed flag that could drift
    jobsRunning: false,
    note: 'Telemetry rung: pledges, contributed time, per-DJ attribution and accrual are recorded. No jobs are dispatched and no payment has been sent.',

    pledged: nodes.length, live: live.length,
    capability: sum(nodes), liveCapability: sum(live),
    seconds: Math.round(led.totals.seconds), sessions: led.totals.sessions,
    hours: Math.round((led.totals.seconds / 3600) * 100) / 100,

    // ── the accrual, in the units it is actually measured in ───────────────
    motus: {
      unit: 'MOTUS-second = 1s of capability-1.0 compute',
      accrued: Math.round(led.totals.accrued * 1000) / 1000,
      paid: Math.round(led.totals.paid * 1000) / 1000,
      open: accruedOpen,
      owedDash: owedDash(accruedOpen),
      owedUsd: Math.round(owedDash(accruedOpen) * MOTUS.DASH_USD * 100) / 100,
      rate: MOTUS.DASH_PER_MOTUS_SECOND,
      dashUsd: MOTUS.DASH_USD,
      settleFloorUsd: MOTUS.MIN_SETTLE_USD,
      settleable: settleable(accruedOpen),
      why: 'The floor is the OFF-RAMP, not the fee. A contributor cannot exit $0.42.',
    },

    byTier: TIERS.map((t) => ({
      tier: t, count: nodes.filter((n) => n.tier === t).length,
      capability: sum(nodes.filter((n) => n.tier === t)),
      seconds: Math.round(nodes.filter((n) => n.tier === t).reduce((a, n) => a + n.seconds, 0)),
    })),
    byDj: djTable,
    byMode: Object.entries(led.modes).map(([m, v]) => ({
      mode: m, seconds: Math.round(v.seconds), nodes: v.nodes,
      hours: Math.round((v.seconds / 3600) * 100) / 100,
    })).sort((a, b) => b.seconds - a.seconds),
    history,

    withDash: nodes.filter((n) => n.dash).length,
    withTrust: nodes.filter((n) => n.trust).length,

    // recent contributors, addresses TRUNCATED — enough to recognise yourself,
    // never enough to be a mailing list of crypto holders
    recent: live.slice(-24).map((n) => ({
      id: n.id.slice(0, 6), tier: n.tier, klass: n.klass, vendor: n.vendor, arch: n.arch,
      cap: capability(n), seconds: Math.round(n.seconds),
      maxBufferMB: n.maxBufferMB, invocations: n.invocations,
      features: (n.features || []).slice(0, 8),
      accrued: Math.round(n.accrued * 100) / 100,
      dash: shortAddr(n.dash), trust: shortAddr(n.trust),
      topDj: Object.entries(n.byDj || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    })),

    // the payout audit log is public by design — see /api/payouts for detail
    payouts: {
      count: led.payouts.length,
      sent: led.payouts.filter((p) => p.status === 'sent').length,
      dryRuns: led.payouts.filter((p) => p.status === 'dry-run').length,
      lastTs: led.payouts.length ? led.payouts[led.payouts.length - 1].ts : 0,
      totalDashSent: Math.round(led.payouts.filter((p) => p.status === 'sent' && p.rail === 'dash')
        .reduce((a, p) => a + p.amount, 0) * 1e8) / 1e8,
    },
  };

  // ?node=<id> — a contributor auditing their own record in full
  const who = url.searchParams.get('node');
  if (who) {
    const n = nodes.find((x) => x.id === who || x.id.startsWith(who));
    body.node = n ? {
      id: n.id.slice(0, 6), tier: n.tier, vendor: n.vendor, arch: n.arch, klass: n.klass,
      maxBufferMB: n.maxBufferMB, invocations: n.invocations, features: n.features,
      capability: capability(n), seconds: Math.round(n.seconds),
      first: n.first, last: n.last,
      byDj: n.byDj, byMode: n.byMode,
      accrued: Math.round(n.accrued * 1000) / 1000,
      paid: Math.round(n.paid * 1000) / 1000,
      open: Math.round((n.accrued - n.paid) * 1000) / 1000,
      owedDash: owedDash(n.accrued - n.paid),
      settleable: settleable(n.accrued - n.paid),
      dash: shortAddr(n.dash), trust: shortAddr(n.trust),
    } : null;
  }

  return Response.json(body, { headers: CORS });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'unreadable' }, { status: 400, headers: CORS });

  const dashRaw = clean(b.dash, 120).trim();
  const trustRaw = clean(b.trust, 120).trim();
  for (const v of [dashRaw, trustRaw]) {
    if (v && looksLikeSecret(v)) {
      return Response.json({
        ok: false,
        error: 'That looks like a PRIVATE KEY or a recovery phrase — never paste one anywhere. Use your receiving ADDRESS only.',
      }, { status: 400, headers: CORS });
    }
  }
  if (dashRaw && !isDash(dashRaw)) return Response.json({ ok: false, error: 'That is not a Dash address (mainnet addresses start with X).' }, { status: 400, headers: CORS });
  if (trustRaw && !isEvm(trustRaw)) return Response.json({ ok: false, error: 'That is not an EVM address (expected 0x + 40 hex characters).' }, { status: 400, headers: CORS });

  const led = hydrate(await freshRead<Ledger>(PREFIX, EMPTY_LEDGER));

  const id = clean(b.id, 40) || Math.random().toString(36).slice(2, 12);
  const tier = (TIERS as string[]).includes(b.tier) ? (b.tier as Tier) : 'tab';
  const dj = clean(b.dj, 24) || 'unknown';
  const mode = ['direct', 'relay', 'theater'].includes(b.mode) ? b.mode : 'direct';
  const now = Date.now();

  let n = led.nodes.find((x) => x.id === id);
  if (!n) {
    n = {
      id, tier, vendor: clean(b.vendor, 40), arch: clean(b.arch, 40), klass: clean(b.klass, 20),
      maxBufferMB: num(b.maxBufferMB, 65536), invocations: num(b.invocations, 8192),
      features: [], dash: '', trust: '', payoutPref: 'dash',
      first: now, last: now, seconds: 0,
      byDj: {}, byMode: {}, accrued: 0, paid: 0,
    };
    led.nodes.push(n);
    led.totals.sessions++;
    led.djs[dj] = led.djs[dj] || { seconds: 0, capability: 0, nodes: 0, sessions: 0 };
    led.djs[dj].sessions++;
  }
  n.tier = tier; n.last = now;
  if (b.vendor) n.vendor = clean(b.vendor, 40);
  if (b.arch) n.arch = clean(b.arch, 40);
  if (b.klass) n.klass = clean(b.klass, 20);
  if (b.maxBufferMB) n.maxBufferMB = num(b.maxBufferMB, 65536);
  if (b.invocations) n.invocations = num(b.invocations, 8192);
  if (Array.isArray(b.features)) n.features = b.features.slice(0, 16).map((f: unknown) => clean(f, 32)).filter(Boolean);
  if (dashRaw) n.dash = dashRaw;
  if (trustRaw) n.trust = trustRaw;
  // The contributor picks their rail. Refuse to set a preference they cannot
  // actually be paid on — silently accepting "pay me in TRUST" from someone
  // with no EVM address would strand their balance forever.
  if (b.payoutPref === 'trust' || b.payoutPref === 'dash') {
    const want = b.payoutPref as 'trust' | 'dash';
    const have = want === 'trust' ? n.trust : n.dash;
    if (have) n.payoutPref = want;
    else {
      return Response.json({
        ok: false,
        error: want === 'trust'
          ? 'Add a $TRUST (EVM) receiving address first — otherwise a TRUST balance would have nowhere to go.'
          : 'Add a $DASH receiving address first.',
      }, { status: 400, headers: CORS });
    }
  }

  // Pledged seconds are clamped per beat so a client cannot inflate its record.
  const add = num(b.seconds, 120);
  const cap = capability(n);
  const earned = accrue(add, cap);

  n.seconds += add;
  n.byDj[dj] = (n.byDj[dj] || 0) + add;
  n.byMode[mode] = (n.byMode[mode] || 0) + add;
  n.accrued += earned;

  led.totals.seconds += add;
  led.totals.accrued = Math.round((led.totals.accrued + earned) * 1000) / 1000;

  // ── per-DJ rollup ────────────────────────────────────────────────────────
  const d = led.djs[dj] = led.djs[dj] || { seconds: 0, capability: 0, nodes: 0, sessions: 0 };
  d.seconds += add;
  d.nodes = led.nodes.filter((x) => (x.byDj || {})[dj]).length;
  d.capability = Math.round(led.nodes.filter((x) => (x.byDj || {})[dj])
    .reduce((a, x) => a + capability(x), 0) * 100) / 100;

  // ── per-mode rollup ──────────────────────────────────────────────────────
  const m = led.modes[mode] = led.modes[mode] || { seconds: 0, nodes: 0 };
  m.seconds += add;
  m.nodes = led.nodes.filter((x) => (x.byMode || {})[mode]).length;

  // ── hourly history bucket ────────────────────────────────────────────────
  const h = hourOf(now);
  let bucket = led.history.find((x) => x.t === h);
  if (!bucket) { bucket = { t: h, seconds: 0, capability: 0, nodes: 0, motusSeconds: 0, byDj: {} } as Bucket; led.history.push(bucket); }
  bucket.seconds += add;
  bucket.motusSeconds = Math.round(((Number(bucket.motusSeconds) || 0) + earned) * 1000) / 1000;
  bucket.byDj[dj] = (bucket.byDj[dj] || 0) + add;
  const liveNow = led.nodes.filter((x) => now - x.last < 5 * 60_000);
  bucket.nodes = liveNow.length;
  bucket.capability = Math.round(liveNow.reduce((a, x) => a + capability(x), 0) * 100) / 100;

  // retention: bounded on every axis so the ledger can never grow without limit
  const cutoff = h - HISTORY_HOURS * 3_600_000;
  led.history = led.history.filter((x) => x.t >= cutoff).sort((a, b2) => a.t - b2.t);
  led.nodes = led.nodes.slice(-MAX_NODES);

  const ok = await freshWrite(PREFIX, led);
  return Response.json({
    ok, id, capability: cap,
    accrued: Math.round(n.accrued * 1000) / 1000,
    open: Math.round((n.accrued - n.paid) * 1000) / 1000,
    owedDash: owedDash(n.accrued - n.paid),
    settleable: settleable(n.accrued - n.paid),
    dj, mode,
  }, { headers: CORS });
}

// Operator-only: clear the ledger (CortexInsight).
export async function DELETE(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get('x-live-secret') !== secret) {
    return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  }
  const ok = await freshWrite(PREFIX, EMPTY_LEDGER);
  return Response.json({ ok }, { headers: CORS });
}
