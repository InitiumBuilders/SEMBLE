# SEMBLE — the open build

**Live:** [semble.cc](https://www.semble.cc) · **The stream:** [semble.cc/live](https://www.semble.cc/live)
Mirrored at [augustjames.live/livenow](https://www.augustjames.live/livenow) · tasks-only at [/rightnow](https://www.augustjames.live/rightnow)

> An open-source dev incubator that streams its own construction.

**MotusLive** is the live surface: a resident **systems-thinking DJ pantheon** —
eleven identities, each one a lens on system dynamics with its own sound, its own
physics, and its own rendered universe. The page streams the real work August
selects to broadcast: the goal, the Motus setting, what the agents are moving on,
and a community thread (**SourceCrowd**).

It is a livestream where the visualizer is not decoration. Each world is a
working model of the system concept its DJ is named for.

---

## Read these in order

**→ New here? [`docs/INTRO.md`](docs/INTRO.md) is the 60-second orientation.**

| Doc | What it answers |
|---|---|
| [`docs/INTRO.md`](docs/INTRO.md) | **Start here.** What this is, the units, the five rungs, what we refuse to do |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the moving parts fit, and why there is no database |
| [`docs/PANTHEON.md`](docs/PANTHEON.md) | The eleven DJs, five powers, and what each one *means* |
| [`docs/VISUALS.md`](docs/VISUALS.md) | The render engine, all eleven worlds, and how to add one |
| [`docs/API.md`](docs/API.md) | Every endpoint, every field, every limit |
| [`docs/MOTUSCOMPUTE.md`](docs/MOTUSCOMPUTE.md) | The shared-compute protocol — including what it does **not** do yet |
| [`docs/PAYOUTS.md`](docs/PAYOUTS.md) | How compute becomes money, and why we made that harder on purpose |
| [`docs/SECURITY.md`](docs/SECURITY.md) | The threat model, the privacy model, and the scrub gate |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to add a world, a DJ, or a fix |

---

## The map

```
site/
├─ app/
│  ├─ page.tsx                 the site
│  └─ api/
│     ├─ live/route.ts         broadcast state  (operator writes, world reads)
│     ├─ chat/route.ts         SourceCrowd thread + votes
│     ├─ compute/route.ts      the MotusCompute ledger: pledges, attribution,
│     │                        hourly history, accrual
│     ├─ payouts/route.ts      the payout engine: plan → arm → settle, idempotent
│     ├─ golem/route.ts        Golem requestor adapter + LIVE supply gauge
│     ├─ _motus.ts             shared model: types, units, accrual math
│     └─ _blob.ts              fresh-path Blob storage (see ARCHITECTURE §3)
└─ public/
   ├─ pantheon.js              the canon: 11 DJs, 5 powers   (data, no logic)
   ├─ viz.js                   the render engine: 11 worlds + overlays
   └─ live.js                  the vibe engine: stream cycler, state, telemetry UI
```

**`_motus.ts` is the single source of truth for units and money math.** The
ledger, the payout engine and every dashboard import from it, so they cannot
disagree about what a MOTUS-second is worth.

Three of those files are the whole product. `pantheon.js` is pure data,
`viz.js` is pure rendering, `live.js` is everything that changes over time.
The split is deliberate — you can fork the canon without touching the engine,
or the engine without touching the canon.

---

## Run it

```bash
cd site && npm install && npm run dev
```

Opens on `http://localhost:3000`. The live page works with **no environment
variables at all** — it falls back to local state and renders every world.
You only need env vars to broadcast:

| Variable | Needed for | Notes |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | persisting broadcast/thread/pledges | Vercel Blob |
| `LIVE_SECRET` | operator writes + ledger reset | never shipped to the browser |

Without them the API degrades to empty-but-valid responses rather than erroring.
That is intentional: **a fork should run on the first try.**

---

## The privacy model, in one paragraph

Selection happens at the operator's machine — nothing is broadcast unless it is
explicitly chosen. The API then **re-scrubs every string** for credential shapes
and hard-caps every size, on the assumption that the operator's machine could be
wrong. Nothing private is ever broadcast, and even what is chosen gets checked
again. MotusCompute goes one step further and **refuses** any input matching a
private-key or seed-phrase shape, with an error that tells you why. Full model
in [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Honest status

- ✅ **Live and working:** the pantheon, all eleven worlds, the stream cycler,
  broadcast, SourceCrowd, the CortexInsight bridge, and the full MotusCompute
  telemetry rail — per-DJ and per-mode attribution, hourly history, accrual in
  MOTUS-seconds, and a public payout audit log.
- ✅ **Built, tested, and deliberately unarmed:** the payout engine. plan → arm
  → settle is complete and **verified end to end against production, including
  replay-safety** (a repeated `settle` cannot double-credit). **No money has been
  sent.** `moneyMoved: false` on `/api/payouts` is the live proof.
- 🔨 **Not built:** job dispatch (rung 5). **No work is dispatched.**
  `GET /api/compute` returns `jobsRunning: false` in every response — hard-coded,
  not computed — so no surface can drift into implying otherwise.
- ⚠ **Wired but structurally unusable:** Golem. The requestor adapter is real and
  a **live gauge measures Golem's own API on every request**. It reports what is
  actually there: ~370 providers and **zero GPUs**. A livestream viewer cannot
  contribute through Golem at all. Receipts in
  [`docs/MOTUSCOMPUTE.md`](docs/MOTUSCOMPUTE.md#-what-we-ruled-out-and-why).
- ❌ **Corrected and removed:** any suggestion that contributors can earn $TRUST.
  Emissions go to veTRUST bonders. **TRUST is the receipt; DASH is the reward.**

Part of the [Motus](https://www.motusmoves.us) ecosystem · with
[Davara](https://www.motusmoves.us/davara), the systems mind.
*Motus is the mindset. The mindset means MOVE.* ~aAa
