# DONATED COMPUTE — what it would actually take
### Research for MotusLive + CortexInsight · 2026-08-12

> **The ask:** *"when im live i can raise compute or people can donate their
> graphics cards ram or compute resources to our stream and to our CortexInsight"*

---

## 0 · THE FINDING THAT SHAPES EVERYTHING

**Donated GPUs cannot make Davara faster.**

CortexInsight's fleet runs Claude through the SembleCortex relay on August's
Anthropic subscription. That inference happens in Anthropic's data centres. No
amount of volunteer VRAM touches it — there is no mechanism, at any price, for
a stranger's 4090 to serve a Claude token.

So "donate compute to CortexInsight" cannot mean *"help Davara think"*. It can
only mean one of these, and they are very different products:

| What donated compute CAN do | Honest value |
|---|---|
| **A** · Run **open-weight** models (Llama/Qwen/Mistral class) for public jobs | Real. A second, free, community-powered brain alongside Davara. |
| **B** · Render / encode — visuals, video, the MotusLive worlds, share cards | Real, and the most *visible* on a stream. |
| **C** · Batch research — the Votus/Motus Corpus crawls, embeddings, scoring | Real, and it feeds an engine he already has. |
| **D** · "Make Claude faster" | **Impossible.** Never imply it. |

Everything below assumes A, B and C.

---

## 1 · THE FOUR REAL ARCHITECTURES

