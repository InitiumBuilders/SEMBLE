# SECURITY & PRIVACY

The threat model for a livestream that broadcasts a working machine.

---

## The core problem

The operator streams live work from a machine that also holds API keys, private
repos, wallet material, and client data. **The interesting failure is not an
attacker breaking in — it is the operator accidentally broadcasting something.**

So the design assumption is: **the operator's machine will eventually be wrong.**
Every protection is built to survive that.

---

## Two gates, not one

**Gate 1 — selection, at the operator's machine.** Nothing is broadcast unless
explicitly chosen. The default is off. There is no "share everything" mode.

**Gate 2 — the API re-scrubs anyway.** `/api/live` does not trust its own
operator. It rebuilds the payload field by field, runs every string against a
credential-shape blocklist, and drops anything that matches. A string that
scrubs to empty is discarded rather than broadcast blank.

Blocked shapes:

```
sk-…  sk_…  ghp_…  github_pat_…  xox[baprs]-…
-----BEGIN … PRIVATE KEY-----   AKIA…   JWTs (eyJ….…)   xpub…   0x…62+ hex
```

Two independent gates, and the second does not trust the first. One gate is a
single point of failure; this is the cheapest possible redundancy.

---

## Size caps as a security control

Every field is capped (`goal` 400 chars, `items` 24 × 500, `agents` 8 × 240).

Caps are not just for storage. **A truncated leak is a smaller leak.** A capped
field cannot carry a pasted key file, a full env dump, or a stack trace with
tokens in it. When a cap and a feature disagree, the cap wins.

---

## MotusCompute: refuse, don't sanitize

The pledge endpoint takes payout addresses, which sit one typo away from the
most dangerous string a user can type.

**We refuse rather than clean.** Anything matching a private-key or seed-phrase
shape is rejected outright with an error that says why — before validation,
before storage, before anything:

```ts
const NEVER = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bxprv[0-9A-Za-z]{50,}/,
  /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/,   // WIF
  /\b0x[a-fA-F0-9]{64}\b/,                   // raw EVM key
];
```

Sanitizing a secret means it was accepted, processed, and stored in some form.
Refusing means it never entered the system, and the user learns *why* — which is
the part that protects them next time, on some other site.

Addresses are then positively validated (`^[X7]…` for Dash, `^0x[a-f0-9]{40}$`
for EVM), so a mistyped key cannot slip through as an "address."

---

## What the public ledger deliberately does not expose

- **Addresses are truncated** in `recent` (`Xk4f2p…9dLm`) — enough to recognise
  yourself, never enough to build a mailing list of crypto holders.
- **`recent` is capped at 24** and only includes nodes seen in the last 5
  minutes. It is a live view, not an archive.
- **No IP addresses, no user agents, no fingerprints** beyond the WebGPU
  capability numbers the contributor's browser volunteers.
- **No accounts.** There is nothing to breach because there is nothing stored.

---

## SourceCrowd abuse handling

| Control | Behaviour |
|---|---|
| **Honeypot** | A non-empty `web` field returns `{ ok: true }` and stores nothing. Bots receive a success indistinguishable from a real one. |
| **Rate limit** | 20 seconds between posts, per voice. → `429 one breath between sembles — 20s` |
| **Credential scrub** | → `400 that looks like a credential — not in the room, ever` |
| **Vote integrity** | One vote per voice per message; re-voting is idempotent, not an error. |
| **Moderation** | `DELETE /api/chat`, operator secret required. |

The honeypot returning `ok: true` is deliberate. An error tells a bot its input
was rejected and to retry differently; a success tells it nothing.

---

## Auth

`LIVE_SECRET` gates every privileged operation. If it is unset, those operations
return `401` — **they fail closed, never open.** A missing env var must never
become an open door. The secret is server-side only and never reaches the
browser in any code path.

---

## The public-repo scrub gate

Before anything is pushed to a public repo, scan **what is actually about to be
pushed**, not what you remember writing:

