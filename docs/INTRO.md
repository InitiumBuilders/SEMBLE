# START HERE

**MotusLive is a livestream where the visualizer is not decoration and the
economics are not a promise.**

If you read one page, read this one.

---

## What it actually is

A live page at [semble.cc/live](https://www.semble.cc/live) that streams real
work being built — with a resident cast of eleven **systems-thinking DJs**, each
one a lens on system dynamics rendered as a working universe. Viewers can lend
their GPU to the commons in one click, watch the pool grow, and see exactly what
they are owed.

Three things make it unusual, and all three are checkable rather than claimed:

**① The worlds are models, not wallpaper.** `singularity` projects stars in true
3D and displaces them by the actual gravitational lensing relation
`r' = r + Rs²/r`. `murmuration` is a real boids simulation with no leader.
Each world demonstrates the concept its DJ is named for, or it does not ship.

**② The ledger runs ahead of the work — and says so.** `GET /api/compute`
returns **`jobsRunning: false`** in every response. That value is hard-coded, not
computed, so no surface anywhere can drift into implying that work is happening.
Contribution is tracked, attributed per-DJ, accrued in a real unit, and owed —
before a single job is dispatched.

**③ The uncomfortable findings are published, not buried.** We measured Golem
and ruled it out. We found that contributors **cannot** earn $TRUST and deleted
that promise from every surface. Both are in the docs with receipts.

---

## The 60-second orientation

```
   viewer's browser                    the operator (CortexInsight)
   ───────────────                     ────────────────────────────
   WebGPU probe                        picks what is broadcast
        │                                        │  x-live-secret
        │ POST /api/compute                      ▼
        │ {dj, mode, capability}         POST /api/live
        ▼                                        │
   ┌──────────────────────────────────────────────────────┐
   │  the ledger:  who · how much · whose set · what mode │
   │  accrual in MOTUS-seconds · hourly history           │
   └──────────────────────────────────────────────────────┘
        │                                        │
        │ GET (public telemetry)                 │ POST /api/payouts
        ▼                                        ▼
   the live page                          plan → arm → SIGN ON HIS
   shows totals, history,                 OWN NODE → settle
   per-DJ record, payouts                 (this service holds no key)
```

---

## The units, stated once

Vague units are how dashboards lie. These are the only three:

| Unit | Meaning |
|---|---|
| **capability** | *tab-equivalents.* `1.0` ≈ a typical laptop-class WebGPU adapter. A **relative** measure of pledged capability — **never a FLOPS claim.** |
| **MOTUS-second** | 1 second of capability-1.0 compute. `seconds × capability`. The only accrual unit. |
| **owed** | MOTUS-seconds × the operator's **declared** rate, in $DASH. Stamped into every batch so any contributor can audit the rate they were paid at. |

**A ledger entry is not money.** Money moves only when a batch is armed and
signed on the operator's own node.

---

## The five rungs, and where we actually are

| Rung | What it is | Status |
|---|---|---|
| 1 | Capability probe — measure what the browser can really do | ✅ live |
| 2 | Pledge ledger — record contributions and payout addresses | ✅ live |
| 3 | Telemetry — per-DJ/per-mode attribution, hourly history, accrual | ✅ live |
| 4 | Payout engine — plan → arm → settle, idempotent, audited | ✅ live, unarmed |
| **5** | **Dispatch — real verified work units + receipts** | ✅ **live** |

**All five rungs are up.** Read rung 4 carefully though: the payout engine works
and is tested end to end including replay-safety, but **no money has been sent.**
`moneyMoved: false` on `/api/payouts` is the live proof, and it flips the day a
real batch settles.

Rung 5 came last on purpose. Paying for work you cannot verify is a fraud
faucet, so dispatch waited for consensus checking and canary auditing to exist
first — not the other way round. `jobsRunning` is now **computed** from the
queue rather than hard-coded, because it finally earned the right to be true.

Full design, including everything about it that is still weak:
[`DISPATCH.md`](DISPATCH.md).

---

## The three things we refuse to do

1. **Claim donated GPUs speed up Davara.** She runs on Claude, in Anthropic's
   data centres. No mechanism exists at any price. Lent GPUs run open-weight
   models, render worlds, and crunch public research. Saying otherwise would be
   the easiest lie available, so the copy says exactly this instead.
2. **Say contributors "earn $TRUST" from the protocol.** Emissions go to veTRUST
   bonders, never to off-chain work. ⚠ But **being *paid* in $TRUST is real and
   shipped** — the operator transfers $TRUST they already hold to anyone who
   picks that rail. Same earned value, their currency. The distinction between
   *emissions* and a *transfer* is the whole thing: [`PAYOUTS.md`](PAYOUTS.md#the-three-things-trust-can-be--and-only-one-of-them-was-ever-false).
3. **Hold a private key in a web service.** `/api/payouts` plans, arms and
   audits. It cannot sign. That is structural, not a policy.

## And the one thing we refuse to pay for

**Unverified work.** Every unit is computed by two independent machines and
settles only when they agree; a disagreement credits **nobody**. Roughly 1 unit
in 6 is a known-answer canary the client cannot identify, and failing one
quarantines the node on the spot. Details, including where this is still thin:
[`DISPATCH.md`](DISPATCH.md).

---

## Where to go next

| You want to… | Read |
|---|---|
| understand the system | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| know who the DJs are | [`PANTHEON.md`](PANTHEON.md) |
| add or change a world | [`VISUALS.md`](VISUALS.md) |
| call the API | [`API.md`](API.md) |
| understand the money | [`MOTUSCOMPUTE.md`](MOTUSCOMPUTE.md) · [`PAYOUTS.md`](PAYOUTS.md) |
| check our threat model | [`SECURITY.md`](SECURITY.md) |
| contribute | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

*Motus is the mindset. The mindset means MOVE.* ~aAa
