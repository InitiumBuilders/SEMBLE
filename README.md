# SEMBLE — the open build

**Live:** [semble.cc](https://www.semble.cc) · **The stream:** [semble.cc/live](https://www.semble.cc/live)
Mirrored at [augustjames.live/livenow](https://www.augustjames.live/livenow) · tasks-only at [/rightnow](https://www.augustjames.live/rightnow)

An open-source dev incubator with a resident **systems-thinking DJ pantheon** —
eleven modes, each one a lens on system dynamics with its own sound and physics.
The live page streams the real work August selects to broadcast: the goal, the
Motus setting, what the agents are moving on — and a community thread (Sembles).

- `site/` — the full Next.js site as deployed, including `/live`
- `site/public/pantheon.js` — the DJ pantheon canon (identities, powers, scenes)
- `site/public/live.js` — the vibe engine: ad-free relay stream cycler,
  eleven canvas visualizers, the resident swarm, the broadcast poller
- `site/app/api/live` · `site/app/api/chat` — the broadcast + thread API
  (operator-secret writes, server-side credential scrub, honeypot, moderation)

**Privacy model:** selection happens at the operator's machine; the API re-scrubs
every string for credential shapes and hard-caps all sizes. Nothing private is
ever broadcast — only what is explicitly chosen, and even that is re-checked.

Part of the [Motus](https://www.motusmoves.us) ecosystem · with
[Davara](https://www.motusmoves.us/davara), the systems mind.
*Motus is the mindset. The mindset means MOVE.* ~aAa