```bash
git grep -nEi "sk-[A-Za-z0-9]{20,}|ghp_|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN|xprv|BLOB_READ_WRITE_TOKEN=" HEAD
```

**Never publish:** relay hostnames, tunnel names, internal service names, real
user ids, or `.env` files of any kind. Env var *names* in code are fine — values
never are.

One note on reading scan output: the compute route legitimately *contains*
private-key regexes, because refusing them is its job. A scanner will flag those
lines. **Read every hit rather than pattern-matching the count** — "3 hits, all
of them refusal patterns" is a pass; "3 hits" alone is not a review.

---

## Money: the capability is absent, not merely guarded

`/api/payouts` **cannot sign a transaction.** There is no key in the service, no
key in its environment, and no code path that would use one. It plans, arms and
audits; the operator signs on their own node from a capped hot wallet.

This is deliberately stronger than "the key is protected." A guarded key can be
stolen. An absent capability cannot.

Supporting controls:

| Control | Why |
|---|---|
| **Idempotent `settle`** | A replayed settle returns `already: true` and re-credits nothing. Retries are normal; double-paying on retry is how a treasury drains. |
| **A settled batch cannot be failed** | → `409`. History is append-only in the direction that matters. |
| **Amounts frozen at `arm`** | The batch stores its own `rate` and `dashUsd`, so a later rate change cannot retroactively alter what was owed. |
| **Aggregation by address** | One contributor with several machines is paid once, not N times below the floor. |
| **Fail-closed auth** | No `LIVE_SECRET` ⇒ `401` on every op, including `plan`. Balance-per-address is operational detail, not public data. |
| **Explicit confirm in CortexInsight** | `arm` and `settle` reject unless the client passes `confirmed`, so a stray click in a dashboard cannot freeze or settle a batch. |

⚠ **Address poisoning is the obvious attack on a public livestream.** Never
accept a payout address pasted into stream chat without out-of-band
confirmation.

---

## ⚠ Testing a money rail against production writes public claims

On 2026-08-12 the payout lifecycle test ran against production and left
**`moneyMoved: true · 10.62 DASH sent`** on the live public page. No money had
moved. A test fixture had become a false public statement, visible to anyone.

It was caught and retracted within minutes, and the test now cleans up via an
`EXIT` trap so an interrupted run still retracts. But the general lesson is
worth more than the fix:

> **A test that writes to a public surface is a publication.** Treat its output
> with the same care as a claim you make deliberately — because to a reader,
> there is no difference.

If you run any test against production, verify the retraction afterwards:

```bash
curl -s https://www.semble.cc/api/payouts | grep -o '"moneyMoved":[a-z]*'
```

---

## Known limits — stated, not hidden

- **Rate limiting is per-voice**, which a determined actor can rotate. It stops
  noise, not a motivated attacker.
- **Blob storage is eventually consistent**, and the fresh-path pattern defeats
  stale reads without providing transactions. ⚠ **This used to mean concurrent
  writes silently lost updates — and it was much worse than "acceptable".**
  Measured against production: **6 concurrent pledges registered 2**, and
  **6 × 60s of contributed time recorded 120s of 360s — 67% lost.** It was
  written off as tolerable back when the ledger only carried broadcast state; by
  then it carried work results and accrual, so a lost update meant a
  contributor's completed work vanishing — and it got *worse* the more people
  showed up, which is exactly the situation the project exists to create.
  **Fixed** by making writes append-only (see below). Re-measured: **6 of 6
  nodes, 360 of 360 seconds, zero loss.**
- **The credential blocklist is shape-based.** It catches known formats. A novel
  secret format would pass, which is exactly why Gate 1 (selection) exists.
- **`jobsRunning: false` is a promise about today.** When dispatch ships, this
  document and that field change together, in the same commit.

Found something? Open an issue — or for anything sensitive, contact the operator
directly rather than filing publicly.
