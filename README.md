<div align="center">

# MOTUSLIVE

### The community compute commons.

**A livestream where the audience lends their machines — and the work is provably real.**

[**semble.cc/live**](https://www.semble.cc/live) · [augustjames.live/livenow](https://www.augustjames.live/livenow) · [motuslive.vercel.app](https://motuslive.vercel.app)

</div>

---

## The pitch

A live streamer opens a stream and posts the work they actually need done. The
people watching click one button and their machine starts computing it. No
install, no account, no wallet required. When a unit of work comes back it is
checked against an independent stranger's machine, and it only counts if the
two agree. The contributor keeps a **receipt** — the unit, the task it fed, and
a digest they can re-run and verify themselves.

That is the whole idea: **turn an audience into infrastructure, and turn
attention into completed work.**

Most livestreams extract attention and give back entertainment. This one gives
the audience a way to *move* — and gives them proof, and a payout, for doing it.

**Why a stream is the right container.** A stranger's cheapest possible first
move is a single click on a page they were already looking at. Not a signup.
Not a wallet. Not a download. One click, from a tab that is already open, while
music is playing. That is the lowest-friction on-ramp to a commons that has
ever existed, and a livestream is the only place it naturally sits.

**Why this is not another volunteer-compute project.** Because the hard part was
never the compute — it was *trust*. A volunteer can return garbage and claim
payment; that problem is older than crypto and it is what kills these systems.
So MotusLive was built accounting-first: verification, attribution, receipts and
an auditable payout ledger all existed **before** the first job was dispatched.
Every number the page shows is one you can independently check — including the
unflattering ones.

**Where it is going.** The work units today index a public corpus and multiply
INT8 matrix tiles — the exact primitive a quantized transformer runs on. The
long arc is a pooled forward pass: a room full of tabs holding layers of an
open-weight model between them, paid per verified tile, with the streamer
directing what gets computed. **That is not running today, and this README will
keep saying so until it is.**

---

## What actually works right now

| | |
|---|---|
| ⚡ **Lend a machine** | One click. A real WebGPU probe — never guessed from the user-agent. Stop instantly; closing the tab ends it. |
| ⚙ **Verified work** | Units computed by **3 independent machines**; settles only on agreement. ~**1 in 4** is a known-answer canary a client cannot identify. |
| ◈ **Receipts** | Proof of *completed work*, not time served. Every receipt carries a digest anyone can reproduce. |
| ◎ **Payouts** | `plan → arm → settle`, idempotent and publicly audited. **$DASH or $TRUST — the contributor chooses.** |
| ⬡ **Networks** | A live gauge measuring Golem's real supply on every page load, because we checked instead of assuming. |
| ✦ **Eleven worlds** | A systems-thinking DJ pantheon where each visual is a *working model* of the concept its DJ is named for. |

---

## The claims, and how to check them yourself

This project's actual product is **verifiability**. Every headline is designed
to be falsifiable by a stranger with `curl`.

**"The work is verified."**
```bash
curl -s https://www.semble.cc/api/work | jq '.verification, .need, .canaryRate'
```

**"The kernel is reproducible."** Re-implement it from
[`DISPATCH.md`](docs/DISPATCH.md), then ask the server to run the same input:
```bash
curl -s -X POST https://www.semble.cc/api/work -H 'content-type: application/json' -d '{"op":"kernel-probe","kind":"matmul","payload":"32","seed":424242}'
```
You must get the same digest. If you do not, that is a bug worth reporting —
and `kernel-conformance.sh` is the test we run against production.

**"No money has moved."**
```bash
curl -s https://www.semble.cc/api/payouts | jq '.moneyMoved, .summary.dashSent'
```

**"Nothing is running when we say nothing is running."**
```bash
curl -s https://www.semble.cc/api/work | jq '.jobsRunning, .queue'
```

---

## Honest status

- ✅ **Live:** the pantheon and eleven worlds, the stream engine, SourceCrowd,
  the full compute rail — pledge → dispatch → verify → receipt → accrual — a
  public payout audit log, and the CortexInsight operator bridge.
- ✅ **Built, tested, deliberately unarmed:** the payout engine. Verified end to
  end against production **including replay-safety** (a repeated `settle` cannot
  double-credit). **No money has been sent.** `moneyMoved: false` is the proof.
- 🔨 **Not built:** pooled LLM inference. The INT8 matmul tile is the correct
  primitive and it works; a real forward pass also needs weight distribution,
  KV-cache residency and layer scheduling that a pool of opening-and-closing
  tabs does not have yet.
- ⚠ **Known-weak, stated plainly:** `need=3` still yields to a large enough
  collusion; quarantine is per client-generated id, so a reload buys a new one
  (at the cost of all accrued balance); the kernels are genuinely useful but
  modest. All three are in [`DISPATCH.md`](docs/DISPATCH.md).
- ⚠ **Measured and ruled out:** Golem as a supply source — **zero GPUs** on that
  network, and a provider must reboot into a different OS. The adapter is still
  wired and the gauge still measures, so the day that changes we will know.
- ⚖ **$TRUST, precisely:** contributors cannot **earn** $TRUST from the protocol
  (emissions go to veTRUST bonders) — but they **can choose to be paid** in
  $TRUST, transferred from the operator's own holdings. Emissions vs transfer is
  the distinction that matters.

---

## Documentation

**→ New here? [`docs/INTRO.md`](docs/INTRO.md) is the 60-second orientation.**

| Doc | What it answers |
|---|---|
| [INTRO](docs/INTRO.md) | **Start here.** What this is, the units, the five rungs, what we refuse to do |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | How the parts fit, and why there is no database |
| [DISPATCH](docs/DISPATCH.md) | How work is verified — and every place we assumed you might be lying |
| [PAYOUTS](docs/PAYOUTS.md) | How compute becomes money, and why we made that harder on purpose |
| [API](docs/API.md) | Every endpoint, field, cap and refusal |
| [MOTUSCOMPUTE](docs/MOTUSCOMPUTE.md) | The protocol, the research, the rails we rejected |
| [PANTHEON](docs/PANTHEON.md) | The eleven DJs, the rung ladder, the five powers |
| [VISUALS](docs/VISUALS.md) | The render engine and how to add a world |
| [SECURITY](docs/SECURITY.md) | Threat model, privacy model, the scrub gate |
| [MATERIAL](docs/MATERIAL.md) | The Neoneuro Glass surface language, and how to verify it |
| [CONTRIBUTING](CONTRIBUTING.md) | How to add a world, a DJ, or a fix |

---

## The map

```
site/
├─ app/api/
│  ├─ live/         broadcast state — operator writes, world reads
│  ├─ chat/         SourceCrowd thread + votes
│  ├─ compute/      the ledger: pledges, per-DJ attribution, history, accrual
│  ├─ work/         dispatch: claim → verify by consensus → canary → quarantine
│  ├─ receipts/     proof of completed work, per machine
│  ├─ payouts/      plan → arm → settle. Idempotent. Holds no key.
│  ├─ golem/        requestor adapter + live supply gauge
│  ├─ _motus.ts     ★ the shared model: units, accrual math, and the KERNELS
│  └─ _blob.ts      fresh-path Blob storage (see ARCHITECTURE §3)
└─ public/
   ├─ pantheon.js   the canon: 11 DJs, 5 powers (pure data, no logic)
   ├─ viz.js        the render engine: 11 worlds + overlays (pure, no DOM)
   └─ live.js       the vibe engine, the telemetry UI, and the compute worker
```

**`_motus.ts` is the single source of truth.** The ledger, the payout engine,
the dashboards and the browser worker all derive from it, so they cannot
disagree about what a MOTUS-second is worth or what a kernel computes.

⚠ **Every kernel is integer-only.** Verification compares digests produced on
different machines, and JS/WebGPU float ops are **not** bit-identical across
vendors — a single float would make honest machines look like liars.

---

## Run it

```bash
cd site && npm install && npm run dev
```

Works with **no environment variables** — the page falls back to local state and
renders every world. You only need env vars to broadcast or pay:

| Variable | For |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | persisting broadcast, thread, ledger |
| `LIVE_SECRET` | operator writes, dispatch, payouts (fails **closed** if unset) |

---

<div align="center">

Part of the [Motus](https://www.motusmoves.us) ecosystem · with
[Davara](https://www.motusmoves.us/davara), the systems mind.

**Motus is the mindset. The mindset means MOVE.** ~aAa

</div>
