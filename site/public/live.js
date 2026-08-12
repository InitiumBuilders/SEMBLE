/* ═══════════════════════════════════════════════════════════════════════════
   MOTUSLIVE — the vibe engine, interstellar build.
   semble.cc/live · augustjames.live/livenow · /rightnow · motuslive.vercel.app

   THE SPINE: one living page — a black hole whose event horizon is the stage —
   where the pantheon (led by DJ DAOZ), the broadcast, and the SourceCrowd all
   orbit the same gravity. Every visual carries a systems meaning:
   · the accretion disk = attention feeding the work
   · the gravity swarm = the community, in orbital decay toward what matters
   · the drop = the paradigm collapsing past its own event horizon
   · SourceCrowd votes = the balancing signal that decides what rises

   THE EVOLUTION LAW: no scene ever repeats itself. Every 32-bar phrase, each
   scene mutates its own parameters (density, warp, hue-drift, form) inside its
   DJ's temperament — the visuals are a system in motion, not a loop.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const P = window.PANTHEON;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const API = location.hostname.endsWith('semble.cc') || location.hostname === 'localhost' || location.hostname.endsWith('motuslive.vercel.app')
  ? '' : 'https://www.semble.cc';               // other domains read Semble's API cross-origin
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(devicePixelRatio || 1, 2);   // clamp — 3x panels melt phones for nothing

/* ── view doors ── */
const RIGHTNOW = /rightnow/.test(location.pathname);
if (RIGHTNOW) document.body.classList.add('rightnow');

/* ═══ STATE ═══ */
const S = {
  // ⚠ DIRECT IS THE DEFAULT, DELIBERATELY. The ad-free relay routes through
  // volunteer Invidious instances, and those sit behind Cloudflare-style
  // "Checking your browser…" interstitials that HANG FOREVER inside an iframe —
  // which is exactly what August hit. An API probe cannot see that (the API
  // answers 200 while the embed is gated), so no amount of probing makes the
  // relay trustworthy as a default. The product must PLAY MUSIC when you press
  // play; ad-free is offered as an experiment you can opt into, with the
  // failure mode named up front instead of discovered.
  dj: P.djs[0], power: null, playing: false, mode: 'direct',
  // energy starts mid-phrase, not at zero — a universe that fades UP from
  // nothing on load reads as broken for the first ten seconds
  vid: null, rotateT: 0, live: null, energy: .45, phrase: 0, drop: 0, beatFlash: 0,
  evo: null,                    // the current scene mutation (see evolve())
  scTab: 'top', msgs: [], voted: {}, autoT: 0, theater: false,
  // Set by the first real interaction. Browsers only permit autoplay WITH
  // SOUND after a user gesture, so this is the difference between a music
  // stream and a silent one — see embedUrl().
  gesture: false,
};
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  addEventListener(ev, () => { S.gesture = true; }, { once: true, passive: true }));
try { S.voted = JSON.parse(localStorage.getItem('sc.voted') || '{}'); } catch {}

/* ═══ RESIDENT GUESTS — seeded streams that ride every queue ═══ */
// DJ Andrea rides with us — August's pick, always in the rotation.
const SEEDS = [{ v: 'UJPn_1KXTCs', who: 'DJ Andrea' }];

/* ═══ THE STREAM ENGINE — ad-free first ═══ */
const INV = ['https://yewtu.be', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://iv.ggtyler.dev'];
const PIPED_API = ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee', 'https://pipedapi.adminforge.de'];

async function tryJson(url, ms = 4500, opts = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, ...opts }); clearTimeout(t); if (!r.ok) throw 0; return await r.json(); }
  catch { clearTimeout(t); return null; }
}
async function searchIds(query) {
  const key = 'vibe.ids.' + query;
  const hit = localStorage.getItem(key);
  if (hit) { try { const j = JSON.parse(hit); if (Date.now() - j.ts < 6 * 3600e3 && j.ids.length) return j.ids; } catch {} }
  let ids = [];
  for (const base of PIPED_API) {
    const j = await tryJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
    if (j && j.items) { ids = j.items.map((x) => (x.url || '').split('v=')[1]).filter(Boolean); if (ids.length) break; }
  }
  if (!ids.length) for (const base of INV) {
    const j = await tryJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    if (Array.isArray(j)) { ids = j.map((x) => x.videoId).filter(Boolean); if (ids.length) break; }
  }
  if (ids.length) localStorage.setItem(key, JSON.stringify({ ts: Date.now(), ids: ids.slice(0, 24) }));
  return ids;
}
/* ═══ WHICH DOOR IS ACTUALLY OPEN ═══
   Public Invidious/Piped instances die, rate-limit and 403 constantly — at the
   time of writing only ONE of four was serving. Hard-coding the first one and
   hoping is why the relay "worked" until it silently didn't. So: probe, cache
   the winner for an hour, and if none answer, say so and fall through to
   DIRECT rather than leaving a dead black frame with a confident label. */
