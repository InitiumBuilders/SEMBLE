# API

Seven routes: `live` · `chat` · `compute` · `work` · `receipts` · `payouts` ·
`golem`. All CORS-open for `GET` (every surface reads them), all operator-gated
for privileged writes, all `no-store`.

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

## `GET /api/compute` — MotusCompute telemetry

Public. The full ledger: pledges, attribution, hourly history and accrual.

```jsonc
{
  "jobsRunning": false,
  "note": "Telemetry rung: … No jobs are dispatched and no payment has been sent.",
  "pledged": 2, "live": 2,
  "capability": 8.85, "liveCapability": 8.85,
  "seconds": 3600, "hours": 1.0, "sessions": 2,

  "motus": {
    "unit": "MOTUS-second = 1s of capability-1.0 compute",
    "accrued": 16057.5, "paid": 0, "open": 16057.5,
    "owedDash": 0.0064230, "owedUsd": 0.19,
    "rate": 0.0000004, "dashUsd": 30.30,
    "settleFloorUsd": 5, "settleable": false,
    "why": "The floor is the OFF-RAMP, not the fee. A contributor cannot exit $0.42."
  },

  "byDj":   [ { "dj": "daoz", "seconds": 750, "hours": 0.21, "nodes": 3,
                "sessions": 1, "capability": 12.45, "share": 32.1 } ],
  "byMode": [ { "mode": "theater", "seconds": 90, "hours": 0.03, "nodes": 1 } ],
  "byTier": [ { "tier": "tab", "count": 2, "capability": 8.85, "seconds": 600 } ],

  "history": [ { "t": 1755014400000, "seconds": 600, "nodes": 4,
                 "capability": 18.35, "motusSeconds": 8939,
                 "byDj": { "daoz": 240 } } ],

  "withDash": 1, "withTrust": 0,
  "recent": [ { "id": "a1b2c3", "tier": "tab", "klass": "desktop", "vendor": "nvidia",
                "arch": "ada", "cap": 2.95, "seconds": 120,
                "maxBufferMB": 2048, "invocations": 1024,
                "features": ["shader-f16"], "accrued": 354,
                "dash": "Xk4f2p…9dLm", "trust": "", "topDj": "daoz" } ],
  "payouts": { "count": 0, "sent": 0, "dryRuns": 0, "lastTs": 0, "totalDashSent": 0 }
}
```

⚠ **`history[].motusSeconds` is ACCUMULATED at write time, never derived.**
Computing it as `seconds × capability` over-counted by 3.4× (11,010 vs a true
3,225), because bucket capability is the whole live pool while bucket seconds
belong to individual beats. It is a headline number and it must equal what the
payout engine would actually pay on. The `--airtest` harness asserts
`Σ history.motusSeconds ≤ motus.accrued` on every run.

### `GET /api/compute?node=<id>` — audit one machine

Returns that node's full record: `byDj`, `byMode`, `accrued`, `paid`, `open`,
`owedDash`, `settleable`, and its declared WebGPU `features`. A contributor can
always audit exactly what they are owed and which sets they earned it during.

⚠ **`jobsRunning` on this route is a legacy constant `false`; the live one lives
on [`/api/work`](#get-apiwork--the-dispatch-queue) and is COMPUTED from the
queue.** Through rungs 1–4 it was hard-coded here so no surface could imply work
was happening while dispatch was unbuilt. Now that dispatch exists, read
`/api/work` for the real answer — and prefer it in any client you write.

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
  "maxBufferMB": 2048, "invocations": 1024, "features": ["shader-f16"],
  "seconds": 30,
  "dj": "daoz",                 // who was live — drives per-DJ attribution
  "mode": "direct|relay|theater",
  "dash": "X…", "trust": "0x…" }
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

## `GET /api/payouts` — the public audit log

Public. Every batch, every DJ, every rail. Addresses truncated.

