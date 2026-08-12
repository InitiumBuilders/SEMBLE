# MOTUSCOMPUTE

> *Lend a machine to the stream. Take the receipt. Get paid when there is
> something to be paid for.*

A protocol for livestream viewers to contribute compute to the work being
streamed — and a document that is equally clear about what it does **not** do.

---

## ⚠ Status, first, in plain words

**All 5 rungs live. Work is dispatched, computed and VERIFIED; contributors get
receipts. The payout engine is built and tested on both rails. No money has been
sent yet — `moneyMoved: false` is the live proof.**

`jobsRunning` on `/api/work` is **computed from the queue** — true when units are
open or verifying, false when they are not. For rungs 1–4 it was deliberately
hard-coded `false` so that no surface could imply work was happening while
dispatch was unbuilt. It earned the right to be true.

If you pledge a machine today and press **START COMPUTING**, what actually
happens is: your browser claims a unit, computes it with integer-only math,
submits a digest, and an independent machine computes the same unit. If the two
digests agree the unit settles, both machines are credited, and **you get a
receipt** naming the unit, the task it fed, and the digest you can re-verify
yourself.

What has *not* happened is payment. The payout engine is built and tested on
both rails, but no batch has been armed and sent — `moneyMoved: false` on
`/api/payouts` is the live proof, and it will flip the day that changes.

Being straight about this is the point. A compute-donation page that implies
your GPU is spinning when it is not — or that money moved when it did not — is
the exact failure this project is built to avoid.

---

## The five rungs

| Rung | What it is | Status |
|---|---|---|
| 1 | Capability probe — measure what the browser can actually do | ✅ live |
| 2 | Pledge ledger — record contributions and payout addresses | ✅ live |
| 3 | Telemetry — per-DJ/per-mode attribution, hourly history, accrual | ✅ live |
| 4 | Settlement — plan → arm → settle, idempotent, publicly audited | ✅ **live, unarmed** |
| 5 | Dispatch — real work units, verified by consensus + canaries | ✅ live |

**Rung 4 before rung 5 is deliberate.** The accounting exists before the work
does, so that when the first job runs there is already a tested, auditable,
replay-safe path for paying for it. Building dispatch first and bolting
accounting on afterwards is how you end up unable to prove what anyone is owed.

---

## Why the browser, and not a "real" compute network

Because **the browser is the only door a viewer can actually walk through.**

We researched the alternatives against their own live APIs rather than their
marketing. The results decided the architecture:

### ❌ What we ruled out, and why

**Golem — ruled out, and it is not close.**
- **Zero GPUs exist on the network.** Not few. 168 hourly samples across 7 days,
  both runtimes, `gpus = 0` at every sample. All-time peak was 24 GPUs, in
  November 2024.
- **Golem's own docs team deleted the GPU section** on 2026-08-06 (commit
  `cbd25e02`) with the message that it *"documents a product that no longer
  exists."* Their marketing site still advertises "gamers' graphics cards" and
  links to the page they deleted.
- **A viewer physically cannot contribute.** Provider = Linux x86-64 only, with
  `/dev/kvm` nested virtualization enabled in BIOS, an 8.6 GB image flashed to a
  64 GB USB SSD, and **you reboot into a different operating system** that binds
  your GPU to VFIO passthrough. Their doc: *"your monitor might go blank, this
  is normal."* No Windows provider. No macOS provider. No browser node.
- The one project aimed at exactly our use case — `gamerhash-facade`, for gamer
  rigs — **has been dead since October 2024.**
- All-time network-wide earnings: **~$26,000**, across every provider, ever.
  Median provider lifetime earnings: **$0.03**.

Golem's requirements would delete 100% of a livestream audience. We are building
what their marketing describes but does not deliver.

**RunPod — the literal version is impossible; the money version is clean.**
RunPod stopped accepting new Community Cloud hosts, so a viewer cannot list a
GPU there at all. What works is the inverse: **viewers fund, the operator
dispatches** to our own Serverless endpoint, API key server-side only. That path
is genuinely good — a 3-second 8B generation costs about **$0.001**.

⚠ Two hard constraints on it: the API key can never touch the browser (no origin
binding, no short-lived tokens, no per-key spend cap; default account ceiling is
$80/hour), and the model must be baked into the image or a network volume or
every viewer-triggered job eats a 60–120 second cold start *on camera*.

### ✅ What we chose

