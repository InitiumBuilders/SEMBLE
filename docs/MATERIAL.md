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

---

## The mark system

Ten symbols — bolt, diamond, orbit, spark, hex, check, arc, shield, cycle,
frame — defined once as an inline SVG sprite and referenced with `<use>`.

They replaced a mix that had grown on the partner pages: emoji (✊ 🛡 ✅ 🔨 ⚡)
sitting directly beside geometric glyphs (◎ ⟳ ◈ ✦ ⬡). That mix reads as two
different products stapled together, because it *is* two different rendering
systems — emoji are colour bitmaps the reader's OS supplies and restyles, and
they cannot be given a palette hue.

The rules:

1. **One stroke weight** (1.7px on a 24px viewBox), one corner treatment.
2. **`currentColor` always.** A mark takes the hue of the thing it means:
   `.m-cyan` compute, `.m-violet` open rails, `.m-gold` systems design and the
   in-progress arc, `.m-zao` The ZAO's heat.
3. **Inlined, never linked.** A cross-document `<use>` is one more request that
   can fail, and a missing mark is a hole in the page.
4. **Never load-bearing.** Every mark sits beside a text label that says the
   same thing. Removing the whole sprite must lose decoration, not meaning.

### When a glyph is fine

Not every symbol needs drawing. Before converting anything, **measure** whether
the font stack actually has it — render the glyph to a canvas and compare its
advance width against `U+E000` (private use, guaranteed absent everywhere).
Matching widths mean tofu.

Measured on the live pages: `◈ ★ ✕ × · 𝕏 ⬡ ✦ ◎ ⟳` all resolve through the
browser fallback chain, in both Sora and IBM Plex Mono. They were left as
characters. The emoji were the actual defect; the geometry never was.

---

## Share cards (`/og`)

Every surface had `og:title` and no `og:image` — so a partnership announcement,
a page whose entire job is to be shared, rendered as a blank grey rectangle in
X, Farcaster, iMessage, Slack and Discord. The rooms were finished and the
doorway was unbuilt.

`/og?v=thezao|partners|live|semble` renders a 1200×630 PNG through Satori, from
the same palette as the pages, so a shared link and the page behind it are
visibly the same world.

**Satori is not a browser**, and the constraints are load-bearing:

- Every element with more than one child needs an explicit `display: flex`, or
  the render throws — which is a 500, which is no card at all.
- No CSS grid, no `backdrop-filter`. The glass is faked with layered
  translucent fills and a hairline border; on a flat raster there is nothing
  behind it to blur anyway.
- No `background-clip: text` — gradient wordmarks become solid ink, which the
  contrast law prefers regardless.
- **No symbol glyphs.** There is no fallback chain. The first render put five
  tofu boxes on the card, including the ✕ joining the two partner names. Every
  mark on a card is now drawn as geometry — rotated squares and dots. The only
  non-ASCII characters permitted are the ones Latin-1 guarantees: `×` and `·`
- No external fetch and no live data. Crawlers give short timeouts and retry
  rarely; a card that sometimes fails is worse than one that is always the same.

Verify with `og-check.sh`. A 200 is not enough — an error page can be a 200 and
an empty body is still "successful" — so it checks the PNG magic bytes and reads
the width and height straight out of the IHDR chunk.

---

## The ledger strip

Both partner pages read `/api/compute` and `/api/work` on load and print four
numbers, including the one that does not flatter us: **paid out so far**.

The contract that makes it safe to ship:

> Every slot ships as an em-dash in the markup. The script only ever
> **overwrites** a dash. If it throws, if the network is down, if a crawler runs
> with JS off — the dashes stay and the page reads exactly the same.

The `catch` is deliberately empty and must stay that way. **Never write `0` on
failure.** A real zero and a failed fetch are different facts, and a page whose
entire argument is "you can check this" does not get to blur them.
