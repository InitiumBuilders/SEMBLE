# DISPATCH — rung 5

How a task becomes work, how work becomes proof, and every place we assumed the
contributor might be lying.

---

## The problem, stated honestly

**You cannot trust a result you did not compute.** A volunteer can return
garbage, or nothing at all, and claim payment. This is *the* problem of
volunteer computing and it long predates crypto — BOINC was solving it in 2002.

Any system that pays for unverified work is a faucet for fraud. So dispatch was
built last, after the accounting, and it is built around three defences.

---

## ① Consensus — two machines that have never met

Every unit is computed independently by `need` machines (default **2**) and
settles **only when their digests agree**.

On disagreement the unit goes to `disputed`, **nobody is credited**, and it is
re-issued with `need` raised.

```ts
else {
  // ⚠ No credit to ANYONE on a disagreement.
  u.status = 'disputed'; u.results = []; u.need = Math.min(3, u.need + 1);
}
```

It is tempting to pay the majority. With `need = 2` there is no majority — and
paying the *first* responder rewards whoever answers fastest, which is exactly
the incentive an attacker wants. So a dispute pays nobody.

## ② Canaries — the probe a client cannot recognise

Roughly **1 unit in 6** is a canary: a unit whose correct digest we already
know, computed server-side with the same shared kernel. A node that returns a
wrong answer to a canary is **quarantined immediately** and stops being counted.

Redundancy alone is beatable by two colluding clients. A canary is not, because
**the client cannot tell a canary from real work** — the claim response is
byte-identical for both.

Quarantine fires only on a *confidently wrong answer to a question we already
knew the answer to*. It never fires for being slow, offline, or flaky. That
distinction matters: honest machines fail all the time, but they fail by being
**absent**, not by being wrong.

## ③ Public work only, enforced by shape

Published attacks (ACM CCS 2025) reconstruct original inputs from the
intermediate state peers observe. So the queue **physically cannot carry private
work**: payloads are capped, stored in plaintext in a public blob, and served to
anyone who asks.

If it would be bad for it to be public, it cannot be a work unit. That is
enforced by the shape of the system, not by a policy someone has to remember —
and CortexInsight runs its secret-shape gate over the whole payload *and* every
chunk before dispatch, because chunking can split a key across a boundary and
hide it from a per-chunk test.

---

## ⚠ The constraint that shapes every kernel: integer-only

Verification compares digests from different machines. That only works if the
result is **bit-identical across vendors** — and JS/WebGPU floating-point
operations are **not** guaranteed identical across GPUs, drivers, or instruction
orderings.

A single float anywhere in a kernel would make honest machines look like liars.

So every kernel is integer-only:

```ts
export function fnv1a(s: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
```

Rules for any new kernel:

- **No floats.** Integer arithmetic only — including the square root
  (`isqrt`, written with explicit parentheses precisely because clever operator
  precedence here would be a silent correctness bug on some machines and not
  others).
- **No `Math.random`, no `Date`, no `performance.now()`** in the result path.
- **No iteration over unordered structures** (`Object.keys` ordering, `Set`).
- **Seeds are derived from content and index**, never random — the whole ledger
  must be reproducible from its own contents by anyone auditing it.

The kernels live in [`_motus.ts`](../site/app/api/_motus.ts) and are imported by
the server; the browser carries a byte-identical copy in `live.js`. **If you
change one, change both** — the `--airtest` harness computes a unit with the
server kernel and submits it as a second machine, so a drift between them shows
up as a dispute rather than as silent wrongness.

---

## The lifecycle

```
  CortexInsight task
        │  secret-shape gate (whole payload, then every chunk)
        ▼
  POST /api/work {op:"enqueue"}     → units + canaries, seeded from content
        │
        ▼
  GET /api/work?node=…              browser claims a unit it has not seen
        │
        ▼
  runUnit()  — integer-only, in the tab, between frames
        │
        ▼
  POST /api/work {digest,out,ms}
        │
        ├─ canary + wrong  → QUARANTINE, immediately
        ├─ digests agree   → SETTLED · both machines credited · RECEIPTS written
        └─ digests differ  → DISPUTED · nobody credited · re-issued
```

A settled unit is worth `WORK.UNIT_MOTUS` (**25**) MOTUS-seconds × the node's
capability. **Completed work is worth more than availability**, because
availability is a promise and a verified result is a fact.

---

## Receipts — the contributor's evidence

`GET /api/receipts?node=<id>` returns what a machine actually did: the unit, the
task it fed, the milliseconds it took, and **the agreed digest**. Anyone can
re-run the unit with the published kernel and check they get the same eight hex
characters.

**Receipts survive the operator clearing the queue.** `DELETE /api/work` drops
units and keeps receipts, deliberately:

> The queue is the operator's. The receipt is the contributor's. One person must
> never be able to erase another's proof.

---

## `jobsRunning` is now computed

For rungs 1–4 this field was **hard-coded `false`**, so that no surface could
imply work was happening while dispatch was unbuilt.

It is now **derived from the queue** — true when units are open or verifying,
false when they are not. It earned the right to be true.

---

## What is still weak, stated plainly

- **`need = 2` is thin.** Two colluding clients that both return the same wrong
  answer would settle a unit. The canary rate is what actually bounds this, and
  a determined attacker running many nodes could get unlucky-for-us. Raising
  `need` and the canary rate is a dial, and it should be turned up before any
  meaningful money flows through it.
- **Quarantine is per-node-id**, and node ids are client-generated. A quarantined
  actor can reload for a fresh id. This costs them all accrued balance, which is
  a real deterrent, but it is not identity.
- **The kernels are useful but modest** — hashed term-frequency embeddings and
  integer similarity scores over public text. Genuinely useful for indexing the
  Motus corpus, and honestly not a frontier model. Anyone claiming a few browser
  tabs rival a rented H100 is selling something.
- **No work is dispatched unless the operator enqueues it.** An idle queue means
  an idle pool, and `jobsRunning` says so.
