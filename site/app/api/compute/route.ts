// /api/compute — THE MOTUSCOMPUTE LEDGER (rung 2).
//
// What this is: an honest registry of pledged capability + payout addresses.
// What this is NOT (yet): a job scheduler. No work is dispatched, and the API
// says so in its own response (`jobsRunning: false`) so no surface can imply
// otherwise. Rung 3 adds jobs; the accounting has to exist first.
//
// PAYOUT ADDRESSES ARE PUBLIC KEYS, NOT SECRETS — a Dash address or an EVM
// address is safe to hold and safe to show truncated. We still never accept a
// private key, seed phrase or xprv: those shapes are refused outright, because
// the commonest way to hurt a contributor is to let them paste the wrong thing.
import { freshRead, freshWrite } from '../_blob';

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

type Node = {
  id: string; tier: 'tab' | 'node' | 'rented' | 'pool';
  vendor: string; arch: string; klass: string;
  maxBufferMB: number; invocations: number;
  dash: string; trust: string;
  first: number; last: number; seconds: number;
};
type Ledger = { nodes: Node[]; totals: { sessions: number; seconds: number } };
const EMPTY: Ledger = { nodes: [], totals: { sessions: 0, seconds: 0 } };

const clean = (s: unknown, cap: number) => String(s ?? '').slice(0, cap).replace(/[<>]/g, '');
const num = (v: unknown, max: number) => {
  const n = Math.floor(Number(v) || 0);
  return n < 0 ? 0 : n > max ? max : n;
};
// A capability score with an honest unit: "tab-equivalents". 1.0 = a typical
// laptop-class WebGPU adapter. It is a RELATIVE measure of pledged capability,
// never a claim about FLOPS delivered — nothing has been delivered yet.
function capability(n: Node) {
  const buf = Math.min(4096, n.maxBufferMB) / 256;          // 256MB ≈ 1.0
  const inv = Math.min(2048, n.invocations) / 1024;
  const tierMul = n.tier === 'rented' ? 12 : n.tier === 'node' ? 3 : n.tier === 'pool' ? 6 : 1;
  return Math.round(Math.max(.1, buf * .7 + inv * .3) * tierMul * 100) / 100;
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  const led = await freshRead(PREFIX, EMPTY);
  const nodes = led.nodes || [];
  const live = nodes.filter((n) => Date.now() - n.last < 5 * 60_000);
  const sum = (arr: Node[]) => Math.round(arr.reduce((a, n) => a + capability(n), 0) * 100) / 100;
  return Response.json({
    // the honest headline: what is pledged, what is live, and that nothing runs
    jobsRunning: false,
    note: 'Rung 2: pledges and payout addresses are recorded. No jobs are dispatched yet.',
    pledged: nodes.length, live: live.length,
    capability: sum(nodes), liveCapability: sum(live),
    seconds: led.totals?.seconds || 0, sessions: led.totals?.sessions || 0,
    byTier: ['tab', 'node', 'rented', 'pool'].map((t) => ({
      tier: t, count: nodes.filter((n) => n.tier === t).length,
      capability: sum(nodes.filter((n) => n.tier === t)),
    })),
    withDash: nodes.filter((n) => n.dash).length,
    withTrust: nodes.filter((n) => n.trust).length,
    // recent contributors, addresses TRUNCATED — enough to recognise yourself,
    // never enough to be a mailing list
    recent: live.slice(-24).map((n) => ({
      id: n.id.slice(0, 6), tier: n.tier, klass: n.klass,
      vendor: n.vendor, cap: capability(n), seconds: n.seconds,
      dash: n.dash ? n.dash.slice(0, 6) + '…' + n.dash.slice(-4) : '',
      trust: n.trust ? n.trust.slice(0, 6) + '…' + n.trust.slice(-4) : '',
    })),
  }, { headers: CORS });
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

  const led = await freshRead(PREFIX, EMPTY);
  led.nodes = led.nodes || [];
  led.totals = led.totals || { sessions: 0, seconds: 0 };

  const id = clean(b.id, 40) || Math.random().toString(36).slice(2, 12);
  const tier = ['tab', 'node', 'rented', 'pool'].includes(b.tier) ? b.tier : 'tab';
  const now = Date.now();
  let n = led.nodes.find((x) => x.id === id);
  if (!n) {
    n = {
      id, tier, vendor: clean(b.vendor, 40), arch: clean(b.arch, 40), klass: clean(b.klass, 20),
      maxBufferMB: num(b.maxBufferMB, 65536), invocations: num(b.invocations, 8192),
      dash: '', trust: '', first: now, last: now, seconds: 0,
    };
    led.nodes.push(n);
    led.totals.sessions++;
  }
  n.tier = tier; n.last = now;
  if (b.vendor) n.vendor = clean(b.vendor, 40);
  if (b.arch) n.arch = clean(b.arch, 40);
  if (b.klass) n.klass = clean(b.klass, 20);
  if (b.maxBufferMB) n.maxBufferMB = num(b.maxBufferMB, 65536);
  if (b.invocations) n.invocations = num(b.invocations, 8192);
  if (dashRaw) n.dash = dashRaw;
  if (trustRaw) n.trust = trustRaw;
  // pledged seconds are clamped per beat so a client cannot inflate its own record
  const add = num(b.seconds, 120);
  n.seconds += add; led.totals.seconds += add;

  led.nodes = led.nodes.slice(-500);
  const ok = await freshWrite(PREFIX, led);
  return Response.json({ ok, id, capability: capability(n) }, { headers: CORS });
}

// Operator-only: clear the ledger (CortexInsight).
export async function DELETE(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get('x-live-secret') !== secret) {
    return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  }
  const ok = await freshWrite(PREFIX, EMPTY);
  return Response.json({ ok }, { headers: CORS });
}