async function pickInstance() {
  const cached = localStorage.getItem('vibe.inst');
  const when = +(localStorage.getItem('vibe.instAt') || 0);
  if (cached && Date.now() - when < 3600e3) return cached;
  for (const base of INV) {
    const ok = await tryJson(`${base}/api/v1/search?q=mix&type=video`, 4000);
    if (Array.isArray(ok) && ok.length) {
      localStorage.setItem('vibe.inst', base);
      localStorage.setItem('vibe.instAt', String(Date.now()));
      return base;
    }
  }
  return null;
}
function embedUrl(id, inst) {
  if (S.mode === 'relay' && inst) {
    // no `local=true`: proxying the video through a volunteer instance is what
    // makes the relay stutter. Invidious never serves ads either way.
    return `${inst}/embed/${id}?autoplay=1`;
  }
  // ⚠ DIRECT MODE WAS PLAYING MUTED, WHICH FOR A MUSIC STREAM IS "BROKEN".
  // `mute=1` was there to satisfy autoplay policy — but every path into spin()
  // is a real user gesture (the play button, NEXT DROP, a DJ card, a key), and
  // after a gesture the browser allows autoplay WITH SOUND. So we only mute
  // when we genuinely have no gesture yet, and we say so on screen.
  const m = S.gesture ? 0 : 1;
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${m}&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1`;
}
async function spin(next) {
  const dj = S.dj;
  note('finding a set…');
  let inst = null;
  if (S.mode === 'relay') {
    inst = await pickInstance();
    if (!inst) {
      // HONEST FALLBACK. Every public instance is down — say it plainly and
      // switch, rather than mounting a dead frame under a confident label.
      S.mode = 'direct';
      const b = $('#src'); if (b) b.textContent = '▶ DIRECT';
      note('every open relay instance is down right now — switched to <b>direct</b> so the music still plays');
    }
  }
  const searched = await searchIds(dj.query);
  // the resident guests ride EVERY queue, whatever the mode
  let ids = [...SEEDS.map((s) => s.v), ...searched];
  if (next && ids.length > 1) ids = ids.filter((x) => x !== S.vid);
  const first = !localStorage.getItem('vibe.played');
  S.vid = first ? SEEDS[0].v : ids[Math.floor(Math.random() * Math.min(ids.length, 12))];
  localStorage.setItem('vibe.played', '1');
  $('#player').src = embedUrl(S.vid, inst);
  $('.curtain').classList.add('gone');
  S.playing = true;
  clearTimeout(S.rotateT);
  S.rotateT = setTimeout(() => spin(true), (dj.setMin || 13) * 60e3);
  const guest = SEEDS.find((s) => s.v === S.vid);
  const via = S.mode === 'relay' ? `ad-free relay · ${inst.replace(/^https?:\/\//, '')}` : 'direct from YouTube';
  const muted = S.mode !== 'relay' && !S.gesture;
  note(`now spinning <b>${guest ? guest.who + ' · resident guest' : dj.name}</b> — ${via}${searched.length ? '' : ' · search was quiet, playing the residents'} · next drop in ${dj.setMin} min`
    + (muted ? ' — <b>tap the stage to unmute</b>' : ''));
  paintSource();
}
/* The source indicator tells the truth about which door is actually open. */
function paintSource() {
  const el = $('#srcNow');
  if (el) {
    el.className = 'srcnow ' + (S.mode === 'relay' ? 'relay' : 'direct');
    el.textContent = S.mode === 'relay' ? '⛨ AD-FREE (experimental)' : '▶ DIRECT';
  }
  const bail = $('#bail');
  if (bail) bail.style.display = S.mode === 'relay' ? '' : 'none';
  const b = $('#src');
  if (b) b.textContent = S.mode === 'relay' ? '⛨ TRYING AD-FREE' : '▶ DIRECT · PLAYS';
}
function note(html) { const n = $('#tnote'); if (n) n.innerHTML = html; }

/* ═══ DJ SWITCHING ═══ */
function setDj(dj, andSpin) {
  S.dj = dj;
  document.documentElement.style.setProperty('--dj', dj.hue);
  document.documentElement.style.setProperty('--dj2', dj.hue2);
  $$('.dj-card').forEach((c) => c.classList.toggle('on', c.dataset.id === dj.id));
  $('#hud-dj').innerHTML = `MODE: <b>${dj.name}</b>`;
  $('#hud-pow').textContent = dj.power.toUpperCase();
  document.title = `${dj.name} · MOTUSLIVE`;
  evolve(true);                                   // a new mind = a new visual genome
  // HARD-CLEAR THE TRAIL BUFFER. Trails are what make each world feel alive,
  // and they are exactly why a switch would otherwise leave the previous
  // world's light burned into the new one for several seconds.
  if (vg && VW) { vg.globalCompositeOperation = 'source-over'; vg.globalAlpha = 1; vg.fillStyle = '#03050a'; vg.fillRect(0, 0, VW, VH); }
  if (window.MOTUSVIZ) MOTUSVIZ.reset();
  if (andSpin || S.playing) spin(true);
}

/* ═══ WAVE POWERS ═══ */
function setPower(pw) {
  S.power = S.power && S.power.id === pw.id ? null : pw;
  $$('#powers .power').forEach((c) => c.classList.toggle('on', !!S.power && c.dataset.id === S.power.id));
  const chip = $('#hud-power');
  chip.style.display = S.power ? '' : 'none';
  // The HUD says what the power is DOING to the system right now — not its
  // name. A power whose only evidence is a label is not a power.
  const say = S.power && window.MOTUSVIZ && MOTUSVIZ.POWERS[S.power.id];
  if (S.power) chip.textContent = `⚡ ${S.power.name.toUpperCase()} — ${say ? say.say : 'active'}`;
  const live = $('#powerNow');
  if (live) live.innerHTML = S.power
    ? `<b>${esc(S.power.name)}</b> is running — ${esc(say ? say.say : '')}. ${esc(S.power.does)}`
    : 'No power engaged — the system is running at its own pace. Trigger one and the physics on the stage changes with it.';
  if (S.power && S.power.id === 'vibez') S.energy = Math.min(S.energy, .35);
  // DAUOZI hands stream choice to the agents: they cycle the deck themselves.
  clearInterval(S.autoT); S.autoT = 0;
  if (S.power && S.power.id === 'dauozi') {
    S.autoT = setInterval(() => {
      const next = P.djs[(P.djs.findIndex((d) => d.id === S.dj.id) + 1) % P.djs.length];
      setDj(next, false);
    }, 45000);
  }
}

/* ═══ THE CLOCK — bpm + 32-bar phrase envelope, driving CSS too ═══ */
let _lastPhrase = 0;
function clock(t) {
  const dj = S.dj;
  const beat = (t / 1000) * (dj.bpm / 60);
  const bar = beat / 4, phrase = (bar % 32) / 32;
  S.phrase = phrase;
  if (phrase < _lastPhrase) evolve(false);        // phrase boundary → mutate the scene
  _lastPhrase = phrase;
  let e = phrase < .5 ? phrase * 1.1 : phrase < .55 ? 1 : .72 - (phrase - .55) * .5;
  if (S.power) {
    if (S.power.id === 'hype') e = Math.min(1, e * 1.35);
    if (S.power.id === 'vibez') e *= .45;
  }
  S.drop = phrase >= .5 && phrase < .56 ? 1 - (phrase - .5) / .06 : 0;
  S.energy += (e - S.energy) * .04;
  // the beat, written where CSS can breathe with it (accretion disk + shadows)
  const pulse = (S.energy * .7 + S.drop * .3).toFixed(3);
  document.documentElement.style.setProperty('--pulse', pulse);
  return { beat, bar, phrase };
}

/* ═══ THE EVOLUTION — no world is ever watched twice ═══ */
function evolve(reset) {
  const r = () => Math.random();
  if (reset || !S.evo) {
    S.evo = { density: .8 + r() * .4, warp: .7 + r() * .6, drift: r() * 6.28, form: Math.floor(r() * 3), gen: 0 };
  } else {
    // a bounded random walk — mutation inside the DJ's temperament, never chaos
    const e = S.evo;
    e.density = Math.max(.5, Math.min(1.4, e.density + (r() - .5) * .3));
    e.warp = Math.max(.4, Math.min(1.6, e.warp + (r() - .5) * .35));
    e.drift += (r() - .5) * 1.2;
    if (r() < .4) e.form = Math.floor(r() * 3);
    e.gen++;
    // Sâv's world literally records each phrase as a permanent ring
    if (window.MOTUSVIZ) MOTUSVIZ.markPhrase(e.gen % 5 === 0);
  }
}

/* ═══ THE VISUALIZER — eleven worlds, rendered by MOTUSVIZ ═══ */
const viz = $('#viz'); const vg = viz ? viz.getContext('2d', { alpha: true }) : null;
let VW = 0, VH = 0;
function vsize() {
  if (!viz) return;
  const r = viz.parentElement.getBoundingClientRect();
  VW = viz.width = Math.max(2, Math.round(r.width * DPR));
  VH = viz.height = Math.max(2, Math.round(r.height * DPR));
  if (vg) { vg.fillStyle = '#03050a'; vg.fillRect(0, 0, VW, VH); }   // seed the trail buffer
}
addEventListener('resize', vsize);
// Particle budget scales to the device — a phone gets a smaller, equally
// beautiful universe rather than a stuttering big one.
const COUNT = innerWidth < 700 ? 260 : (innerWidth < 1200 ? 460 : 700);
function vloop(t) {
  if (!vg || REDUCED) return;
  requestAnimationFrame(vloop);
  if (document.hidden) return;
  if (!VW || Math.abs(viz.parentElement.getBoundingClientRect().width * DPR - VW) > 40) vsize();
  clock(t);
  if (!window.MOTUSVIZ) return;
  MOTUSVIZ.render(vg, S.dj.scene, {
    t, e: S.energy, drop: S.drop, phrase: S.phrase,
    W: VW, H: VH, hue: S.dj.hue, hue2: S.dj.hue2,
    v: S.evo || (evolve(true), S.evo), DPR, count: COUNT,
    power: S.power ? S.power.id : '',
    // DECENTRO maps the ACTUAL broadcast items to nodes — the real work,
    // distributed, not a decorative count.
    nodes: Math.max(3, ((S.live && S.live.items) || []).length || 6),
  });
}

/* ═══ THE COSMOS — the page's own deep space ═══
   Four parallax star layers with real twinkle, rare comets, and a gravity
   swarm that ORBITS the section you are reading (the community, in orbital
   decay toward what matters). Every body is a glow sprite drawn additively, so
   the field has depth and bloom instead of looking like scattered dots. */
const sw = $('#swarm'); const sg = sw ? sw.getContext('2d') : null;
let SWW = 0, SWH = 0, attractor = { x: .5, y: .3 };
function swsize() {
  if (!sw) return;
  SWW = sw.width = Math.round(innerWidth * DPR); SWH = sw.height = Math.round(innerHeight * DPR);
  sg.fillStyle = '#04060a'; sg.fillRect(0, 0, SWW, SWH);   // seed the ambient trail buffer
}
addEventListener('resize', swsize);
const MOBILE = innerWidth < 700;
const stars = Array.from({ length: MOBILE ? 130 : 300 }, () => ({
  x: Math.random(), y: Math.random(), z: Math.random(), tw: Math.random() * 6.28,
  hue: Math.random() > .86 ? 1 : 0,                     // a few carry the DJ's colour
}));
let comet = null;
const being = Array.from({ length: MOBILE ? 46 : 96 }, () => ({
  x: Math.random() * innerWidth, y: Math.random() * innerHeight,
  vx: 0, vy: 0, ph: Math.random() * 7, sz: 1 + Math.random() * 1.9,
}));
setInterval(() => {
  const secs = $$('.deck-sec, .horizon, .workgrid, .card');
  const vis = secs.filter((s) => { const r = s.getBoundingClientRect(); return r.top < innerHeight * .7 && r.bottom > 0; });
  if (vis.length) { const r = vis[0].getBoundingClientRect(); attractor = { x: (r.left + r.width / 2) / innerWidth, y: Math.max(60, r.top + 40) / innerHeight }; }
}, 2400);
/* THE AMBIENT WORLD — the DJ's universe across the ENTIRE display.
   This is the difference between watching a box and being inside the room:
   whatever world is playing on the stage is also playing, quietly, behind
   every section of the page — on the phone and on the desktop alike. It runs
   at a third of the intensity, a fraction of the body count, and (on phones)
   every other frame, so the immersion costs almost nothing. */
const AMB_DPR = Math.min(DPR, innerWidth < 700 ? 1.4 : 1.75);
const AMB_COUNT = () => (innerWidth < 700 ? 90 : innerWidth < 1200 ? 170 : 260);
let ambFrame = 0;
function swloop(t) {
  if (!sg || REDUCED) return;
  requestAnimationFrame(swloop);
  if (document.hidden || !window.MOTUSVIZ) return;
  if (!SWW || Math.abs(innerWidth * DPR - SWW) > 40) swsize();
  const dot = MOTUSVIZ.dot;

  // ── the world, filling the whole display ──
  ambFrame++;
  const everyOther = innerWidth < 700 && (ambFrame & 1);
  if (!everyOther) {
    MOTUSVIZ.renderAmbient(sg, S.dj.scene, {
      t, e: S.energy * .85, drop: S.drop, phrase: S.phrase,
      W: SWW, H: SWH, hue: S.dj.hue, hue2: S.dj.hue2,
      v: S.evo || (evolve(true), S.evo), DPR: AMB_DPR,
      count: AMB_COUNT(), power: S.power ? S.power.id : '',
      nodes: Math.max(3, ((S.live && S.live.items) || []).length || 6),
      amb: S.theater ? .1 : .38,          // theater dims the room; the stage IS the room
    });
  }
  sg.globalCompositeOperation = 'lighter';
  const scroll = window.scrollY || 0;
  // ── the deep field ──
  for (const st of stars) {
    const depth = .2 + st.z * .8;
    const y = ((st.y - scroll * .00006 * depth) % 1 + 1) % 1;
    const tw = .55 + Math.sin(t * .0013 + st.tw) * .45;                 // real twinkle
    const a = (.1 + st.z * .34) * tw;
    dot(sg, st.x * SWW, y * SWH, (.5 + st.z * 1.7) * DPR, st.hue ? S.dj.hue2 : '#BBD4FF', a);
  }
  // ── a comet, rarely — the surprise the void owes you ──
  if (!comet && Math.random() < .0016) comet = { x: -.05, y: Math.random() * .5, vx: .009, vy: .0045, life: 1 };
  if (comet) {
    comet.x += comet.vx; comet.y += comet.vy; comet.life -= .006;
    if (comet.life <= 0 || comet.x > 1.1) comet = null;
    else {
      for (let i = 0; i < 16; i++) {                                     // a glowing tail, not a line
        const k = i / 16;
        dot(sg, (comet.x - comet.vx * i * 2.4) * SWW, (comet.y - comet.vy * i * 2.4) * SWH,
          (3.6 - k * 3) * DPR, i < 3 ? '#FFFFFF' : S.dj.hue2, comet.life * (1 - k) * .5);
      }
    }
  }
  // ── the gravity swarm: orbital mechanics around what you are reading ──
  // On desktop it also NOTICES YOUR CURSOR — hold still near it and part of the
  // being drifts to you. Presence, not a particle effect.
  const fresh = S.mt && (t - S.mt) < 2600;
  const ax = fresh ? S.mx : attractor.x * innerWidth;
  const ay = fresh ? S.my : attractor.y * innerHeight;
  for (const p of being) {
    const dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy) || 1;
    const ring = 96 + Math.sin(p.ph + t * .0004) * 48;
    p.vx += (dx / d) * (d - ring) * .0016 + Math.sin(t * .001 + p.ph) * .05;
    p.vy += (dy / d) * (d - ring) * .0016 + Math.cos(t * .0008 + p.ph) * .05;
    p.vx += -dy / d * .07; p.vy += dx / d * .07;                        // tangential — it orbits
    p.vx *= .95; p.vy *= .95; p.x += p.vx; p.y += p.vy;
    dot(sg, p.x * DPR, p.y * DPR, p.sz * 2.2 * DPR, S.dj.hue, .3);
  }
  for (let i = 0; i < 22; i++) {                                         // micro-lightning inside the being
    const a = being[(i * 5) % being.length], b = being[(i * 11 + 3) % being.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 70) {
      sg.globalAlpha = .1; sg.strokeStyle = S.dj.hue2; sg.lineWidth = DPR;
      sg.beginPath(); sg.moveTo(a.x * DPR, a.y * DPR); sg.lineTo(b.x * DPR, b.y * DPR); sg.stroke();
    }
  }
  sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
}

/* ═══ THE BROADCAST — what August selected, and nothing else ═══ */
async function pollLive() {
  const j = await tryJson(`${API}/api/live?ts=${Date.now()}`, 8000);
  if (!j) return;
  S.live = j;
  const on = !!j.on;
  $('#livedot').classList.toggle('off', !on);
  $('#livedot span').textContent = on ? 'BUILDING LIVE' : 'OFF AIR';
  $('#goal .v').textContent = j.goal || j.topic || 'Between sessions — the systems keep moving.';
  $('#motus .v').textContent = j.motus || 'Motus is the mindset. The mindset means move.';
  const feed = $('#feed');
  feed.innerHTML = (j.items || []).length
    ? j.items.map((it) => `<div class="witem"><span class="kind">${esc(it.kind || 'WORK')}</span><span class="t">${esc(it.t)}</span></div>`).join('')
    : `<div class="quiet">Nothing is being broadcast right now. When August goes live, the selected work appears here — only what he chooses to share, ever.</div>`;
  $('#agents').innerHTML = (j.agents || []).length
    ? j.agents.map((a) => `<div class="agent-row"><span class="nm">${esc(a.name)}</span><span class="fo">${esc(a.focus)}</span></div>`).join('')
    : `<div class="quiet">The fleet is resting.</div>`;
  if (j.dj && j.dj !== S.dj.id && !RIGHTNOW) { const d = P.djs.find((x) => x.id === j.dj); if (d) setDj(d, false); }
  if (j.power) { const pw = P.powers.find((x) => x.id === j.power); if (pw && (!S.power || S.power.id !== pw.id)) setPower(pw); }
}
function esc(s) { const d = document.createElement('i'); d.textContent = String(s || ''); return d.innerHTML; }

/* ═══ SOURCECROWD — the community voice: ranked, linked, alive ═══ */
async function pollCrowd() {
  const j = await tryJson(`${API}/api/chat?ts=${Date.now()}`, 8000);
  if (!j || !j.msgs) return;
  S.msgs = j.msgs;
  renderCrowd();
}
function renderCrowd() {
  const msgs = [...S.msgs];
  if (S.scTab === 'top') msgs.sort((a, b) => (b.votes || 0) - (a.votes || 0) || b.ts - a.ts);
  // the resource strip — the strongest links the crowd has surfaced
  const links = msgs.filter((m) => m.link).sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 4);
  $('#scRes').innerHTML = links.length
    ? `<div class="k">TOP RESOURCES — what the crowd rated highest</div><div class="row">${links.map((m) =>
        `<a class="sc-link" href="${esc(m.link)}" target="_blank" rel="noopener nofollow">⤴ ${esc(m.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42))}</a>`).join('')}</div>`
    : '';
  $('#msgs').innerHTML = msgs.slice(0, 50).map((m) => `
    <div class="sc-msg">
      <div class="sc-vote ${S.voted[m.id] ? 'mine' : ''}" role="button" tabindex="0" data-vote="${esc(m.id)}" title="raise this voice">
        <span class="n">${m.votes || 0}</span><span class="a">▲</span>
      </div>
      <div class="sc-body">
        <span class="sc-who">${esc(m.name)}</span><span class="sc-when">${new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div class="sc-tx">${esc(m.text)}</div>
        ${m.link ? `<a class="sc-link" href="${esc(m.link)}" target="_blank" rel="noopener nofollow">⤴ ${esc(m.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48))}</a>` : ''}
      </div>
    </div>`).join('')
    || '<div class="quiet">The crowd is quiet — be the first voice, drop a link, raise what matters.</div>';
  $$('#msgs [data-vote]').forEach((b) => {
    const go = () => vote(b.dataset.vote);
    b.addEventListener('click', go);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}
async function vote(id) {
  if (S.voted[id]) return;
  S.voted[id] = 1;
  localStorage.setItem('sc.voted', JSON.stringify(S.voted));
  const m = S.msgs.find((x) => x.id === id); if (m) m.votes = (m.votes || 0) + 1;
  renderCrowd();                                  // optimistic — the crowd feels instant
  await fetch(`${API}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vote: id }),
  }).catch(() => {});
}
async function sendCrowd(e) {
  e.preventDefault();
  const name = $('#c-name').value.trim().slice(0, 40) || 'anon';
  const text = $('#c-text').value.trim().slice(0, 420);
  if (!text) return;
  $('#c-send').disabled = true;
  const r = await fetch(`${API}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, text, web: $('#c-web').value }),
  }).then((x) => x.json()).catch(() => null);
  $('#c-send').disabled = false;
  if (r && r.ok) { $('#c-text').value = ''; pollCrowd(); }
  else note(r && r.error ? esc(r.error) : 'the crowd is catching its breath — one more try in a moment');
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEND YOUR GPU — donated compute, rung 1: pledge + real probe.

   ⚠ THE HONESTY LAW HERE. This MEASURES hardware; it never estimates from the
   user-agent, never counts a pledge as capacity that isn't there, and tells a
   device with no WebGPU that it has none instead of quietly counting it. It
   also does no work yet — it says so. A counter that inflates itself would be
   worth less than no counter.

   And it can never make Davara faster: she runs on Claude, in Anthropic's data
   centres. Donated GPUs run OPEN models, render visuals, and crunch research.
   Saying otherwise would be a lie, so the copy says exactly that.
   ═══════════════════════════════════════════════════════════════════════════ */