| Job | Rail | Why |
|---|---|---|
| **Reward — default** | **$DASH** | ~2s InstantSend finality, median fee **$0.000069**, a real off-ramp |
| **Reward — by choice** | **$TRUST transfer** | same earned value, sent from the operator's own holdings |
| **Receipt** | **$TRUST attestation** | permanent public record that you contributed; zero value moved |
| **Meaning** | **MOTUS** | the move itself, on our own rails |

**⚠ The distinction that matters, stated exactly.** There are three different
things people mean by "$TRUST" here and only one of them was ever false:

- **❌ Emissions** — "lend your GPU, earn $TRUST from the protocol." Wrong.
  Emissions go to **veTRUST bonders**, never to off-chain contributors. It is
  also a yield-flavored promise about a traded asset, which is worse than merely
  wrong. **We never say it.**
- **✅ Transfer** — "get paid in $TRUST if you prefer." Shipped. The operator
  sends $TRUST they already hold to whoever picked that rail. An ordinary
  payment in a currency of choice.
- **✅ Attestation** — a permanent record of contribution. No value moves, and
  that is the point: it is a receipt, not a reward.

What Intuition *does* give us for the attestation is genuinely valuable:
`deposit(receiver = contributor)` credits **the contributor** with shares while
**we** pay the gas. No viewer wallet, no signature, no gas token, no seed
phrase. A gift, correctly modeled. The canonical `contributed to` predicate
already exists on-chain with 49 triples — we reuse it rather than minting a
competing one, so the attestation is legible to the rest of the graph. Cost:
**~0.1 TRUST ≈ $0.0051 per triple**, about **$2.57** for a 500-viewer stream.

---

## The four hard truths this design obeys

**① Donated GPUs cannot make Davara faster.** She runs on Claude, in Anthropic's
data centres. There is no mechanism at any price for a viewer's card to serve a
Claude token. MotusCompute powers a **second, open-weight brain** beside her —
never a speed-up of her. Anyone claiming otherwise is selling something.

**② You cannot trust a result you did not compute.** A volunteer can return
garbage, or nothing, and claim payment. This is *the* problem of volunteer
computing, older than crypto. Redundant execution with agreement checks and
spot-audited canary units is the answer; paying for unverified work is a fraud
faucet. **This is now built** — every unit is computed twice and settles only on
agreement, and ~1 in 6 is a known-answer canary the client cannot identify. See
[`DISPATCH.md`](DISPATCH.md), which also lists where it is still thin.

**③ You cannot send private work to strangers' machines.** Published attacks
(ACM CCS 2025) reconstruct original prompts from the intermediate activations
peers see. MotusCompute is **public-work-only, by protocol, not by policy.**

**④ Tiny on-chain payments are usually theatre.** On Dash the *fee* is genuinely
trivial — batched `sendmany` costs about **$0.0000108 per recipient**. But the
**off-ramp** is the real floor: exchange withdrawals run $0.03–$0.30 and fiat
off-ramps want $10–$25. **A contributor cannot exit $0.42.** So per-tick amounts
are ledger entries, and settlement happens above roughly **$5**.

---

## What we ask you for, and what we refuse

**Optional:** a $DASH receiving address, a $TRUST (EVM) receiving address.
Contributing with neither is a first-class path — you can lend a machine and
take the receipt without ever naming a wallet.

**Refused outright, with an error explaining why:** anything shaped like a
private key, a seed phrase, an `xprv`, or a WIF key. The API rejects these
*before* validation, before storage, before anything else.

> *That looks like a PRIVATE KEY or a recovery phrase — never paste one
> anywhere. Use your receiving ADDRESS only.*

**Never paste a seed phrase into any website, including this one.** A receiving
address is public by design and safe to share. A private key is the money
itself.

⚠ **Address poisoning is the obvious attack on a public livestream.** Never
accept a payout address pasted into stream chat without out-of-band
confirmation.

---

## The honest headline

The valuable thing here is **not** the FLOPs. A handful of browser tabs will
never rival a rented H100, and pretending otherwise would be the whole scam.

The valuable thing is that **lending a machine is the cheapest first move a
stranger can make** — cheaper than money, cheaper than signing up, one click
from a livestream. MotusCompute is not an infrastructure play wearing a
community hat. It is a community play wearing infrastructure clothes, and it is
designed for the first mover rather than the first teraflop.
