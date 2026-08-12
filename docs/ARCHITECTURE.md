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

## 6 · What is deliberately absent

- **No user accounts.** Contributors are recognised by a self-generated id, not
  by identity. Nobody has to sign up to move.
- **No stored balances.** A stored viewer balance is prepaid value and drags in
  money-transmission framing. "This job runs now" does not. Same UX, very
  different regulatory surface.
- **No analytics beyond what the page renders.** No third-party tags.
- **No private work on the compute path, ever, by protocol.** Published attacks
  reconstruct original prompts from the intermediate activations that peers see.
  Public-work-only is enforced by design, not by policy.
