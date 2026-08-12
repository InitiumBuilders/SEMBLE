// /api/live — the broadcast state. GET is public (CORS-open, both domains read
// it). POST requires the operator secret and comes only from CortexInsight.
//
// PRIVACY MODEL: selection happens at August's machine — nothing reaches this
// endpoint that he did not tick. This route is the SECOND gate: it re-scrubs
// every string for secret shapes and hard-caps sizes, so even a compromised
// pusher cannot broadcast a credential. Storage: Vercel Blob via plain REST
// with the fresh-path pattern (see ../_blob) — no SDK, no stale CDN reads.
import { freshRead, freshWrite } from '../_blob';

export const dynamic = 'force-dynamic';

const PREFIX = 'semble-live/state-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-live-secret',
  'cache-control': 'no-store',
};
const SECRETISH = [
  /\bsk-[A-Za-z0-9_-]{16,}/, /\bsk_[A-Za-z0-9]{20,}/, /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{18,}\.[A-Za-z0-9_-]{18,}/, /\bxpub[0-9A-Za-z]{50,}/, /\b0x[a-fA-F0-9]{62,}\b/,
];
const clean = (s: unknown, cap: number) => {
  const t = String(s ?? '').slice(0, cap);
  return SECRETISH.some((re) => re.test(t)) ? '' : t;
};
const EMPTY = { on: false, items: [], agents: [] };

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  return Response.json(await freshRead(PREFIX, EMPTY), { headers: CORS });
}

export async function POST(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get('x-live-secret') !== secret) {
    return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  }
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'unreadable body' }, { status: 400, headers: CORS });
  // Rebuild the payload field by field — nothing passes through untyped, and
  // every string goes through the secret-shape scrub. Empty after scrub = drop.
  const state = {
    on: !!b.on,
    dj: clean(b.dj, 24), power: clean(b.power, 24),
    topic: clean(b.topic, 200), goal: clean(b.goal, 400), motus: clean(b.motus, 200),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 24)
      .map((it: { t?: unknown; kind?: unknown }) => ({ kind: clean(it.kind, 16) || 'WORK', t: clean(it.t, 500) }))
      .filter((it: { t: string }) => it.t),
    agents: (Array.isArray(b.agents) ? b.agents : []).slice(0, 8)
      .map((a: { name?: unknown; focus?: unknown }) => ({ name: clean(a.name, 40), focus: clean(a.focus, 240) }))
      .filter((a: { name: string; focus: string }) => a.name && a.focus),
    ts: Date.now(),
  };
  const ok = await freshWrite(PREFIX, state);
  return Response.json({ ok, ts: state.ts }, { headers: CORS });
}
