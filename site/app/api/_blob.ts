// Shared Blob helpers — the FRESH-PATH pattern.
//
// ⚠ Overwriting one fixed pathname made every read serve the CDN's stale copy
// (verified live: a push read back a state from twenty minutes earlier). So a
// write NEVER overwrites: each PUT gets a new `-<ts>` pathname, reads LIST the
// prefix (an authorized API call — never CDN-cached) and fetch the newest URL,
// which the CDN has never seen and therefore cannot serve stale. Old
// generations are pruned on write, keeping two for in-flight readers.
const BLOB = 'https://blob.vercel-storage.com';
const auth = () => ({ authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` });

export async function freshRead<T>(prefix: string, fallback: T): Promise<T> {
  const r = await fetch(`${BLOB}/?prefix=${encodeURIComponent(prefix)}&limit=1000`, {
    headers: auth(), cache: 'no-store',
  }).then((x) => x.json()).catch(() => null);
  const blobs: { pathname: string; url: string }[] = r?.blobs || [];
  if (!blobs.length) return fallback;
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));   // newest ts first
  const j = await fetch(blobs[0].url, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
  return (j as T) ?? fallback;
}

export async function freshWrite(prefix: string, data: unknown): Promise<boolean> {
  const path = `${prefix}${Date.now().toString().padStart(14, '0')}.json`;
  const put = await fetch(`${BLOB}/${path}`, {
    method: 'PUT',
    headers: { ...auth(), 'x-api-version': '7', 'x-content-type': 'application/json', 'x-add-random-suffix': '0' },
    body: JSON.stringify(data),
  }).then((x) => x.json()).catch(() => null);
  if (!put?.url) return false;
  // prune older generations (keep 2) — failure here is cosmetic, never fatal
  try {
    const r = await fetch(`${BLOB}/?prefix=${encodeURIComponent(prefix)}&limit=1000`, { headers: auth(), cache: 'no-store' }).then((x) => x.json());
    const blobs: { pathname: string; url: string }[] = (r?.blobs || []).sort((a: { pathname: string }, b: { pathname: string }) => (a.pathname < b.pathname ? 1 : -1));
    const old = blobs.slice(2).map((b) => b.url);
    if (old.length) await fetch(`${BLOB}/delete`, {
      method: 'POST', headers: { ...auth(), 'x-api-version': '7', 'content-type': 'application/json' },
      body: JSON.stringify({ urls: old }),
    });
  } catch { /* pruning is best-effort */ }
  return true;
}
