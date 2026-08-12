# THE PANTHEON

Eleven identities. Each one is a **lens on system dynamics** with a sound, a
palette, and a universe that renders the concept it is named for.

The canon lives in [`site/public/pantheon.js`](../site/public/pantheon.js) as
pure data. This document explains what it means.

---

## The rung ladder

Every DJ carries a `rung` — its depth on the leverage ladder, in the Meadows
sense. **Lower number = deeper lever.** A paradigm shift (rung 2) changes more
than a flow rate (rung 10), and the pantheon is ordered so that the headliner
sits near the bottom of the ladder where the real leverage is.

This is why `DJ DAOZ` is the headliner and `DJ WaveSide` is not. It is not
seniority. It is depth.

---

## The eleven

| DJ | say | Power (rung) | World | Palette | BPM · set |
|---|---|---|---|---|---|
| **DJ DAOZ** ★ | DOWZ | **PARADIGM SHIFT** (2) | `singularity` | `#B79BFF` `#38DCFF` | 140 · 14m |
| **DJ Raze** | RAYZ | **CREATIVE DESTRUCTION** (3) | `shatter` | `#E879C9` `#A78BFF` | 150 · 11m |
| **Qoreus** | CORE-us | **LEVERAGE POINTS** (4) | `keystone` | `#E8C46B` `#22D3EE` | 128 · 16m |
| **DJ DaoMode** | DOW-mode | **EMERGENCE & STIGMERGY** (5) | `murmuration` | `#22D3EE` `#A78BFF` | 126 · 15m |
| **DJ Auxtro** | AUX-tro | **BOUNDARY EXPANSION** (5) | `portal` | `#60A5FA` `#E8C46B` | 138 · 13m |
| **DJ Audea** | aw-DAY-uh | **EMERGENT CHORUS** (5) | `chorus` | `#22D3EE` `#E8C46B` | 128 · 14m |
| **DJ Freqro** | FREAK-row | **INFORMATION FLOWS** (6) | `spectrum` | `#7BE3EA` `#E879C9` | 145 · 12m |
| **DJ Sâv** | SAHV | **SYSTEM MEMORY** (6) | `rings` | `#E8C46B` `#60A5FA` | 122 · 16m |
| **DJ Frequest** | FREE-quest | **FEEDBACK LOOPS** (7) | `feedback` | `#E879C9` `#60A5FA` | 150 · 12m |
| **DJ Nauz** | NOZ | **RESONANCE TESTING** (8) | `turbulence` | `#A78BFF` `#7BE3EA` | 172 · 12m |
| **DJ WaveSide** | WAVE-side | **STOCKS & FLOWS** (10) | `liquid` | `#60A5FA` `#22D3EE` | 174 · 13m |

★ headliner

---

## Why the names exist

Each DJ carries a `meaning` field. It is not flavour text — it is the reason the
identity is allowed to exist. The headliner's, verbatim from the canon:

> **DAOZ** — DAO (the self-organizing way) + Z (the last axis — the dimension the
> others rotate around). One syllable, said like a verb. An invented word with no
> prior use anywhere. It is his.

That is the bar for adding one. If a name does not carry a meaning that survives
being written down, it does not go in the pantheon.

---

## The `scene` binding

`scene` is the join key between the canon and the render engine. `DJ DAOZ` has
`scene: 'singularity'`, so `viz.js` renders the `singularity` world whenever DAOZ
is on. Change the string, change the universe — no engine edit required.

The eleven worlds are documented in [`VISUALS.md`](VISUALS.md).

---

## The five powers

Powers are **live modifiers**, not identities. They sit on top of whichever DJ is
playing and change the system's behaviour. Every one is a named systems
mechanism, taken verbatim from the canon:

### `hype` — Hype Builder
**Reinforcing loop (R+).** Push an update → the community reacts → the reaction
feeds the visualizer → energy compounds. Tempo up, pulses harder.

### `vibez` — DJ VibeZ
**Balancing loop (B−).** System overheating? Auto-select chill, slow the
animations, return to baseline. *Sustainability is a set-length skill.*

### `crowdrise` — Crowdrise
**Network-effect activation.** Isolated viewers become a visible swarm —
aggregate presence rendered as one organism on screen.

### `dauozi` — DJ Daozi
**Autonomous orchestration.** Stream selection is handed to the agents: they pick
the sound from the semantics of the task being worked.

### `decentro` — DJ Decentro
**Node distribution.** Live tasks break apart and map to visual nodes — the work
rendered as the decentralized network it actually is.

**The pair that matters:** `hype` (R+) and `vibez` (B−) are a genuine reinforcing
/ balancing pair. Running `hype` indefinitely is what burnout looks like in a
system diagram. `vibez` is the governor. They are designed to be used against
each other.

---

## Adding a DJ

1. Add the object to `djs` in `pantheon.js`. Every field is required — most of
   all `meaning`.
2. Pick an existing `scene`, or add a world (see
   [`VISUALS.md`](VISUALS.md#adding-a-world)).
3. Choose `hue`/`hue2` from the aurora family. **These two colours theme the
   entire page**, so verify text contrast in both, not just the canvas.
4. Set `rung` honestly. The ladder is the point.
5. Run the pixel audit. A new world that renders black is the failure mode this
   project has actually hit.
