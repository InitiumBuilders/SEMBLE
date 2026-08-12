# ARCHITECTURE

How MotusLive actually works, and why it is built the way it is.

---

## 1 · Four moving parts

```
   ┌────────────────────┐        selected state only
   │   CortexInsight    │ ───────────────────────────────┐
   │  (operator's app)  │   POST /api/live  x-live-secret │
   └────────────────────┘                                 ▼
                                              ┌───────────────────────┐
   ┌────────────────────┐   GET /api/live     │      Vercel Blob      │
   │   the live page    │ ◄───────────────────│   (fresh-path JSON)   │
   │  semble.cc/live    │   GET /api/chat     └───────────────────────┘
   │                    │   GET /api/compute              ▲
   │  pantheon → viz    │                                 │
   │       ↕ live.js    │ ── POST /api/chat ──────────────┘
   └────────────────────┘    POST /api/compute
            │
            └──► YouTube (nocookie / relay instance) — audio only
```

**The operator app is the only writer of broadcast state.** The public page can
write to exactly two places — the SourceCrowd thread and its own compute pledge —
and both are scrubbed, capped and rate-shaped on the server.

There is no database, no user accounts, and no session store. That is not a
shortcut; it is the privacy model. **What does not exist cannot leak.**

---

## 2 · The three client files

### `pantheon.js` — the canon (data only)

Exports `window.PANTHEON = { djs: [...], powers: [...] }`. Every DJ carries:

| field | purpose |
|---|---|
| `id` `name` `say` | identity and pronunciation |
| `meaning` | why the name exists — the etymology, in his words |
| `power` `rung` `ability` | the systems concept and its depth on the ladder |
| `vibe` | the sound |
| `scene` | **the binding key** — which world in `viz.js` renders this DJ |
| `hue` `hue2` | the two-colour palette that themes the entire page |
| `bpm` `setMin` | tempo and set length |
| `query` | the search phrase used to find a live stream |

No functions. No imports. You can read the whole canon as JSON, and forks can
replace it wholesale without touching a line of engine code.

### `viz.js` — the render engine (pure)

Exports `window.MOTUSVIZ` with three methods:

```js
M.render(ctx, sceneName, colors)          // draw one frame of a world
M.renderAmbient(ctx, sceneName, colors)   // same world, background intensity
M.reset()                                 // clear all particle state
```

