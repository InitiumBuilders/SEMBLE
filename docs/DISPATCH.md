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

## ① Consensus — machines that have never met

Every unit is computed independently by `need` machines (**3**) and settles
**only when their digests agree**.

> ⚠ **Raised 2 → 3.** With `need = 2` a single colluding *pair* returning the
> same wrong answer settles a unit. At 3 they must control a majority of three
> independent claims on the same unit — materially harder, though see
> [what is still weak](#what-is-still-weak-stated-plainly).

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

Roughly **1 unit in 4** is a canary: a unit whose correct digest we already
know, computed server-side with the same shared kernel. A node that returns a
wrong answer to a canary is **quarantined immediately** and stops being counted.

> ⚠ **Raised from 1-in-6 → 1-in-4.** Canaries are the defence collusion cannot
> beat. The cost is real — a quarter of the pool's effort now proves honesty
> rather than producing output — and that is the correct trade while money is on
> the line.

**Quarantine covers the hardware, not just the id.** Node ids are
client-generated, so a reload buys a fresh one. Quarantine therefore also
records a coarse fingerprint (`vendor|arch|class|buffer|invocations`), which
makes evasion cost more than pressing F5.

⚠ **This is not identity and nothing here pretends it is.** A determined actor
can lie about their reported adapter. It raises the cost from *"reload"* to
*"lie convincingly"* — that is the honest size of the improvement. The
fingerprint is deliberately coarse so it cannot become a tracking identifier for
honest users.

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
change one, change both.**

### The kernels

| kind | what it computes | why it exists |
|---|---|---|
| `embed` | 64-bucket hashed term-frequency vector, integer counts | builds a searchable index of a public corpus |
| `score` | integer cosine-like similarity ×10000 | ranks documents against a query |
| `matmul` | **INT8 × INT8 → INT32 tile multiply** | the actual primitive of quantized model inference |
| `canary` | same as `embed`, with a known answer | catches liars |

`matmul` is the interesting one. A transformer forward pass is, overwhelmingly,
matrix multiplication — and INT8 accumulate is exactly what quantized inference
does. It also has a property float matmul does not: **it is exact**, so the same
consensus check that guards `embed` guards it too. A float matmul tile could not
be verified by digest at all; two honest GPUs would differ in the low bits and
both would look like liars.

⚠ **What `matmul` is and is not.** It is the correct primitive and it genuinely
works. It is **not a running LLM** — a real forward pass also needs weight
distribution, KV-cache residency, layer scheduling and a latency budget that a
pool of opening-and-closing tabs does not have yet. Building the verifiable tile
first is the right order; claiming the model runs today would be exactly the lie
this project exists to avoid.

### ⚠ Conformance testing, and the two bugs it caught immediately

`POST /api/work {op:"kernel-probe"}` runs any kernel on a known input and
returns the digest. Re-implement the kernel from this document and you must get
the same eight characters — that is what turns *"reproducible by anyone"* from a
claim into a check.

```bash
curl -s -X POST https://www.semble.cc/api/work -H 'content-type: application/json' -d '{"op":"kernel-probe","kind":"matmul","payload":"32","seed":424242}'
```

`kernel-conformance.sh` runs seven known-answer cases against production. On its
very first run it caught two real defects:

**A NUL byte had replaced a space** inside the `score` kernel's separator —
`split(' ')` became `split('\0')`. That does not throw. It produces a
**consistently wrong** answer, which two honest machines compute identically and
consensus settles happily. *Silently wrong and verified* is the worst failure
this system has, it was invisible in every editor, and only a known-answer test
finds it.

**`const [q, d] = payload.split(' ')`** destructured only the first two tokens,
so every word after the second was silently discarded — a document scored
against one word of itself.

Both are fixed, and `7/7` kernels now reproduce exactly. The lesson generalises:
**a deterministic kernel can be confidently, verifiably wrong**, and consensus
will not save you. Only a known answer will.

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

- **`need = 3` still yields to a big enough collusion.** Three nodes returning
  the same wrong answer settle a unit. The canary rate is what actually bounds
  this, and an attacker running many nodes gets many rolls of the dice. Both are
  dials; turn them up further before meaningful money flows through work-based
  earnings.
- **Quarantine is per-client-id plus a coarse fingerprint** — better than id
  alone, still **not identity**. A reload costs the attacker all accrued
  balance, which is a real deterrent, but a determined actor who lies about
  their adapter defeats it.
- **The kernels are useful but modest.** `embed`/`score` index a public corpus;
  `matmul` is a real INT8 tile but a tile is not a model. Anyone claiming a few
  browser tabs rival a rented H100 is selling something, and it will not be us.
- **A deterministic kernel can still be wrong.** Consensus proves *agreement*,
  not *correctness* — see the two conformance bugs above. Known-answer tests are
  the only thing that catches this class, and they belong in CI.
- **No work is dispatched unless the operator enqueues it.** An idle queue means
  an idle pool, and `jobsRunning` says so.