```jsonc
{
  "custody": "This service never holds a private key. It plans, arms and audits; the operator's own node signs.",
  "moneyMoved": false,
  "summary": { "batches": 0, "sent": 0, "dryRuns": 0, "armed": 0, "failed": 0,
               "dashSent": 0, "trustAttestations": 0, "recipientsPaid": 0,
               "motusSecondsSettled": 0, "motusSecondsOpen": 16057.5,
               "openOwedDash": 0.006423, "openOwedUsd": 0.19 },
  "byDj":   [ { "dj": "daoz", "batches": 1, "amount": 10.62, "recipients": 2, "motusSeconds": 1062 } ],
  "byRail": [ { "rail": "dash",  "batches": 1, "sent": 1, "amount": 10.62, "note": "…" },
              { "rail": "trust", "batches": 0, "sent": 0, "amount": 0,
                "note": "TRUST is the RECEIPT, never the reward. … Amount is always 0 by design." } ],
  "log": [ { "id", "batchId", "ts", "rail", "status", "recipients", "amount",
             "motusSeconds", "rate", "dashUsd", "dj", "mode", "txid", "note" } ]
}
```

Filterable: `?rail=dash|trust` · `?dj=<id>`.

**`moneyMoved` is derived from batches actually settled.** It is `false` today
and flips only when a real batch settles.

## `POST /api/payouts` — operator only

Requires `x-live-secret`; **fails closed with `401` if `LIVE_SECRET` is unset.**

| `op` | What it does | State change |
|---|---|---|
| `plan` | dry run — who clears the floor, what it costs, emits a `sendmany` | none |
| `arm` | freezes an immutable batch and returns the spec to sign | creates batch |
| `settle` | records the txid; marks contributors paid — **idempotent** | marks paid |
| `fail` | releases a batch; nothing is marked paid | releases |
| `record-dry-run` | logs a plan to the audit trail without arming it | logs only |

Body: `{ op, rail: "dash"|"trust", rate?, dashUsd?, dj?, mode?, batchId?, txid? }`

**This service cannot sign.** `arm` returns:

```jsonc
{ "batchId": "b…", "recipients": 2, "total": 10.62,
  "sendmany": { "Xk4f…": 7.08, "Xuxz…": 3.54 },
  "next": "Sign this sendmany on YOUR node, then POST {op:\"settle\", batchId, txid}. This service cannot sign it." }
```

