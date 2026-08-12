# MOTUSCOMPUTE

> *Lend a machine to the stream. Take the receipt. Get paid when there is
> something to be paid for.*

A protocol for livestream viewers to contribute compute to the work being
streamed — and a document that is equally clear about what it does **not** do.

---

## ⚠ Status, first, in plain words

**Rung 2 of 5. Pledges are recorded. No jobs are dispatched. Nothing is paid.**

`GET /api/compute` returns `jobsRunning: false` in every single response. That
field is hard-coded, not computed, so no surface anywhere can imply work is
happening when it is not.

If you pledge a machine today, what actually happens is: your browser's WebGPU
capability is measured, that measurement plus an optional payout address is
recorded in a public ledger, and you appear in the pool. **That is the whole
current behaviour.** It is a real thing — a pool exists, it is visible, it is
yours — and it is not yet compute.

Being straight about this is the point. A compute-donation page that implies
your GPU is spinning when it is not is the exact failure this project is built
to avoid.

---

## The five rungs

| Rung | What it is | Status |
|---|---|---|
| 1 | Capability probe — measure what the browser can actually do | ✅ live |
| 2 | Pledge ledger — record contributions and payout addresses | ✅ live |
| **3** | **Dispatch — real WASM/WebGPU work units, verified** | 🔨 next |
| 4 | Settlement — $DASH payouts above the practical floor | ⏳ designed |
| 5 | Attestation — permanent public record on Intuition | ⏳ designed |

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
| **Reward** | **$DASH** | ~2s InstantSend finality, median fee **$0.000069**, and a real off-ramp |
| **Receipt** | **$TRUST** attestation | permanent public record that you contributed |
| **Meaning** | **MOTUS** | the move itself, on our own rails |

**⚠ The correction that matters most: you cannot earn $TRUST for donated
compute, and we will never say that you can.** $TRUST emissions go to veTRUST
bonders — locked stakers — not to off-chain contributors. Any page saying "lend
your GPU, earn $TRUST" is factually wrong under current mechanics *and* is a
yield-flavored promise about a traded asset. **TRUST is the receipt. DASH is the
reward. Never the reverse.**

What Intuition *does* give us is genuinely valuable: `deposit(receiver =
contributor)` credits **the contributor** with shares while **we** pay the gas.
No viewer wallet, no signature, no gas token, no seed phrase. A gift, correctly
modeled. The canonical `contributed to` predicate already exists on-chain with
49 triples — we reuse it rather than minting a competing one, so the attestation
is legible to the rest of the graph. Cost: **~0.1 TRUST ≈ $0.0051 per triple**,
about **$2.57** for a 500-viewer stream.

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
faucet. This is why rung 3 is hard and why it is not shipped yet.

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