const GPU = { probed: false, ok: false, info: null, pledged: false };
try { GPU.pledged = localStorage.getItem('gpu.pledge') === '1'; } catch {}

async function probeGPU() {
  GPU.probed = true;
  if (!navigator.gpu) { GPU.ok = false; GPU.info = { why: 'this browser has no WebGPU' }; return GPU; }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) { GPU.ok = false; GPU.info = { why: 'WebGPU is present but no adapter was granted' }; return GPU; }
    const i = (adapter.info || {});
    const L = adapter.limits || {};
    // real numbers off the real adapter — the honest measure of what was lent
    const buf = Number(L.maxStorageBufferBindingSize || 0);
    const tier = buf >= 2e9 ? 'workstation' : buf >= 1e9 ? 'desktop' : buf >= 2.5e8 ? 'laptop' : 'light';
    GPU.ok = true;
    GPU.info = {
      vendor: i.vendor || 'unknown', arch: i.architecture || '', device: i.device || '',
      maxBuffer: buf, maxWorkgroup: Number(L.maxComputeWorkgroupSizeX || 0),
      maxInvocations: Number(L.maxComputeInvocationsPerWorkgroup || 0), tier,
    };
  } catch (e) { GPU.ok = false; GPU.info = { why: (e && e.message) || 'the adapter refused' }; }
  return GPU;
}
function gpuLine() {
  if (!GPU.probed) return 'checking what this device can actually offer…';
  if (!GPU.ok) return `<b>No WebGPU here</b> — ${esc((GPU.info || {}).why || 'unavailable')}. Nothing to lend from this device, and it would be dishonest to count it.`;
  const i = GPU.info;
  const gb = (i.maxBuffer / 1073741824).toFixed(2);
  return `<b>${esc(i.vendor)}${i.arch ? ' · ' + esc(i.arch) : ''}</b> — <b>${esc(i.tier)}</b> class · ${gb} GB max buffer · ${i.maxInvocations} invocations/workgroup. That is measured off your actual adapter, not guessed.`;
}
async function pledgeGPU() {
  if (!GPU.probed) await probeGPU();
  if (!GPU.ok) { renderGPU(); return; }
  GPU.pledged = !GPU.pledged;
  try { localStorage.setItem('gpu.pledge', GPU.pledged ? '1' : '0'); } catch {}
  renderGPU();
}
function renderGPU() {
  const el = $('#gpuBody'); if (!el) return;
  const i = GPU.info || {};
  el.innerHTML = `
    <p class="gpu-read">${gpuLine()}</p>
    <div class="gpu-row">
      <button class="btn ${GPU.pledged ? '' : 'prime'} ${GPU.ok ? '' : 'off'}" id="gpuBtn" ${GPU.ok ? '' : 'disabled'}>
        ${GPU.pledged ? '◼ STOP LENDING' : '⚡ LEND YOUR GPU'}
      </button>
      <span class="gpu-state ${GPU.pledged ? 'on' : ''}">${GPU.pledged
        ? 'Pledged. Nothing is running yet — jobs arrive at rung 2, and you can stop any time.'
        : 'Opt-in only. Nothing ever runs without this button, and closing the tab ends it.'}</span>
    </div>
    <p class="gpu-fine">Lent GPUs run <b>open-weight models</b>, render the MotusLive worlds, and crunch community research — <b>public work only</b>. They cannot speed up Davara: she runs on Claude in Anthropic's data centres, and pretending otherwise would be a lie. No background compute, no auto-start, one click to stop.</p>`;
  const b = $('#gpuBtn'); if (b) b.onclick = pledgeGPU;
}