⚠ **Replaying `settle` returns `{ ok: true, already: true }` and re-credits
nothing.** A retried request is normal; a payout system that pays twice on retry
is one that drains. Verified live — see [`PAYOUTS.md`](PAYOUTS.md#-idempotency-is-the-property-that-matters-most).

A settled batch **cannot** be retroactively failed → `409 already sent`.

---

## `GET /api/golem` — adapter + live supply gauge

Public. **Re-measures Golem's own stats API on every request** — this is not a
cached opinion.

```jsonc
{
  "adapter": { "role": "requestor", "configured": false, "appkeyPresent": false,
               "api": "http://127.0.0.1:7465", "subnet": "public",
               "requires": "a local yagna daemon … No hosted gateway exists." },
  "chain":   { "network": "polygon", "chainId": 137, "glm": "0x0B22…", "deposits": "0x57ff…" },
  "supply":  { "measuredAt": …, "reachable": true, "providers": 370, "gpus": 0,
               "runtimes": { "vm": 339, "wasmtime": 337 } },
  "verdict": { "viewersCanContribute": false, "whyNot": "…", "canRentGpu": false, "rentNote": "…" }
}
```

⚠ **The app-key is wallet control and is never echoed** — only `appkeyPresent`.
`canRentGpu` is computed from the live probe, so if Golem ever grows GPU supply
it flips on its own.

`POST /api/golem` (operator only) dry-runs a requestor demand and reports
whether it could be matched against live supply. It never signs.

---

## `GET /api/work` — the dispatch queue

Public. `?node=<id>` claims the next unit that node has not already computed.

```jsonc
// public queue view
{
  "jobsRunning": true,          // ⚠ COMPUTED from the queue, no longer hard-coded
  "queue": { "open": 2, "verifying": 3, "done": 1, "disputed": 1 },
  "completed": 1, "unitsWorth": 25, "need": 2, "quarantined": 1,
  "byTask": [ { "task": "Index the Motus corpus", "units": 1, "inFlight": 6, "contributors": 2 } ],
  "standing": { "on": true, "task": "Standing — …", "kind": "embed", "generated": 42, "what": "…" },
  "verification": "Every unit is computed independently by 3 machines and settles only when their digests agree…",
  "need": 3, "canaryRate": 4,
  "recent": [ { "id": "u…", "kind": "embed", "task": "…", "digest": "edce4537", "by": ["honest", "hones2"] } ]
}

// ?node=… — a claim
{ "unit": { "id": "u…", "kind": "embed", "payload": "…", "seed": 2654435761, "task": "…" },
  "queue": 5, "ttlMs": 120000 }
```

⚠ **The client is never told which units are canaries.** That is the point — a
probe you can recognise is a probe you can pass. This is strong enough that the
project's own harness cannot identify them either: it discovers a non-canary
unit empirically by submitting and seeing whether it settled on the first
answer, and reports how many it skipped.

⚠ **`byTask` counts in-flight work as well as finished work.** It listed only
settled units at first, so a task dispatched to the pool showed nothing until
three machines had agreed — the operator's board said *"the pool is not on
this"* while the pool was actively on it. *Is it being worked?* and *did it
finish?* are different questions and both need answering.

⚠ **`standing`** describes the corpus that keeps the pool from ever being idle.
Configure with `POST {op:"standing", on, task, kind, corpus[]}`. See
[`DISPATCH.md`](DISPATCH.md#the-standing-queue--why-the-pool-is-never-idle).

A quarantined node gets `{ unit: null, quarantined: true, why: "…" }`.

## `POST /api/work` — submit a result, or enqueue (operator)

**Submit:** `{ node, unit, digest, out, ms }`

| Outcome | Meaning |
|---|---|
| `{ status: "verifying", waitingFor: 1 }` | recorded, awaiting an independent machine |
| `{ status: "done", settled: true, earned }` | digests agreed — both machines credited, receipts written |
| `{ status: "disputed" }` | machines disagreed — **nobody credited**, unit re-issued with `need` raised |
| `403 { quarantined: true }` | failed a known-answer canary; results no longer counted |
| `{ already: true }` | duplicate submission — ignored, never double-credited |

**Enqueue** (operator, `x-live-secret`):
`{ op: "enqueue", task, kind: "embed"|"score"|"matmul", chunks: [ … ] }`
→ `{ enqueued, canaries, queue }`. Seeds are derived from content and index,
never random, so the ledger is reproducible from its own contents.

## `DELETE /api/work` — operator only

Drops unfinished units. **Receipts are kept** — the queue is the operator's, the
receipt is the contributor's, and one must never be able to erase the other's
proof. → `{ dropped, receiptsKept }`

---

## `GET /api/receipts` — proof of completed work

Public. `?node=<id>` scopes it to one machine.

```jsonc
{
  "what": "A receipt is proof that a specific unit of work was computed on a specific machine, checked against an independent machine, and agreed.",
  "count": 1, "motusSeconds": 147.5, "computeMs": 14,
  "byTask": [ { "task": "Index the Motus corpus", "units": 1, "motusSeconds": 147.5, "ms": 14 } ],
  "receipts": [ { "id": "r…", "node": "honest", "unit": "u…", "kind": "embed",
                  "task": "…", "ts": …, "ms": 14, "agreed": true,
                  "motusSeconds": 147.5, "dj": "daoz", "digest": "edce4537" } ],
  "you": { "unitsCompleted": 1, "open": 147.5, "payoutPref": "dash",
           "owed": 0.0000826, "unit": "$DASH", "owedUsd": 0.00,
           "quarantined": false, "note": "…" }
}
```

The `digest` is the auditable artefact — **anyone can re-run the unit with the
published kernel and check they get the same eight hex characters.**

---

## Choosing a payout rail

`POST /api/compute` accepts `payoutPref: "dash" | "trust"`.

⚠ Choosing a rail you have no address for is **refused with the reason** —
accepting it silently would strand the balance forever:

> *Add a $TRUST (EVM) receiving address first — otherwise a TRUST balance would
> have nowhere to go.*

Both rails pay the **same earned value**; the $5 floor is applied in USD on
both. See [`PAYOUTS.md`](PAYOUTS.md#the-rail-is-the-contributors-choice-never-the-operators).

---

## Storage

All three routes persist through [`_blob.ts`](../site/app/api/_blob.ts) using
Vercel Blob over plain REST — no SDK. Every write goes to a **new** path
(`prefix + zero-padded timestamp`), reads take the newest, and old generations
are pruned to two. This defeats CDN-stale reads, which otherwise serve
minutes-old state indefinitely. Rationale in
[`ARCHITECTURE.md §3`](ARCHITECTURE.md#3--why-storage-uses-a-fresh-path-every-write).
