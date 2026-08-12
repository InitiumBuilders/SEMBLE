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

/* ═══════════════════════════════════════════════════════════════════════════
   APPEND-ONLY EVENTS — the fix for lost updates.

   ⚠ MEASURED 2026-08-12, against production:
     · 6 concurrent pledges  → 2 registered.        4 of 6 LOST.
     · 6 concurrent × 60s    → 120s of 360s stored. 67% LOST.

   Cause: freshRead → modify → freshWrite is read-modify-write with no
   compare-and-swap. Two overlapping requests both read state S and both write
   their own S′; the second silently erases the first. This was documented as an
   acceptable limit back when the ledger only carried broadcast state. It now
   carries WORK RESULTS and ACCRUAL — so a lost update is a contributor's
   completed work vanishing, and it gets WORSE the more people show up, which is
   precisely the situation the whole project is built to create.

   The fix: writers stop overwriting shared state. Each writer APPENDS one small
   immutable event to its own unique path — so concurrent writers cannot collide
   by construction — and readers fold the events over the last snapshot. The
   fresh-path pattern below already writes unique paths; the bug was that each
   write carried a whole stale snapshot with it.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Append one immutable event. Concurrency-safe: every writer owns its path. */
export async function appendEvent(prefix: string, ev: unknown): Promise<boolean> {
  // path carries time for ordering plus randomness so two writers in the same
  // millisecond still get distinct paths
  const path = `${prefix}${Date.now().toString().padStart(14, '0')}-${Math.random().toString(36).slice(2, 10)}.json`;
  const put = await fetch(`${BLOB}/${path}`, {
    method: 'PUT',
    headers: { ...auth(), 'x-api-version': '7', 'x-content-type': 'application/json', 'x-add-random-suffix': '0' },
    body: JSON.stringify(ev),
  }).then((x) => x.json()).catch(() => null);
  return !!put?.url;
}

/** Read every event since the last compaction, oldest first. */
export async function readEvents<T>(prefix: string, limit = 1000): Promise<T[]> {
  const r = await fetch(`${BLOB}/?prefix=${encodeURIComponent(prefix)}&limit=${limit}`, {
    headers: auth(), cache: 'no-store',
  }).then((x) => x.json()).catch(() => null);
  const blobs: { pathname: string; url: string }[] = (r?.blobs || [])
    .sort((a: { pathname: string }, b: { pathname: string }) => (a.pathname < b.pathname ? -1 : 1));
  if (!blobs.length) return [];
  const out = await Promise.all(blobs.map((b) =>
    fetch(b.url, { cache: 'no-store' }).then((x) => x.json()).catch(() => null)));
  return out.filter(Boolean) as T[];
}

/** Drop events that have been folded into a snapshot. Best-effort: a failed
 *  prune costs storage and a slower read, never correctness — the fold is
 *  idempotent, so replaying an already-folded event changes nothing. */
export async function dropEvents(prefix: string, keepAfter = 0): Promise<number> {
  try {
    const r = await fetch(`${BLOB}/?prefix=${encodeURIComponent(prefix)}&limit=1000`, {
      headers: auth(), cache: 'no-store',
    }).then((x) => x.json());
    const stale = (r?.blobs || [])
      .filter((b: { pathname: string }) => {
        const ts = parseInt(b.pathname.slice(prefix.length, prefix.length + 14), 10);
        return Number.isFinite(ts) && ts <= keepAfter;
      })
      .map((b: { url: string }) => b.url);
    if (!stale.length) return 0;
    await fetch(`${BLOB}/delete`, {
      method: 'POST', headers: { ...auth(), 'x-api-version': '7', 'content-type': 'application/json' },
      body: JSON.stringify({ urls: stale }),
    });
    return stale.length;
  } catch { return 0; }
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
