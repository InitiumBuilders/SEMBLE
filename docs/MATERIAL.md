# NEONEURO GLASS — the material

One surface language across every MotusLive surface and the CortexInsight
desktop app, so they read as the same object rather than two projects sharing a
name.

---

## The tension, resolved on purpose

**Classic neumorphism is built on low contrast.** Soft extruded shapes in
near-identical tones — that *is* the look. It is also exactly what this
project's legibility rules forbid: no grey body text, ~7:1 contrast target,
nothing that needs squinting.

So the material splits the job:

> **The surface takes the depth. The ink does not move.**

Every panel gets relief, frost and a lit rim. Every character on it stays
full-strength `--ink`. Depth is a property of the *material*, never of the
*message*.

**Measured after applying it** — 15 text/background pairs on the live page:

| | |
|---|---|
| Failures below 4.5:1 | **0** |
| Lowest ratio | **11.47:1** (desktop) · **13.47:1** (375px) |
| Target | 7:1 |

---

## The four layers

Each earns its cost; nothing is decoration.

```css
--nn-raise:
  inset 0  1px 0 var(--nn-lite),          /* ① top light edge   */
  inset 1px 0  0 rgba(190,225,240,.05),   /*    left light edge */
  inset 0 -1px 0 var(--nn-dark),          /*    bottom dark edge*/
  0 1px 1px rgba(0,0,0,.45),              /* ③ contact shadow   */
  0 14px 34px -18px rgba(0,0,0,.9);       /*    lift off the void */
```

**① Dual-light edges** — a light rim top-left, a dark rim bottom-right. This is
what makes a panel read as *extruded* rather than *painted*.
**The light comes from the top-left, always.** A depth system with an
inconsistent light source reads as noise instead of form.

**② The lit rim + ④ the sheen** — one `::before` carrying a 147° gradient. Glass,
not putty. Combined into a single pseudo-element so nothing extra paints.

**③ The drop** — two shadows: a tight contact shadow and a wide soft lift.

**The hairline** — one `::after`, a 1px gradient across the top of each major
surface, fading at both ends. The futurist tell. One line, one job — not a
frame, not a border.

---

## Pressed means pressed

```css
--nn-inset:
  inset 0 1px 2px rgba(0,0,0,.55),
  inset 0 -1px 0 var(--nn-lite);
```

On `:active` the light edge **moves to the bottom** — the surface genuinely
inverts. Tactile grammar: *raised is an invitation, inset is held.* An active
state that only changes colour is a repaint; this is a physical claim.

Active tabs get `--nn-inset` **plus** a coloured bloom — held *and* lit.

---

## ⚠ The performance rule that is not optional

**One backdrop-filter layer. Never nested.**

Stacked `backdrop-filter` is what turned a phone into a hand-warmer on this
project once already. Each blur re-samples everything beneath it; nest two and
you pay twice for one visual effect nobody can see.

```css
/* the outer glass frosts */
.card.gpu-card, .cmn-live { backdrop-filter: blur(18px) saturate(1.25); }
/* children explicitly do NOT re-blur */
.card .ps-card, .card .pool-stat { backdrop-filter: none; }
```

**Measured on the live page:** 11 elements *declare* a blur, 7 are renderable,
and **2 actually paint** — because the commons tabs keep inactive panels at
`display: none`, so they never render at all. The structural decision to
consolidate five sections into one tabbed surface pays for the material's cost.

**Verify this, don't assume it:**
```js
[...document.querySelectorAll('*')].filter(e => {
  if (getComputedStyle(e).backdropFilter === 'none') return false;
  const r = e.getBoundingClientRect();
  return r.width && r.height && r.bottom > 0 && r.top < innerHeight;
}).length
```

---

## The motion budget

**This material is static.** It reads as depth because of the light model, not
because anything moves. The page already carries a live canvas; a second ambient
animation would cost battery to say something the shadows already say.

Motion is reserved for **state change** — press, hover-lift, tab switch — and
every transition has a `prefers-reduced-motion` escape.

🚫 **Permanently banned:** the rotating background box that spins with the
viewport. Not here, not anywhere.

---

## A defect this caught

The three-step connector threads were drawn on each card with `right: -14px`,
pushing every card 14px past its own box — `scrollWidth 411` vs
`clientWidth 397`. Invisible, because the page clips horizontally.

**Invisible is not the same as harmless.** An element overflowing its own box
stays benign only until something upstream stops clipping. The threads now
belong to the grid *gaps* and are drawn by the container:

```css
.how::before { left: calc((100% - 28px) / 3); }
.how::after  { left: calc((100% - 28px) / 3 * 2 + 14px); }
```

---

## Applying it elsewhere

The tokens are the contract — `--nn-lite`, `--nn-dark`, `--nn-raise`,
`--nn-inset`, `--nn-sheen`. Copy those and the surface language follows.

Two rules travel with them:

1. **Never let the material touch the ink.** Depth belongs to surfaces. If a
   change makes text dimmer, it is the wrong change.
2. **Audit contrast after, not before.** Compute the ratios — the whole point of
   a low-contrast aesthetic is that it *looks* fine while failing. Eyeballing is
   how neumorphism becomes unreadable.
