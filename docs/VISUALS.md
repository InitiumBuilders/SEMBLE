# THE VISUAL ENGINE

[`site/public/viz.js`](../site/public/viz.js) — 775 lines, no dependencies, no
DOM, no timers. Eleven worlds, five power layers, three overlays.

**The rule the whole engine is built on:** a world is not a background. It is a
*working model of the systems concept its DJ is named for*. If a world does not
demonstrate its concept, it is decoration and it does not ship.

---

## The API

```js
MOTUSVIZ.render(g, sceneName, colors)         // one foreground frame
MOTUSVIZ.renderAmbient(g, sceneName, colors)  // same world, ambient intensity
MOTUSVIZ.reset()                              // clear all particle state
```

Every world function has the signature `(g, ctx)` where `g` is a 2D context and:

```js
ctx = { t, e, drop, phrase, W, H, hue, hue2, v, DPR, count }
```

| field | meaning |
|---|---|
| `t` | time, seconds |
| `e` | energy 0–1 — the master intensity dial |
| `drop` | 0–1, spikes at a drop |
| `phrase` | musical phrase position |
| `W` `H` `DPR` | canvas dimensions and device pixel ratio |
| `hue` `hue2` | the current DJ's two colours |
| `v` | audio-reactive value |
| `count` | live viewer count (drives `crowd`) |

---

## The four techniques

Everything visually good in here comes from four choices. Learn these and the
code reads easily.

**① Trails, not clears.** No world calls `clearRect`. Each paints a translucent
black rectangle over the previous frame, so motion leaves light behind. The
per-world opacity is the `FADE` table:

```js
const FADE = {
  singularity: .09, keystone: .13, feedback: .06, murmuration: .045, liquid: .08,
  spectrum: .16, shatter: .18, turbulence: .04, rings: .05, portal: .10, chorus: .09,
};
```

Lower = longer trails. `turbulence` at `.04` smears across ~25 frames;
`shatter` at `.18` is nearly crisp. **This one table controls the entire feel of
the engine** — it is the first thing to tune and the easiest thing to get wrong.

**② Additive compositing.** `globalCompositeOperation = 'lighter'` so overlapping
particles *sum* toward white instead of painting over each other. This is what
makes dense regions glow like real light rather than looking like stacked stickers.

**③ Pre-rendered glow sprites.** Radial gradients are expensive per-particle. The
engine renders a small glow sprite once to an offscreen canvas and `drawImage`s
it thousands of times. Same look, an order of magnitude faster — this is the
single reason the heavy worlds hold frame rate on a phone.

**④ Real physics, where the concept is physical.** `singularity` projects stars
in true 3D (`k = F/(F+z)`) and displaces them by the actual lensing relation
`r' = r + Rs²/r`, so the sky visibly folds into an Einstein ring behind the hole.
Relativistic beaming brightens the approaching side of the disk. It looks right
because it *is* right.

---

## The eleven worlds

| World | DJ | The concept it models |
|---|---|---|
| `singularity` | DJ DAOZ | A lensed black hole. Paradigm shift = the frame collapsing past its own event horizon |
| `keystone` | Qoreus | One node whose removal restructures the whole graph — leverage, drawn |
| `feedback` | DJ Frequest | Closed loops with signal circulating; gain visibly compounding |
| `murmuration` | DJ DaoMode | Boids. No leader, no plan, coherent flock — emergence and stigmergy |
| `liquid` | DJ WaveSide | Stocks filling and draining through flows |
| `spectrum` | DJ Freqro | Information decomposed into bands — the signal, seen |
| `shatter` | DJ Raze | Structure breaking so the pieces can recombine |
| `turbulence` | DJ Nauz | Flow past a critical threshold; where resonance is found |
| `rings` | DJ Sâv | Growth rings — the system's accumulated history, readable |
| `portal` | DJ Auxtro | A boundary opening; what was outside becomes inside |
| `chorus` | DJ Audea | Many independent voices resolving into one emergent harmony |

Plus **five power layers** (`hype`, `vibez`, `crowdrise`, `dauozi`, `decentro`)
and **three overlays** (`crowd`, `scan`, `nodes`) that compose on top of any world.

---

## ⚠ The state-separation rule

Foreground and ambient rendering each hold **private** particle state:

```js
const P_MAIN = mkField(N), P_AMB = mkField(N);
const FLOCK_MAIN = [], FLOCK_AMB = [];
```

`renderAmbient` swaps the pointers, renders, and restores them in a `finally`.

**Do not "simplify" this into shared state.** It was shared once. A single `NaN`
entering the field propagated through the boid neighbour terms and rendered an
entire world black — and because a black canvas behind a dark UI looks
intentional, it survived three wrong fixes before the cause was found. The
separation is load-bearing.

---

## The pixel audit

Because `viz.js` is pure, every world can be verified without a browser: render
it offscreen for ~40 frames, count non-black pixels, and require a floor.

```js
// render each world offscreen, then:
const lit = countLitPixels(imageData);
if (lit < FLOOR) throw new Error(`${world} rendered ${lit}px — effectively black`);
```

**Run this on every visual change.** "It looked fine in a screenshot" is not a
measurement — the black-world bug passed visual inspection repeatedly.

One field note worth keeping: when the count came back *exactly* 30 every single
time, that constancy was the tell. A real render fluctuates. An exact repeat
meant the audit was measuring one static element and nothing else.

---

## Adding a world

1. Add a function to `WORLDS` with the `(g, ctx)` signature.
2. Add its `FADE` entry. Start at `.08` and tune from there.
3. Use `ctx.hue`/`ctx.hue2` — **never hard-code a colour.** The page themes
   itself from the active DJ, and a hard-coded hue breaks that instantly.
4. Respect `ctx.e` as the master intensity so `vibez` can actually calm it down.
5. Bind it from a DJ's `scene` field in `pantheon.js`.
6. Run the pixel audit.

**Banned, permanently:** the rotating background box/rectangle that spins with
the viewport. Never in this project, never in any other.