### ① Browser / WebGPU — *the only zero-friction path for a stream audience*
A viewer opens the page, clicks **LEND**, and their tab becomes a node. WebGPU
+ WebLLM run an open model entirely client-side. No install, no account, no
Docker, no cloud credits — "just a URL and whatever graphics card is in your
laptop" ([AI Grid](https://www.webgpu.com/showcase/browser-ai-llms-share-gpu-compute/),
[Chrome WebGPU compute](https://developer.chrome.com/docs/capabilities/web-apis/gpu-compute)).

- **Fit for a live stream: excellent.** The audience is *already in a browser
  tab on our page*. Conversion cost is one click.
- **Ceiling: low per node.** Browser sandbox, a few GB of VRAM, ~1–8B models.
  Many small nodes, not one big one.
- **Cost to us: zero.** No servers. The work happens on their machine.
- **Risk: low** — sandboxed, revocable by closing the tab. The reputational
  risk is *cryptojacking optics*, so consent must be loud, explicit, opt-in,
  and killable in one click.

### ② Petals — *BitTorrent for LLM inference*
Shards a large model's transformer blocks across volunteer hosts, so a 70B-class
model runs across many consumer GPUs
([bigscience-workshop/petals](https://github.com/bigscience-workshop/petals),
[Yandex Research](https://research.yandex.com/blog/petals-decentralized-inference-and-finetuning-of-large-language-models)).

- **Mature codebase, real 70B support, private swarms are supported.**
- ⚠ **Two hard problems, both disqualifying for private work:**
  - **Prompt-inference attacks are real and published.** Peers hosting the
    *first* layers can reconstruct the original input from intermediate
    activations — an ACM CCS 2025 paper designs and evaluates three such attacks
    ([CCS'25](https://dl.acm.org/doi/10.1145/3719027.3744820); see also
    [this security review](https://ashokpoudel.medium.com/understanding-security-and-privacy-in-petals-what-you-need-to-know-before-using-this-breakthrough-4c68bb9b6cad)).
    The known mitigation is to keep the first layers on **trusted** hosts only.
  - **The public swarm's own health widget is currently broken** — a bad sign
    for a project whose pitch is a live public swarm
    ([2026 comparison](https://sharedllm.org/blog/sharedllm-vs-petals-vs-exo.html)).
- **Verdict:** viable as a *private* swarm among trusted builders. Never for
  anything August would not publish.

### ③ Exo — *unify HIS OWN devices*
Turns a pile of everyday machines (Macs, PCs, phones, Pis) into one cluster.
- **This is not viewer donation — it is August's own hardware, pooled.**
- Genuinely useful and the *safest* real capacity win. Zero trust problems
  because every node is his.

### ④ BOINC — *the 25-year-old standard*
The reference platform for volunteer computing; the entire premise is that a
desktop only uses 10–15% of its capacity
([BOINC](https://boinc.berkeley.edu/boinc_a_platform_for_volunteer_computing.pdf),
[overview](https://en.wikipedia.org/wiki/Volunteer_computing)).
- **Best fit: batch research (C), not live inference.** Requires an install, so
  conversion from a stream is poor — but the credit/leaderboard model is exactly
  the social mechanic that makes donation *stick*, and worth stealing.

---

## 2 · WHAT IT WOULD ACTUALLY TAKE — the ladder

**Rung 1 · PLEDGE + PROBE (days)** ← *start here*
Measure and show real donated capability before running a single job. Detect
WebGPU, read the actual adapter limits, let a viewer pledge, aggregate live.
Gives an honest counter on stream from day one and proves demand before any
infrastructure exists. **Cost: zero. Risk: zero. Built — see §4.**

**Rung 2 · BROWSER JOBS (1–2 weeks)**
A job queue + WebLLM in the pledged tabs. Public-only work: SourceCrowd digests,
tagging, embeddings for the Motus Corpus, visual seeds. Needs: a queue endpoint,
result verification (see §3), and a kill switch.

**Rung 3 · TRUSTED PRIVATE SWARM (weeks)**
Petals or Exo across August's machines + a small ring of named builders. This is
where real model capacity appears. Only for work that could be public anyway.

**Rung 4 · THE ECONOMY (months)**
Credit donated FLOPs into the existing VOTUS/MOVUS ledger — the mechanic already
exists in his ecosystem. Donating compute becomes a *Motus*: a value in motion,
recorded, and paid forward. This is the piece nobody else has.

---

## 3 · THE THREE PROBLEMS THAT KILL NAIVE VERSIONS

1. **Verification.** A volunteer can return garbage — or nothing — and claim
   credit. Standard answer: redundant execution (send each job to N nodes and
   compare), spot-check with known-answer jobs, and never let a single node's
   result be authoritative. Budget ~2× the compute for ~1× the trust.
2. **Privacy, in BOTH directions.** Their machine must never see anything of
   his that isn't public (the prompt-inference attacks above are the proof),
   and our code must never touch anything of theirs. Browser sandbox handles the
   second; **a hard public-only job policy** handles the first. This is the same
   law as the MotusLive broadcast gate: *only what was explicitly chosen leaves.*
3. **Consent and optics.** Silent background compute is cryptojacking, however
   good the cause. Requirements: explicit opt-in, a visible always-on indicator,
   a one-click stop, a stated ceiling on CPU/GPU use, and no auto-start ever.

---

## 4 · WHAT I BUILT NOW — Rung 1, live

**LEND YOUR GPU** on MotusLive: a real WebGPU capability probe (adapter vendor,
architecture, max buffer/workgroup limits, memory hint), an explicit opt-in
pledge, and a live aggregate published through the existing `/api/live` rail so
the number appears **on the stream and in CortexInsight**.

It measures *real* hardware — it does not simulate, estimate from user-agent, or
count a pledge as capacity that isn't there. Devices without WebGPU are told so
honestly rather than counted.

---

## 5 · THE RECOMMENDATION

> **Do Rung 1 now (done), Rung 2 next, and never do Rung 3 with anything
> private.** Frame it as *"lend your GPU to the commons"* — the open-model
> brain, the visuals, the research — and **never** as *"speed up Davara"*,
> because that is not a thing that can be true.

The strategic prize is not the FLOPs. It is that **donating compute is the
cheapest possible first move for a stranger** — cheaper than money, cheaper than
signing up, one click from a stream. That is exactly the R3 mover loop that has
never turned. A viewer who lends a GPU has *moved*, and the ledger can prove it.

---

*Sources: [awesome-volunteer-computing](https://github.com/ranjithrajv/awesome-volunteer-computing) ·
[AI Grid / WebGPU](https://www.webgpu.com/showcase/browser-ai-llms-share-gpu-compute/) ·
[Chrome WebGPU compute](https://developer.chrome.com/docs/capabilities/web-apis/gpu-compute) ·
[Petals](https://github.com/bigscience-workshop/petals) ·
[Yandex Research on Petals](https://research.yandex.com/blog/petals-decentralized-inference-and-finetuning-of-large-language-models) ·
[Prompt inference attacks, ACM CCS 2025](https://dl.acm.org/doi/10.1145/3719027.3744820) ·
[Petals security review](https://ashokpoudel.medium.com/understanding-security-and-privacy-in-petals-what-you-need-to-know-before-using-this-breakthrough-4c68bb9b6cad) ·
[SharedLLM vs Petals vs Exo, 2026](https://sharedllm.org/blog/sharedllm-vs-petals-vs-exo.html) ·
[BOINC](https://boinc.berkeley.edu/boinc_a_platform_for_volunteer_computing.pdf) ·
[Volunteer computing](https://en.wikipedia.org/wiki/Volunteer_computing)*