It holds **no DOM references and no timers.** It draws when called. That is what
makes the pixel-audit harness possible (see [`VISUALS.md`](VISUALS.md#the-pixel-audit)) —
you can render any world to an offscreen canvas and count lit pixels, with no
page and no browser chrome involved.

⚠ **The one structural rule:** ambient and foreground each get their **own
private particle state** (`P_MAIN`/`P_AMB`, `FLOCK_MAIN`/`FLOCK_AMB`). This is
not tidiness. Sharing that state caused a real, hard-to-find bug: a single `NaN`
in the shared field propagated through the flocking neighbour terms and rendered
an entire world black, in a way that looked like a design choice. Keep them
separate.

### `live.js` — the vibe engine (all the state)

Owns the state machine, the stream cycler, the UI, and every network call.
The state object is small and readable on purpose:

```js
S = { dj, power, playing, mode, gesture, ... }
```

- **`mode`** — `direct` (default) or `relay`. See §4.
- **`gesture`** — false until the first real user interaction. It is the *only*
  thing that decides `mute=0` vs `mute=1` on the embed, because browsers will
  refuse to autoplay audible media without one. Getting this wrong makes a music
  stream silently mute, which looks exactly like "the stream is broken."

---

## 3 · Why storage uses a *fresh path* every write

Vercel Blob is CDN-fronted. Overwriting the same pathname serves **stale reads**
for an unbounded window — we measured a push reading back state that was twenty
minutes old. Retries do not help; the CDN is doing exactly what it was told.

So `_blob.ts` never overwrites. Every write goes to a **new, monotonically
sortable path**:

```ts
const path = `${prefix}${Date.now().toString().padStart(14,'0')}.json`;
```

Reads list the prefix and take the newest. Writes prune to two generations, so
storage stays flat. This turns a cache-coherence problem into a sorting problem,
which is the trade you want.

**If you fork this and switch to a real database, delete this whole mechanism.**
It exists to work around a specific CDN behaviour, and it is dead weight anywhere
else.

### ⚠ …and why writes are append-only

The fresh-path pattern fixed stale *reads*. It did nothing for concurrent
*writes*, because every write still carried a whole snapshot read moments
earlier — classic read-modify-write with no compare-and-swap. Two overlapping
requests both read state S, both write their own S′, and the second silently
erased the first.

Measured against production before the fix:

| | |
|---|---|
| 6 concurrent pledges | **2 registered** — 4 lost |
| 6 × 60s contributed | **120s of 360s stored** — 67% lost |

This is the worst class of bug this project can have: **silent, invisible to the
contributor, and it gets worse as more people arrive** — the exact situation the
whole design is built to create.

So writers stopped overwriting shared state:

```ts
appendEvent(prefix, ev)   // one immutable event, its own unique path
readEvents(prefix)        // readers fold the stream over the last snapshot
dropEvents(prefix, upTo)  // compaction, only after the snapshot includes them
```

Concurrent writers **cannot collide by construction** — each owns its path. The
fold is idempotent per `(id, ts)`, so a failed prune costs a slower read and
never a double-count. Re-measured after: **6 of 6, 360 of 360, zero loss.**

⚠ **Every reader folds, or none of them do.** Converting the compute route alone
left the work route reading the raw snapshot, so it could not see any node that
had pledged since the last compaction — settled units credited *nobody*, at
`+0 MOTUS-s`. Half-converting a shared ledger is worse than not converting it.

---

## 4 · The two stream modes

| Mode | What it is | Trade |
|---|---|---|
| **DIRECT** (default) | `youtube-nocookie.com` embed | Reliable, instant, may show ads |
| **RELAY** | a privacy front-end instance (Invidious/Piped family) | Ad-free when it works; instances are volunteer-run and frequently down or gated |

DIRECT is the default because RELAY is not dependable enough to be one. Relay
instances rotate, rate-limit, and sometimes serve a bot-check interstitial that
hangs forever inside an iframe — which is why the mode toggle always re-mounts
the player and always renders a visible **bail-out** control. A mode that can
fail silently is worse than a mode that shows ads.

---

## 5 · The CortexInsight bridge

CortexInsight (August's desktop app, closed-source) is the operator surface. It:

- picks what is broadcast — `onAirCandidates()` → `onAirAutoPick()` → `onAirPush()`
- signs writes with `x-live-secret`
- reads back `GET /api/compute` for the pooled-resources dashboard
- can wipe the pledge ledger via `DELETE /api/compute`

**Nothing in this repo depends on CortexInsight existing.** The API is a plain
HTTP surface; any operator client that holds the secret can drive it. The desktop
app is a convenience, not a dependency — a fork can drive `/api/live` with `curl`.

---

## 6 · The money path, and where it deliberately stops

```
  browser ──POST /api/compute──►  ledger (attribution + accrual)
                                      │
  operator ──POST /api/payouts──►  plan → arm ──► sendmany spec
                                                       │
                              ┌────────────────────────┘
                              ▼
                    ⚡ SIGNED ON THE OPERATOR'S OWN NODE ⚡
                       (this service is not able to do this)
                              │
  operator ──POST settle──►  txid recorded · contributors marked paid
```

**The break in that chain is the security model.** `/api/payouts` can compute a
payment and prove one happened; it can never make one happen. A web service on
shared infrastructure holding spend authority is the failure mode that ends
projects, so the capability simply is not there to be stolen.

Full detail, including the idempotency proof and why the settlement floor is the
off-ramp rather than the fee: [`PAYOUTS.md`](PAYOUTS.md).

---

## 7 · Two lessons this codebase paid for

**① A green deploy is not a live deploy.**
`deploy-semble.sh` hard-coded `--project v0-deploy-html-file`. After the Vercel
project was renamed, that flag made the CLI link to a *different, empty project
of that name*. The deploy reported `✓ Ready`, aliased cleanly, and **semble.cc
never moved** — new API routes 404'd in production while working perfectly on
the deployment URL.

The fix is two rules, both now in the script: **pin by `projectId`** (a rename
cannot change it) and **verify against the real domain** before claiming success.
The verify step retries with backoff, because a fresh route needs a moment to
reach every edge and a single check after a fixed sleep produced a false 404 on
a route that was fine.

**② A derived metric drifts from the thing it claims to measure.**
The hourly history bucket originally computed `motusSeconds` as
`bucket.seconds × bucket.capability`. That reported **11,010** where true accrual
was **3,225** — a 3.4× over-count — because bucket capability is the whole live
pool while bucket seconds belong to individual beats.

It is now **accumulated at write time** from each beat's real accrual, and the
harness asserts `Σ history.motusSeconds ≤ motus.accrued` every run. The chart and
the payout engine must read the same number, or the chart is decoration.

---

## 8 · What is deliberately absent

- **No user accounts.** Contributors are recognised by a self-generated id, not
  by identity. Nobody has to sign up to move.
- **No stored balances.** A stored viewer balance is prepaid value and drags in
  money-transmission framing. "This job runs now" does not. Same UX, very
  different regulatory surface.
- **No analytics beyond what the page renders.** No third-party tags.
- **No private work on the compute path, ever, by protocol.** Published attacks
  reconstruct original prompts from the intermediate activations that peers see.
  Public-work-only is enforced by design, not by policy.
