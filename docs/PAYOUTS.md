# THE PAYOUT ENGINE

How contributed compute becomes money, and every place we deliberately made that
harder than it needed to be.

---

## The one architectural rule

> **This service never holds a private key. It cannot sign, and it cannot move
> money.**

`/api/payouts` **plans** (who is owed what), **arms** (freezes an idempotent
batch and emits a `sendmany` spec), and **audits** (records the txid the
operator reports back). The signature happens on the operator's own node, from a
capped hot wallet.

A web service on shared infrastructure holding spend authority is the failure
mode that ends projects. There is no version of this where the convenience is
worth it — so the capability simply is not there to be stolen.

The API says so itself, in every response:

```json
"custody": "This service never holds a private key. It plans, arms and audits; the operator's own node signs."
```

---

## The lifecycle

```
  1. plan     dry run. Who clears the floor, what the batch costs. No state change.
                │
  2. arm      freeze amounts into an immutable batch → emit `sendmany`.
                │
  3.  ⚡ THE OPERATOR SIGNS AND BROADCASTS ON THEIR OWN NODE ⚡
      (outside this service — it is not able to do this step)
                │
  4. settle   operator reports the txid. Contributors marked paid. IDEMPOTENT.
                │
  5. fail     (alternative) release the batch. Nothing is marked paid.
```

`plan`, `arm`, `settle` and `fail` all require `x-live-secret`. If `LIVE_SECRET`
is unset they return `401` — they **fail closed, never open.**

The **result** of every batch is public: `GET /api/payouts` is an open audit log,
with addresses truncated.

---

## ⚠ Idempotency is the property that matters most

A retried request is normal. A payout system that pays twice on retry is a
payout system that drains.

```ts
if (rec.status === 'sent') {
  return Response.json({ ok: true, already: true, batchId, txid: rec.txid });
}
```

Replaying `settle` returns success **without re-crediting anything**. This is
verified live, not assumed — the lifecycle test seeds a balance, settles it,
replays the identical settle, and asserts that:

- the replay reports `already: true`
- the contributor's `open` balance stays `0`
- a second `plan` finds **0 recipients** (the balance cannot be paid twice)
- a settled batch **cannot** be retroactively marked failed

Measured result, 2026-08-12: **all four hold.**

---

## The floor is the off-ramp, not the fee

This is the single most counter-intuitive number in the system.

| | |
|---|---|
| Dash median tx fee | **$0.000069** |
| Batched `sendmany`, per recipient | **~$0.0000108** |
| Dash dust limit | ~$0.000165 |
| **Exchange withdrawal** | **$0.03 – $0.30** |
| **Fiat off-ramp minimum** | **$10 – $25** |

Sending money on Dash is effectively free. **Getting it out is not.** A
contributor cannot exit $0.42 — the withdrawal costs more than the balance.

So the settlement floor is **~$5**, and it exists for *usability*, not for gas.
Balances below it accrue and are shown as held:

> *below the $5 off-ramp floor — accrues until it clears, never expires*

Nothing is rounded away, nothing expires, and the held amount is displayed
publicly so a contributor can see the exact balance waiting for them.

---

## Aggregation is by address, not by node

One contributor may lend several machines. Paying each machine separately burns
the floor for no reason, so the planner aggregates by **payout address** and
sums their MOTUS-seconds before testing the floor.

Their per-node record stays intact for auditing — `GET /api/compute?node=<id>`
returns a single machine's full history, including which DJs it contributed to.

---

## Two rails, two jobs

| | rail | what it is |
|---|---|---|
| **Reward** | **$DASH** | ~2s InstantSend finality, negligible fee, a real off-ramp |
| **Receipt** | **$TRUST** attestation | permanent public record of the contribution |

### ⚠ Contributors cannot earn $TRUST. We will not say they can.

$TRUST emissions go to **veTRUST bonders** — locked stakers — **not** to
off-chain contributors. So "lend your GPU, earn $TRUST" is:

1. **factually wrong** under current mechanics, and
2. a **yield-flavored promise about a traded asset**, which is worse.

The `trust` rail therefore always records `amount: 0`, by design, and the API
carries the correction in its own payload so no client can render it wrong:

> *"TRUST is the RECEIPT, never the reward. Contributors cannot earn $TRUST for
> off-chain work — emissions go to veTRUST bonders. Amount is always 0 by design."*

What Intuition genuinely offers is better than a fake yield:
`deposit(receiver = contributor)` credits **the contributor** with shares while
**we** pay the gas. No viewer wallet, no signature, no gas token, no seed
phrase. A gift, correctly modeled. Cost is ~0.1 TRUST (**≈ $0.0051**) per
attestation, and the canonical `contributed to` predicate already exists
on-chain — we reuse it rather than minting a competitor, so the record is
legible to the rest of the graph.

---

## The declared rate, and why it is stamped

Conversion is an operator-declared rate, not a market price:

```ts
DASH_PER_MOTUS_SECOND: 0.0000004
```

Every batch record stores the `rate` and `dashUsd` **used at the time**, so a
contributor can always audit exactly what rate they were paid at — even if the
rate changes later. A rate you cannot reconstruct after the fact is not a rate,
it is a mood.

---

## What is not built

**Dispatch (rung 5).** No jobs are sent to contributors, so no compute has been
performed and no payout has been earned yet. The engine is complete and tested
so that the accounting exists *before* the work does — which is the correct
order, and the opposite of how most of these systems are built.

`moneyMoved: false` on `GET /api/payouts` is the live proof. It flips the day a
real batch settles, and not one moment before.

---

## ⚠ Testing against production writes public claims

On 2026-08-12 the lifecycle test left **`moneyMoved: true · 10.62 DASH sent`**
on the live public page. No money had moved. It was a test fixture that became a
false public statement.

The test now retracts every claim it makes via an `EXIT` trap, so an interrupted
run cleans up too. If you run it, verify afterwards:

```bash
curl -s https://www.semble.cc/api/payouts | grep -o '"moneyMoved":[a-z]*'
```

The cleanup is not politeness. It is the difference between a test and a lie.
