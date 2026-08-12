// /api/chat — SOURCECROWD, the community voice. GET public · POST a message
// (rate-limited, honeypot) or a VOTE (one per voice per message) · DELETE is
// the moderator (CortexInsight, operator secret).
// Links: the first http(s) URL in a message is lifted into `link` so the crowd
// can surface resources — and the strongest rise by votes.
// Same zero-dependency fresh-path Blob pattern as /api/live.
import { freshRead, freshWrite } from '../_blob';

export const dynamic = 'force-dynamic';

const PREFIX = 'semble-live/chat-';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-live-secret',
  'cache-control': 'no-store',
};
const SECRETISH = [
  /\bsk-[A-Za-z0-9_-]{16,}/, /\bsk_[A-Za-z0-9]{20,}/, /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{18,}\.[A-Za-z0-9_-]{18,}/, /\bxpub[0-9A-Za-z]{50,}/, /\b0x[a-fA-F0-9]{62,}\b/,
];
type Msg = { id: string; name: string; text: string; ts: number; iph?: string; votes?: number; voters?: string[]; link?: string };
const EMPTY: { msgs: Msg[] } = { msgs: [] };

async function iph(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'x';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + 'semble-salt'));
  return [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  const c = await freshRead(PREFIX, EMPTY);
  // IP hashes and voter lists are moderation metadata — they never leave the server
  return Response.json({ msgs: (c.msgs || []).map(({ iph: _a, voters: _b, ...m }) => m) }, { headers: CORS });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'unreadable' }, { status: 400, headers: CORS });
  if (String(b.web || '')) return Response.json({ ok: true }, { headers: CORS });   // honeypot: pretend success

  // ── A VOTE — one per voice per message, forever ──
  if (b.vote) {
    const who = await iph(req);
    const c = await freshRead(PREFIX, EMPTY);
    const m = (c.msgs || []).find((x) => x.id === String(b.vote));
    if (!m) return Response.json({ ok: false, error: 'that voice is gone' }, { status: 404, headers: CORS });
    m.voters = m.voters || [];
    if (m.voters.includes(who)) return Response.json({ ok: true, votes: m.votes || 0 }, { headers: CORS });
    m.voters.push(who);
    m.votes = (m.votes || 0) + 1;
    const ok = await freshWrite(PREFIX, c);
    return Response.json({ ok, votes: m.votes }, { headers: CORS });
  }

  const name = String(b.name || 'anon').slice(0, 40).replace(/[<>]/g, '');
  const text = String(b.text || '').slice(0, 420).trim();
  if (!text) return Response.json({ ok: false, error: 'say something' }, { status: 400, headers: CORS });
  if (SECRETISH.some((re) => re.test(text) || re.test(name))) {
    return Response.json({ ok: false, error: 'that looks like a credential — not in the room, ever' }, { status: 400, headers: CORS });
  }
  const who = await iph(req);
  const c = await freshRead(PREFIX, EMPTY);
  const last = (c.msgs || []).find((m) => m.iph === who);
  if (last && Date.now() - last.ts < 20_000) {
    return Response.json({ ok: false, error: 'one breath between sembles — 20s' }, { status: 429, headers: CORS });
  }
  // lift the first URL into `link` so the crowd can rank resources
  const linkM = /(https?:\/\/[^\s<>"']{8,300})/.exec(text);
  const link = linkM && /^https?:\/\//i.test(linkM[1]) ? linkM[1] : undefined;
  const msg: Msg = { id: Math.random().toString(36).slice(2, 10), name, text, ts: Date.now(), iph: who, votes: 0, voters: [], ...(link ? { link } : {}) };
  c.msgs = [msg, ...(c.msgs || [])].slice(0, 200);
  const ok = await freshWrite(PREFIX, c);
  return Response.json({ ok, id: msg.id }, { headers: CORS });
}

export async function DELETE(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get('x-live-secret') !== secret) {
    return Response.json({ ok: false, error: 'not the moderator' }, { status: 401, headers: CORS });
  }
  const b = await req.json().catch(() => ({}));
  const c = await freshRead(PREFIX, EMPTY);
  const before = (c.msgs || []).length;
  c.msgs = b.all ? [] : (c.msgs || []).filter((m) => m.id !== b.id);
  const ok = await freshWrite(PREFIX, c);
  return Response.json({ ok, removed: before - c.msgs.length }, { headers: CORS });
}
