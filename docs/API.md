# API

Three routes. All CORS-open for `GET` (both domains read them), all
operator-gated for privileged writes, all `no-store`.

**Auth:** privileged operations require the header `x-live-secret`, matched
against `process.env.LIVE_SECRET`. If the env var is unset, those operations
fail closed with `401` — they never fall open.

---

## `GET /api/live` — broadcast state

Public. Returns whatever the operator last chose to broadcast.

```jsonc
{
  "on": true,
  "dj": "daoz", "power": "hype",
  "topic": "…", "goal": "…", "motus": "…",
  "items":  [ { "kind": "WORK", "t": "…" } ],   // ≤ 24
  "agents": [ { "name": "…", "focus": "…" } ],  // ≤ 8
  "ts": 1755000000000
}
```

Before any state exists it returns `{ on: false, items: [], agents: [] }` — a
valid empty document, never a 404. Clients never need a special case.

## `POST /api/live` — operator only

Requires `x-live-secret`. **The payload is rebuilt field by field** — nothing
passes through untyped. Every string goes through the secret-shape scrub, and a
string that scrubs to empty is dropped entirely.

| field | cap |
|---|---|
| `dj` `power` | 24 chars |
| `topic` `motus` | 200 |
| `goal` | 400 |
| `items[]` | 24 items · `kind` 16 · `t` 500 |
| `agents[]` | 8 items · `name` 40 · `focus` 240 |

Scrubbed shapes: `sk-…` · `sk_…` · `ghp_…` · `github_pat_…` · `xox[baprs]-…` ·
PEM private-key headers · `AKIA…` · JWTs · `xpub…` · long `0x…` hex.

→ `{ ok: true, ts }` · `401 not the operator` · `400 unreadable body`

---

## `GET /api/chat` — SourceCrowd

Public. The community thread. Messages carry `votes`, and the strongest rise —
the crowd surfaces resources by ranking them, not by recency alone.

## `POST /api/chat` — post or vote

Two operations on one route.

**Post:** `{ name, text }`
- `429 one breath between sembles — 20s` — rate limit, per voice
- `400 that looks like a credential — not in the room, ever` — scrub rejection
- **Honeypot:** a non-empty `web` field returns `{ ok: true }` and stores
  nothing. Bots get a success they can't distinguish from real.
- The first URL in the text is lifted into `link` so resources can be ranked.

**Vote:** `{ id }` — one vote per voice per message. Re-voting is idempotent and
returns the current count, not an error. → `404 that voice is gone` if the
message no longer exists.

## `DELETE /api/chat` — moderation

Requires `x-live-secret`. → `401 not the moderator`.

---

## `GET /api/compute` — MotusCompute pool

Public. The pledge ledger.

```jsonc
{
  "jobsRunning": false,
  "note": "Rung 2: pledges and payout addresses are recorded. No jobs are dispatched yet.",
  "pledged": 2, "live": 2,
  "capability": 8.85, "liveCapability": 8.85,
  "seconds": 0, "sessions": 2,
  "byTier": [ { "tier": "tab", "count": 2, "capability": 8.85 }, … ],
  "withDash": 1, "withTrust": 0,
  "recent": [ { "id": "a1b2c3", "tier": "tab", "klass": "…", "vendor": "…",
                "cap": 2.95, "seconds": 0,
                "dash": "Xk4f2p…9dLm", "trust": "" } ]
}
```

**`jobsRunning: false` is hard-coded and always present.** It is not a status
flag that might flip on its own — it is a standing statement that this rung
records pledges and dispatches nothing. No surface can accidentally imply work
is happening.

`live` = seen within 5 minutes. `recent` is capped at 24 entries and **addresses
are truncated** (`Xk4f2p…9dLm`) — enough to recognise yourself, never enough to
harvest a mailing list.

**`capability` has an honest unit: tab-equivalents.** `1.0` ≈ a typical
laptop-class WebGPU adapter. It is a *relative measure of pledged capability*,
never a claim about FLOPS delivered — because nothing has been delivered.

```
capability = max(.1, (min(4096, maxBufferMB)/256)*.7 + (min(2048, invocations)/1024)*.3) × tierMul
tierMul:  tab 1  ·  node 3  ·  pool 6  ·  rented 12
```

## `POST /api/compute` — pledge

```jsonc
{ "id": "…", "tier": "tab|node|rented|pool",
  "vendor": "…", "arch": "…", "klass": "…",
  "maxBufferMB": 2048, "invocations": 1024,
  "seconds": 30, "dash": "X…", "trust": "0x…" }
```

**Validation, in order — the refusals matter more than the accepts:**

1. **Secret shapes are refused outright**, before anything else:
   `-----BEGIN … PRIVATE KEY-----` · `xprv…` · WIF (`[5KL]…`) · 64-hex raw keys.
   → `400 That looks like a PRIVATE KEY or a recovery phrase — never paste one
   anywhere. Use your receiving ADDRESS only.`
2. `dash` must match `^[X7][1-9A-HJ-NP-Za-km-z]{25,34}$`
   → `400 That is not a Dash address (mainnet addresses start with X).`
3. `trust` must match `^0x[a-fA-F0-9]{40}$`
   → `400 That is not an EVM address (expected 0x + 40 hex characters).`
4. Numbers are clamped: `maxBufferMB` ≤ 65536, `invocations` ≤ 8192, and
   **`seconds` ≤ 120 per beat** so a client cannot inflate its own record.
5. Strings are capped and `<`/`>` stripped.
6. The ledger keeps the most recent 500 nodes.

Both addresses are **optional**. Contributing without one is a first-class path —
you can lend a machine and take the receipt without ever naming a wallet.

→ `{ ok, id, capability }`

## `DELETE /api/compute` — operator only

Requires `x-live-secret`. Wipes the ledger. → `401 not the operator`.

---

## Storage

All three routes persist through [`_blob.ts`](../site/app/api/_blob.ts) using
Vercel Blob over plain REST — no SDK. Every write goes to a **new** path
(`prefix + zero-padded timestamp`), reads take the newest, and old generations
are pruned to two. This defeats CDN-stale reads, which otherwise serve
minutes-old state indefinitely. Rationale in
[`ARCHITECTURE.md §3`](ARCHITECTURE.md#3--why-storage-uses-a-fresh-path-every-write).
