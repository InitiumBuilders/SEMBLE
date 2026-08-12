// /api/chat — Sembles, the live thread. GET public · POST rate-limited with a
// honeypot · DELETE is the moderator (CortexInsight, operator secret).
// Same zero-dependency Blob REST pattern as /api/live.
export const dynamic = 'force-dynamic';

const BLOB_PATH = 'semble-live/chat.json';
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

let blobUrl = '';
async function chatUrl(): Promise<string> {
  if (blobUrl) return blobUrl;
  const r = await fetch(`https://blob.vercel-storage.com/?prefix=${encodeURIComponent(BLOB_PATH)}`, {
    headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }, cache: 'no-store',
  });
  const j = await r.json().catch(() => null);
  const hit = j?.blobs?.find((b: { pathname: string }) => b.pathname === BLOB_PATH);
  if (hit) blobUrl = hit.url;
  return blobUrl;
}
async function readChat(): Promise<{ msgs: { id: string; name: string; text: string; ts: number; iph?: string }[] }> {
  const url = await chatUrl();
  if (!url) return { msgs: [] };
  return await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ msgs: [] })) || { msgs: [] };
}
async function writeChat(data: unknown) {
  const put = await fetch(`https://blob.vercel-storage.com/${BLOB_PATH}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      'x-api-version': '7', 'x-content-type': 'application/json',
      'x-add-random-suffix': '0', 'x-cache-control-max-age': '0',
    },
    body: JSON.stringify(data),
  }).then((r) => r.json()).catch(() => null);
  if (put?.url) blobUrl = put.url;
  return !!put?.url;
}
async function iph(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'x';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + 'semble-salt'));
  return [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  const c = await readChat();
  // the IP hash is moderation metadata — it never leaves the server
  return Response.json({ msgs: (c.msgs || []).map(({ iph: _drop, ...m }) => m) }, { headers: CORS });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'unreadable' }, { status: 400, headers: CORS });
  if (String(b.web || '')) return Response.json({ ok: true }, { headers: CORS });   // honeypot: pretend success
  const name = String(b.name || 'anon').slice(0, 40).replace(/[<>]/g, '');
  const text = String(b.text || '').slice(0, 420).trim();
  if (!text) return Response.json({ ok: false, error: 'say something' }, { status: 400, headers: CORS });
  if (SECRETISH.some((re) => re.test(text) || re.test(name))) {
    return Response.json({ ok: false, error: 'that looks like a credential — not in the room, ever' }, { status: 400, headers: CORS });
  }
  const who = await iph(req);
  const c = await readChat();
  const last = (c.msgs || []).find((m) => m.iph === who);
  if (last && Date.now() - last.ts < 20_000) {
    return Response.json({ ok: false, error: 'one breath between sembles — 20s' }, { status: 429, headers: CORS });
  }
  const msg = { id: Math.random().toString(36).slice(2, 10), name, text, ts: Date.now(), iph: who };
  c.msgs = [msg, ...(c.msgs || [])].slice(0, 200);
  const ok = await writeChat(c);
  return Response.json({ ok }, { headers: CORS });
}

export async function DELETE(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get('x-live-secret') !== secret) {
    return Response.json({ ok: false, error: 'not the moderator' }, { status: 401, headers: CORS });
  }
  const b = await req.json().catch(() => ({}));
  const c = await readChat();
  const before = (c.msgs || []).length;
  c.msgs = b.all ? [] : (c.msgs || []).filter((m) => m.id !== b.id);
  const ok = await writeChat(c);
  return Response.json({ ok, removed: before - c.msgs.length }, { headers: CORS });
}