/* ═══ BUILD THE UI ═══ */
function buildDeck() {
  $('#deck').innerHTML = P.djs.map((d) => `
    <div class="dj-card" role="button" tabindex="0" data-id="${d.id}" style="--c:${d.hue}">
      ${d.headliner ? '<span class="dj-tag">HEADLINER</span>' : d.artist ? '<span class="dj-tag">THE ARTIST</span>' : ''}
      <div class="dj-name">${d.name}</div>
      <div class="dj-say">/${d.say}/</div>
      <span class="dj-power">◈ ${d.power}</span>
      <div class="dj-ability">${d.ability}</div>
      <details class="dj-more"><summary>GO DEEPER ▾</summary>
        <p><b>Name:</b> ${d.meaning}</p>
        <p><b>Sound:</b> ${d.vibe}</p>
        <p><b>Wave power:</b> ${d.wave}</p>
      </details>
    </div>`).join('');
  $$('.dj-card').forEach((c) => {
    const go = () => setDj(P.djs.find((d) => d.id === c.dataset.id), true);
    c.addEventListener('click', (e) => { if (!e.target.closest('details')) go(); });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  $('#powers').innerHTML = P.powers.map((pw) => `
    <div class="power" role="button" tabindex="0" data-id="${pw.id}">
      <h4>${pw.name}</h4><div class="sys">${pw.sys}</div><p>${pw.does}</p>
    </div>`).join('');
  $$('#powers .power').forEach((c) => {
    const go = () => setPower(P.powers.find((p) => p.id === c.dataset.id));
    c.addEventListener('click', go);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  $('#goal .v').textContent = 'Between sessions — the systems keep moving.';
  $('#motus .v').textContent = 'Motus is the mindset. The mindset means move.';
  $('#feed').innerHTML = '<div class="quiet">Nothing is being broadcast right now. When August goes live, the selected work appears here — only what he chooses to share, ever.</div>';
  $('#agents').innerHTML = '<div class="quiet">The fleet is resting.</div>';
  $('#msgs').innerHTML = '<div class="quiet">The crowd is quiet — be the first voice.</div>';
}

/* ═══ IGNITION ═══ */
addEventListener('DOMContentLoaded', () => {
  buildDeck();
  setDj(P.djs[0], false);
  vsize(); swsize();
  requestAnimationFrame(vloop);
  requestAnimationFrame(swloop);
  // Every one of these IS a user gesture by definition, so mark it here rather
  // than relying on a pointerdown listener having fired first — that ordering
  // is the difference between a music stream and a silent one.
  $('#play').addEventListener('click', () => { S.gesture = true; spin(false); });
  $('#next').addEventListener('click', () => { S.gesture = true; spin(true); });
  $('#src').addEventListener('click', () => {
    S.mode = S.mode === 'relay' ? 'direct' : 'relay';
    $('#src').textContent = S.mode === 'relay' ? '⛨ TRYING AD-FREE' : '▶ DIRECT · PLAYS';
    localStorage.removeItem('vibe.instAt');           // re-probe on an explicit switch
    paintSource();
    // ⚠ ALWAYS RE-MOUNT. The old code only re-mounted `if (S.playing)`, so
    // switching source while a dead relay frame sat there did NOTHING — the
    // "Checking your browser…" page just stayed on screen, which reads as the
    // toggle being broken. Switching the source must always change the source.
    spin(false);
  });
  // If the relay hangs (an interstitial we cannot see cross-origin), one tap
  // gets the music back. Shown only while the relay is selected.
  const bail = $('#bail');
  if (bail) bail.addEventListener('click', () => {
    S.mode = 'direct';
    $('#src').textContent = '▶ DIRECT · PLAYS';
    paintSource(); spin(false);
  });
  paintSource();
  $$('.sc-tab').forEach((b) => b.addEventListener('click', () => {
    S.scTab = b.dataset.tab;
    $$('.sc-tab').forEach((x) => x.classList.toggle('on', x === b));
    renderCrowd();
  }));

  /* ═══ DESKTOP — the keyboard IS the deck ═══
     On a big screen this should feel like an instrument, not a web page:
     ← → walk the pantheon · 1-9 jump to a DJ · SPACE plays / next drop
     T theater (the stage fills the screen) · 1..5 with shift fires a power. */
  const theater = (on) => {
    S.theater = on === undefined ? !S.theater : on;
    document.body.classList.toggle('theater', S.theater);
    const b = $('#theaterBtn'); if (b) b.textContent = S.theater ? '⤡ EXIT THEATER' : '⤢ THEATER';
    setTimeout(vsize, 340);                       // the stage just changed size
  };
  const tBtn = $('#theaterBtn'); if (tBtn) tBtn.addEventListener('click', () => theater());
  addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;      // never steal the composer
    const i = P.djs.findIndex((d) => d.id === S.dj.id);
    if (ev.key === 'ArrowRight') { setDj(P.djs[(i + 1) % P.djs.length], true); ev.preventDefault(); }
    else if (ev.key === 'ArrowLeft') { setDj(P.djs[(i - 1 + P.djs.length) % P.djs.length], true); ev.preventDefault(); }
    else if (ev.key === ' ') { S.playing ? spin(true) : spin(false); ev.preventDefault(); }
    else if (ev.key === 't' || ev.key === 'T') theater();
    else if (ev.key === 'Escape' && S.theater) theater(false);
    else if (/^[1-9]$/.test(ev.key)) {
      if (ev.shiftKey) { const pw = P.powers[+ev.key - 1]; if (pw) setPower(pw); }
      else { const d = P.djs[+ev.key - 1]; if (d) setDj(d, true); }
    }
  });
  // the swarm notices your cursor — the page is aware you are in the room
  addEventListener('pointermove', (ev) => { S.mx = ev.clientX; S.my = ev.clientY; S.mt = performance.now(); }, { passive: true });
  $('#chat-form').addEventListener('submit', sendCrowd);
  renderGPU();
  probeGPU().then(renderGPU);          // measure the real adapter, then tell the truth
  pollLive(); pollCrowd();
  setInterval(pollLive, 9000);
  setInterval(pollCrowd, 12000);
});
})();
