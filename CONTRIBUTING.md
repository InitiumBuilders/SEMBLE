# CONTRIBUTING

This project is built in public, on stream. Contributions are welcome — and the
bar is specific rather than high.

---

## Run it

```bash
cd site && npm install && npm run dev
```

No environment variables needed. The live page renders every world and every DJ
against local state. You only need env vars to broadcast — see the
[README](README.md#run-it).

---

## The three rules

### 1 · Meaning before motion

Every world models the systems concept its DJ is named for. Every power is a
named mechanism (reinforcing loop, balancing loop, network effect). If you add
something visual that carries no meaning, it will be asked to justify itself and
usually removed.

**Ask: what does this *mean*?** If the answer is "it looks cool," it is
decoration, and decoration is the thing this project is trying not to be.

### 2 · Measure, don't eyeball

Visual changes need the pixel audit — render offscreen, count lit pixels, demand
a floor. See [`docs/VISUALS.md`](docs/VISUALS.md#the-pixel-audit).

This is not ceremony. A world once rendered **effectively black** and survived
three separate "fixes" because a dark canvas behind a dark UI reads as
intentional. A screenshot is not a measurement.

### 3 · Honest status, always

If something is staged, say staged. If it is unverified, say unverified. This
repo documents its own dead ends — that Golem was ruled out, that no compute
jobs are dispatched, that `jobsRunning` is hard-coded `false`.

**A README that overstates is a bug with a long tail.** Partial-but-honest beats
complete-but-reckless, every time.

---

## Good first contributions

| | Where to start |
|---|---|
| **A new world** | [`VISUALS.md → Adding a world`](docs/VISUALS.md#adding-a-world) |
| **A new DJ** | [`PANTHEON.md → Adding a DJ`](docs/PANTHEON.md#adding-a-dj) |
| **Mobile polish** | Verify at **375px** first — mobile is the primary target, not an afterthought |
| **Performance** | The heavy worlds are `murmuration` and `singularity`. Profile before optimizing. |
| **Docs** | If something here was wrong or unclear, that is a real bug. Fix it. |

---

## Design constraints (non-negotiable)

- **Squircles**, 16–24px radius. Not pills, not plain boxes.
- **No grey body text.** Secondary hierarchy comes from size, weight and width —
  never from washing the ink out.
- **Glow, never hard highlight.**
- **No artsy or illegible fonts.**
- **Mobile-first, verified at 375px.**
- **Colours come from `ctx.hue`/`ctx.hue2`** — never hard-coded. The page themes
  itself from the active DJ.
- **Animate only what is on screen.** Pause offscreen work.
- 🚫 **Permanently banned:** the rotating background box/rectangle that spins
  with the viewport. Not here, not anywhere.

---

## Code style

- **No build step for the three core files.** `pantheon.js`, `viz.js` and
  `live.js` are plain browser JavaScript, readable and debuggable in DevTools
  with no source map. Keep them that way.
- **`viz.js` stays pure** — no DOM, no timers, no network. That purity is what
  makes the audit possible.
- **`pantheon.js` stays data** — no functions, no imports.
- Comments explain **why**, not what. The existing comments are the model:
  they document the bug that caused the code to look the way it does.

---

## Pull requests

1. Say what changed and **why it matters** — the systems reason, not just the diff.
2. Include the pixel-audit result for visual changes.
3. Verify at 375px for anything that touches layout.
4. Note anything you did **not** verify. That note is worth more than a
   confident claim you can't back.

## Security

Never commit secrets, relay hostnames, tunnel names, or internal service names.
Env var *names* in code are fine; values never are. Full model and the pre-push
scan in [`docs/SECURITY.md`](docs/SECURITY.md#the-public-repo-scrub-gate).

For sensitive reports, contact the operator directly rather than filing a public
issue.

---

*Motus is the mindset. The mindset means MOVE.* ~aAa
