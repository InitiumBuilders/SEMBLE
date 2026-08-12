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
      // the adapter's own declared feature set — what it can ACTUALLY run.
      // shader-f16 in particular decides whether an open-weight model is
      // viable here at all, so it is worth surfacing rather than averaging away.
      features: [...(adapter.features || [])].slice(0, 16),
      maxWorkgroupsPerDim: Number(L.maxComputeWorkgroupsPerDimension || 0),
      maxStorageBuffers: Number(L.maxStorageBuffersPerShaderStage || 0),
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
/* ── the ledger: who pledged what, and where they want to be paid ── */
try {
  GPU.id = localStorage.getItem('gpu.id') || Math.random().toString(36).slice(2, 12);
  localStorage.setItem('gpu.id', GPU.id);
  GPU.dash = localStorage.getItem('gpu.dash') || '';
  GPU.trust = localStorage.getItem('gpu.trust') || '';
  GPU.pref = localStorage.getItem('gpu.pref') === 'trust' ? 'trust' : 'dash';
} catch { GPU.id = Math.random().toString(36).slice(2, 12); GPU.dash = ''; GPU.trust = ''; }
GPU.pool = null;

async function pushPledge(extra = {}) {
  if (!GPU.ok) return null;
  const i = GPU.info || {};
  const r = await fetch(`${API}/api/compute`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: GPU.id, tier: 'tab', vendor: i.vendor, arch: i.arch, klass: i.tier,
      maxBufferMB: Math.round((i.maxBuffer || 0) / 1048576), invocations: i.maxInvocations,
      features: i.features || [],
      // ATTRIBUTION: every second is credited to the DJ who was on and the mode
      // it was watched in. Without this the ledger knows how much but not whose
      // set earned it — and "which world pulled the compute" is the interesting
      // question, not the total.
      dj: (S.dj && S.dj.id) || 'unknown',
      mode: S.theater ? 'theater' : (S.mode || 'direct'),
      dash: GPU.dash, trust: GPU.trust, ...extra,
    }),
  }).then((x) => x.json()).catch(() => null);
  if (r && r.ok) { GPU.mine = r; renderGPU(); }
  return r;
}
async function pollPool() {
  const j = await tryJson(`${API}/api/compute?ts=${Date.now()}`, 8000);
  if (j) { GPU.pool = j; renderPool(); renderCommonsStrip(); }
}
async function pollPayouts() {
  const j = await tryJson(`${API}/api/payouts?ts=${Date.now()}`, 8000);
  if (j) { GPU.pay = j; renderPayouts(); }
}
async function pollGolem() {
  const j = await tryJson(`${API}/api/golem?ts=${Date.now()}`, 12000);
  if (j) { GPU.golem = j; renderGolem(); }
}
async function pollWork() {
  const j = await tryJson(`${API}/api/work?ts=${Date.now()}`, 8000);
  if (j) { GPU.work = j; renderWork(); renderCommonsStrip(); }
}
async function pollReceipts() {
  const j = await tryJson(`${API}/api/receipts?node=${encodeURIComponent(GPU.id)}&ts=${Date.now()}`, 8000);
  if (j) { GPU.receipts = j; renderReceipts(); renderGPU(); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE WORKER — rung 5. This is where a pledge stops being a promise.

   ⚠ EVERY KERNEL IS INTEGER-ONLY, and imported from the SAME definition the
   server uses. Verification works by two machines computing one unit and
   comparing digests — which only works if the result is bit-identical across
   vendors. JS/WebGPU float ops are NOT guaranteed identical across GPUs,
   drivers, or instruction orderings, so a single float anywhere in here would
   make honest machines look like liars. Integers only. No Math.random, no
   Date, no iteration over unordered structures.

   THE CONTRACT WITH THE CONTRIBUTOR:
   · nothing runs until they press the button
   · one press stops it dead, mid-unit
   · closing the tab ends it
   · it yields between units so the page never janks
   · public work only — the payload is served publicly to anyone who asks
   ═══════════════════════════════════════════════════════════════════════════ */
const W = { on: false, busy: false, done: 0, last: '', timer: 0, quarantined: false };

/* the kernels — identical to _motus.ts, and that is deliberate, not duplication
   by accident. If you change one, change both, and the harness will tell you. */
function fnv1a(s, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) & 0xff; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function embedVec(text, seed, dims = 64) {
  const v = new Array(dims).fill(0);
  const toks = String(text).toLowerCase().split(/[^a-z0-9]+/);
  for (const t of toks) { if (t.length < 2) continue; v[fnv1a(t, (seed >>> 0) || 2166136261) % dims]++; }
  return v;
}
function isqrtI(n) {
  if (n < 2) return n < 0 ? 0 : n;
  let x = n, y = Math.floor((x + 1) / 2);
  while (y < x) { x = y; y = Math.floor((x + Math.floor(n / x)) / 2); }
  return x;
}
function scoreVecI(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return Math.floor((dot * 10000) / Math.max(1, isqrtI(na) * isqrtI(nb)));
}

/* THE MATMUL KERNEL — INT8 x INT8 -> INT32, the real primitive of quantized
   model inference, and EXACT on every machine. A float matmul could not be
   verified by digest at all: two honest GPUs would differ in the low bits and
   both would look like liars. */
function tileI(seed, n) {
  const v = new Array(n * n); let h = (seed >>> 0) || 2166136261;
  for (let i = 0; i < n * n; i++) {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) >>> 0);
    h = (Math.imul(h ^ (h >>> 13), 3266489909) >>> 0);
    v[i] = ((h >>> 24) & 0xff) - 128;
  }
  return v;
}
function matmulTileI(a, b, n) {
  const c = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const aik = a[i * n + k]; if (!aik) continue;
    for (let j = 0; j < n; j++) c[i * n + j] += aik * b[k * n + j];
  }
  return c;
}
function runUnitLocal(u) {
  let out = '';
  if (u.kind === 'embed' || u.kind === 'canary') out = embedVec(u.payload, u.seed).join(',');
  else if (u.kind === 'matmul') {
    const n = Math.max(4, Math.min(64, parseInt(u.payload, 10) || 32));
    const c = matmulTileI(tileI(u.seed, n), tileI((u.seed ^ 0x9e3779b9) >>> 0, n), n);
    let acc = 0; for (let i = 0; i < c.length; i++) acc = (acc + Math.imul(c[i], i + 1)) | 0;
    out = n + ':' + acc;
  }
  else if (u.kind === 'score') {
    const sp = String(u.payload).split(' ');
    out = String(scoreVecI(embedVec(sp[0] || '', u.seed), embedVec(sp.slice(1).join(' ') || '', u.seed)));
  }
  return { out, digest: (fnv1a(out, (u.seed >>> 0) || 2166136261) >>> 0).toString(16).padStart(8, '0') };
}

async function workTick() {
  if (!W.on || W.busy || !GPU.pledged || !GPU.ok) return;
  W.busy = true;
  try {
    const claim = await tryJson(`${API}/api/work?node=${encodeURIComponent(GPU.id)}&ts=${Date.now()}`, 8000);
    if (claim && claim.quarantined) {
      // Honest machines fail by being ABSENT, not by being confidently wrong.
      // So this state is rare and worth explaining rather than hiding.
      W.on = false; W.quarantined = true; renderWork(); renderGPU();
      return;
    }
    const u = claim && claim.unit;
    if (!u) { W.last = 'queue empty — nothing to compute right now'; renderWork(); return; }

    const t0 = performance.now();
    const r = runUnitLocal(u);
    const ms = Math.round(performance.now() - t0);

    const res = await fetch(`${API}/api/work`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ node: GPU.id, unit: u.id, digest: r.digest, out: r.out.slice(0, 2000), ms }),
    }).then((x) => x.json()).catch(() => null);

    if (res && res.quarantined) { W.on = false; W.quarantined = true; }
    else if (res && res.ok) {
      W.done++;
      W.last = res.settled
        ? `unit ${u.id.slice(0, 8)} verified — agreed with an independent machine (+${res.earned} MOTUS-s)`
        : `unit ${u.id.slice(0, 8)} computed in ${ms}ms — waiting for ${res.waitingFor} more machine(s) to agree`;
      if (res.settled) pollReceipts();
    } else {
      W.last = (res && res.error) || 'the queue did not take that result';
    }
    renderWork(); renderGPU();
  } catch (e) {
    W.last = 'worker paused — ' + ((e && e.message) || 'network');
  } finally { W.busy = false; }
}

function toggleWork() {
  if (W.quarantined) return;
  W.on = !W.on;
  clearInterval(W.timer); W.timer = 0;
  if (W.on) {
    // A gap between units keeps the page responsive and keeps a phone cool.
    // Grinding a viewer's battery to look busy would be the worst possible
    // trade: they leave, and a contributor who leaves contributes nothing.
    W.timer = setInterval(workTick, 2500);
    workTick();
  }
  renderWork(); renderGPU();
}
/* ── number helpers: big numbers stay readable, small ones stay honest ── */
const nfmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));
const hfmt = (s) => (s >= 3600 ? (s / 3600).toFixed(1) + 'h' : s >= 60 ? Math.round(s / 60) + 'm' : Math.round(s) + 's');
const djName = (id) => (P.djs.find((d) => d.id === id) || {}).name || (id === 'unknown' ? 'unattributed' : id);
const djHue = (id) => (P.djs.find((d) => d.id === id) || {}).hue || 'var(--accent)';

/* ── the history bars: pure SVG, no library, theme-aware ──
   Only ever drawn from bucket.motusSeconds, which the API ACCUMULATES per beat.
   Deriving it as seconds×capability over-counted 3.4x — the chart and the
   payout engine must read the same number or the chart is a lie. */
function historyBars(hist) {
  if (!hist || !hist.length) return '<p class="pool-empty">No history yet — the first hour of contribution starts the record.</p>';
  const max = Math.max(...hist.map((h) => h.motusSeconds), 1);
  const W = 100, H = 34, n = hist.length;
  const bw = W / n;
  const bars = hist.map((h, i) => {
    const hh = Math.max(0.6, (h.motusSeconds / max) * H);
    const top = hist.slice().sort((a, b) => b.motusSeconds - a.motusSeconds)[0] === h;
    return `<rect x="${(i * bw).toFixed(3)}" y="${(H - hh).toFixed(2)}" width="${(bw * 0.72).toFixed(3)}" height="${hh.toFixed(2)}"
      rx="${Math.min(0.5, bw * 0.3).toFixed(2)}" class="hb${top ? ' peak' : ''}"><title>${new Date(h.t).toLocaleString()} — ${nfmt(h.motusSeconds)} MOTUS-s · ${h.nodes} node(s)</title></rect>`;
  }).join('');
  const first = new Date(hist[0].t), last = new Date(hist[hist.length - 1].t);
  return `<svg class="hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Contributed compute per hour, ${hist.length} hours">${bars}</svg>
    <div class="hist-ax"><span>${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${first.getHours()}:00</span>
      <span>peak ${nfmt(max)} MOTUS-s/h</span>
      <span>${last.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${last.getHours()}:00</span></div>`;
}

function renderPool() {
  const el = $('#poolBody'); if (!el || !GPU.pool) return;
  const p = GPU.pool, m = p.motus || {};
  const hrs = (p.seconds / 3600).toFixed(1);

  // ── per-DJ record: which set actually pulled the compute ──
  const djRows = (p.byDj || []).filter((d) => d.seconds > 0).map((d) => `
    <tr style="--c:${djHue(d.dj)}">
      <td class="dj"><i class="dot"></i>${esc(djName(d.dj))}</td>
      <td class="num">${hfmt(d.seconds)}</td>
      <td class="num">${d.nodes}</td>
      <td class="num">${d.capability}</td>
      <td class="bar"><span style="width:${Math.max(2, d.share)}%"></span><b>${d.share}%</b></td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">No attributed compute yet.</td></tr>';

  const modeRows = (p.byMode || []).map((x) => `
    <li><b>${esc(x.mode)}</b> <span>${hfmt(x.seconds)} · ${x.nodes} node${x.nodes === 1 ? '' : 's'}</span></li>`).join('');

  const tierRows = (p.byTier || []).filter((t) => t.count > 0).map((t) => `
    <li><b>${esc(t.tier)}</b> <span>${t.count} × · cap ${t.capability} · ${hfmt(t.seconds)}</span></li>`).join('')
    || '<li class="empty">nothing pledged yet</li>';

  el.innerHTML = `
    <div class="pool-grid">
      <div class="pool-stat"><span class="k">LIVE NOW</span><b>${p.live}</b><i>node${p.live === 1 ? '' : 's'} pledged and awake</i></div>
      <div class="pool-stat"><span class="k">POOL CAPABILITY</span><b>${p.liveCapability}</b><i>tab-equivalents — relative pledged capability, never a FLOPS claim</i></div>
      <div class="pool-stat"><span class="k">TOTAL CONTRIBUTED</span><b>${nfmt(m.accrued || 0)}</b><i>MOTUS-seconds — 1s of capability-1.0 compute</i></div>
      <div class="pool-stat"><span class="k">ALL TIME</span><b>${p.pledged}</b><i>machines have lent · ${hrs}h wall-clock</i></div>
    </div>

    <div class="pool-sub">
      <div class="ps-card">
        <div class="k">CONTRIBUTED PER HOUR</div>
        ${historyBars(p.history)}
      </div>
    </div>

    <div class="pool-two">
      <div class="ps-card">
        <div class="k">PER-DJ COMPUTE RECORD</div>
        <table class="djtab">
          <thead><tr><th>DJ</th><th class="num">time</th><th class="num">nodes</th><th class="num">cap</th><th>share</th></tr></thead>
          <tbody>${djRows}</tbody>
        </table>
      </div>
      <div class="ps-card">
        <div class="k">BY MODE</div><ul class="kv">${modeRows || '<li class="empty">no mode data yet</li>'}</ul>
        <div class="k" style="margin-top:14px">BY TIER</div><ul class="kv">${tierRows}</ul>
      </div>
    </div>

    <div class="pool-ledger">
      <div class="k">THE ACCRUAL — what is owed, and why it has not been sent</div>
      <div class="acc-row">
        <div><b>${nfmt(m.open || 0)}</b><span>MOTUS-s open</span></div>
        <div><b>${(m.owedDash || 0).toFixed(6)}</b><span>$DASH owed</span></div>
        <div><b>$${(m.owedUsd || 0).toFixed(2)}</b><span>at $${m.dashUsd}/DASH</span></div>
        <div class="${m.settleable ? 'go' : 'hold'}"><b>${m.settleable ? 'CLEARS' : 'HOLDING'}</b><span>floor $${m.settleFloorUsd}</span></div>
      </div>
      <p class="acc-why">${esc(m.why || '')} Balances accrue until they clear the floor — they never expire and they are never rounded away.</p>
    </div>

    <p class="pool-note">${p.jobsRunning
      ? 'Jobs are running.'
      : '<b>No jobs are dispatched yet.</b> This is the ledger, running honestly ahead of the work: pledges, attribution and accrual are recorded so the accounting exists before the first job does. Nothing is executing on your machine.'}</p>`;
}

/* ── the public payout ledger — every batch, every DJ, every rail ── */
function renderPayouts() {
  const el = $('#payBody'); if (!el || !GPU.pay) return;
  const j = GPU.pay, s = j.summary || {};
  const rows = (j.log || []).slice(0, 12).map((p) => `
    <tr class="st-${p.status}">
      <td>${new Date(p.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
      <td><span class="rail ${p.rail}">${p.rail.toUpperCase()}</span></td>
      <td>${esc(djName(p.dj) || 'all')}</td>
      <td class="num">${p.recipients}</td>
      <td class="num">${p.rail === 'dash' ? p.amount.toFixed(6) : '—'}</td>
      <td><span class="st">${p.status}</span></td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">No payout batches yet — nothing has been armed and no money has moved.</td></tr>`;

  const djPay = (j.byDj || []).map((d) => `
    <li style="--c:${djHue(d.dj)}"><i class="dot"></i><b>${esc(djName(d.dj))}</b>
      <span>${d.amount.toFixed(6)} DASH · ${d.recipients} paid · ${d.batches} batch${d.batches === 1 ? '' : 'es'}</span></li>`).join('')
    || '<li class="empty">No DJ has paid out yet.</li>';

  el.innerHTML = `
    <div class="pay-head">
      <div class="pay-stat"><span class="k">MONEY MOVED</span><b class="${j.moneyMoved ? 'go' : ''}">${j.moneyMoved ? 'YES' : 'NOT YET'}</b><i>${s.sent || 0} batch${s.sent === 1 ? '' : 'es'} sent</i></div>
      <div class="pay-stat"><span class="k">$DASH SENT</span><b>${(s.dashSent || 0).toFixed(6)}</b><i>${s.recipientsPaid || 0} recipient(s) all time</i></div>
      <div class="pay-stat"><span class="k">OPEN</span><b>$${(s.openOwedUsd || 0).toFixed(2)}</b><i>${nfmt(s.motusSecondsOpen || 0)} MOTUS-s accrued, unsettled</i></div>
      <div class="pay-stat"><span class="k">$TRUST</span><b>${s.trustAttestations || 0}</b><i>attestations — receipts, never a reward</i></div>
    </div>
    <p class="pay-custody">🔑 ${esc(j.custody || '')}</p>
    <div class="pool-two">
      <div class="ps-card"><div class="k">PAYOUT LOG</div>
        <table class="djtab paytab">
          <thead><tr><th>when</th><th>rail</th><th>dj</th><th class="num">to</th><th class="num">DASH</th><th>state</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
      <div class="ps-card"><div class="k">PAID BY DJ</div><ul class="kv djpay">${djPay}</ul>
        <p class="pay-fine"><b>$TRUST is the receipt, never the reward.</b> Contributors cannot earn $TRUST for off-chain work — emissions go to veTRUST bonders. Rewards are $DASH; the attestation is the permanent record that you contributed.</p></div>
    </div>`;
}

/* ── THE WORK PANEL — the queue, and this machine's part in it ── */
function renderWork() {
  const el = $('#workBody'); if (!el) return;
  const w = GPU.work || {};
  const q = w.queue || {};
  const p2 = GPU.pool || {};
  const canWork = GPU.ok && GPU.pledged;
  el.innerHTML = `
    <div class="pool-grid">
      <div class="pool-stat"><span class="k">JOBS RUNNING</span><b class="${w.jobsRunning ? 'go' : ''}">${w.jobsRunning ? 'YES' : 'IDLE'}</b><i>${(q.open || 0) + (q.verifying || 0)} unit(s) waiting for a machine</i></div>
      <div class="pool-stat"><span class="k">VERIFIED</span><b>${w.completed || 0}</b><i>units agreed by ${w.need || 3} independent machines</i></div>
      <div class="pool-stat"><span class="k">YOUR UNITS</span><b>${W.done}</b><i>${W.on ? 'computing now' : 'idle'}</i></div>
      <div class="pool-stat"><span class="k">DISPUTED</span><b>${q.disputed || 0}</b><i>machines disagreed — nobody was credited, re-issued</i></div>
    </div>

    <div class="work-row">
      <button class="btn ${W.on ? '' : 'prime'} ${canWork && !W.quarantined ? '' : 'off'}" id="workBtn" ${canWork && !W.quarantined ? '' : 'disabled'}>
        ${W.quarantined ? '⚠ QUARANTINED' : W.on ? '◼ STOP COMPUTING' : '▶ START COMPUTING'}
      </button>
      <span class="work-state ${W.on ? 'on' : ''}">${W.quarantined
        ? 'This machine returned a wrong answer to a known-answer probe, so its results stopped counting. Reload the page to re-enrol.'
        : !GPU.ok ? 'No WebGPU on this device — nothing to compute with.'
        : !GPU.pledged ? 'Pledge your GPU above first, then you can take work.'
        : W.on ? (W.last || 'claiming a unit…')
        : 'Opt-in, again, on purpose. Pledging says available; this says go.'}</span>
    </div>

    <p class="work-fine"><b>How you know the work is real:</b> ${esc(w.verification || '')}
      Each unit is worth <b>${w.unitsWorth || 25} MOTUS-seconds</b> × your capability — completed work is worth more than availability, because availability is a promise and a verified result is a fact.</p>

    ${(q.verifying || 0) > 0 && (p2.live || 0) < (w.need || 3) ? `
      <p class="work-fine warn"><b>${q.verifying} unit(s) are waiting for more machines.</b>
      Verification needs <b>${w.need || 3}</b> independent machines and the pool currently has <b>${p2.live || 0}</b>.
      Nothing is lost — those units settle the moment enough people are here, and everyone who computed them is credited then.
      This is the honest cost of checking work properly: <b>a commons needs a crowd.</b></p>` : ''}

    ${w.standing && w.standing.on ? `<p class="work-fine dim"><b>Standing work:</b> when nothing is queued from a live task, the pool computes <b>${esc(w.standing.task)}</b> so your machine is never idle. It is real, verifiable work over public text — and it is labelled separately from work the operator actually needed done, because a pool that looks busy while secretly spinning its wheels would be worse than an honest idle one. <b>${w.standing.generated || 0}</b> unit(s) generated so far.</p>` : ''}

    ${(w.byTask || []).length ? `<div class="ps-card" style="margin-top:14px"><div class="k">WHAT THE POOL IS ACTUALLY WORKING ON</div>
      <ul class="kv">${w.byTask.map((t) => `<li><b>${esc(t.task)}</b><span>${t.units} unit(s) · ${t.contributors} machine(s)</span></li>`).join('')}</ul></div>` : ''}

    ${(w.recent || []).length ? `<div class="ps-card" style="margin-top:12px"><div class="k">RECENTLY VERIFIED</div>
      <div class="wlist">${w.recent.map((u) => `<div class="wrow"><span class="wk">${esc(u.kind)}</span>
        <span class="wt">${esc(u.task)}</span><code class="wd">${esc(u.digest)}</code>
        <span class="wby">${(u.by || []).join(' + ')}</span></div>`).join('')}</div></div>` : ''}`;
  const b = $('#workBtn'); if (b) b.onclick = toggleWork;
}

/* ── YOUR RECEIPTS — proof of what this machine actually did ── */
function renderReceipts() {
  const el = $('#rcptBody'); if (!el) return;
  const r = GPU.receipts || {};
  const you = r.you;
  if (!r.count) {
    el.innerHTML = `<p class="pool-empty">No receipts yet. A receipt appears the moment one of your computed units is confirmed by an independent machine — it is proof of work completed, not of time spent.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="pool-grid">
      <div class="pool-stat"><span class="k">UNITS COMPLETED</span><b>${r.count}</b><i>verified and agreed</i></div>
      <div class="pool-stat"><span class="k">COMPUTE TIME</span><b>${r.computeMs >= 1000 ? (r.computeMs / 1000).toFixed(1) + 's' : r.computeMs + 'ms'}</b><i>actual time your machine worked — these kernels are fast, and rounding that up to "0.0s" would be a small lie</i></div>
      <div class="pool-stat"><span class="k">EARNED</span><b>${nfmt(r.motusSeconds)}</b><i>MOTUS-s from completed work</i></div>
      ${you ? `<div class="pool-stat"><span class="k">OWED TO YOU</span><b>${(you.owed || 0).toFixed(6)}</b><i>${esc(you.unit)} · $${(you.owedUsd || 0).toFixed(2)}</i></div>` : ''}
    </div>
    ${(r.byTask || []).length ? `<div class="ps-card" style="margin-top:14px"><div class="k">WHAT YOU HELPED FINISH</div>
      <ul class="kv">${r.byTask.map((t) => `<li><b>${esc(t.task)}</b><span>${t.units} unit(s) · ${(t.ms / 1000).toFixed(1)}s · ${nfmt(t.motusSeconds)} MOTUS-s</span></li>`).join('')}</ul></div>` : ''}
    <div class="ps-card" style="margin-top:12px"><div class="k">YOUR RECEIPTS</div>
      <div class="wlist">${(r.receipts || []).slice(0, 12).map((x) => `<div class="wrow">
        <span class="wk">${esc(x.kind)}</span><span class="wt">${esc(x.task)}</span>
        <code class="wd">${esc(x.digest || '—')}</code>
        <span class="wby">${x.ms}ms · +${x.motusSeconds} MOTUS-s</span></div>`).join('')}</div>
      <p class="work-fine">${esc(r.verified || '')} The digest is the auditable artefact — anyone can re-run the unit with the published kernel and check they get the same eight characters.</p>
    </div>`;
}

/* ── THE COMMONS TABS ──────────────────────────────────────────────────────
   Five stacked full-height sections were a wall. A wall is what "busy" means:
   everything shouting at one volume, so nothing reads as important. One view at
   a time, with the four numbers that actually matter pinned above the tabs so
   you never have to go looking for them. */
function setTab(name) {
  $$('.cmn-tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('.cmn-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === name));
  try { localStorage.setItem('cmn.tab', name); } catch {}
}

/* The pinned strip: the whole commons in four numbers, always visible. */
function renderCommonsStrip() {
  const el = $('#cmnLive'); if (!el) return;
  const p = GPU.pool || {}, w = GPU.work || {}, m = p.motus || {};
  const q = w.queue || {};
  const live = (q.open || 0) + (q.verifying || 0);
  el.innerHTML = `
    <div class="cl-item ${w.jobsRunning ? 'go' : ''}"><b>${w.jobsRunning ? 'RUNNING' : 'IDLE'}</b><span>${live} unit${live === 1 ? '' : 's'} out</span></div>
    <div class="cl-item"><b>${p.live || 0}</b><span>machine${(p.live || 0) === 1 ? '' : 's'} lending</span></div>
    <div class="cl-item"><b>${w.completed || 0}</b><span>units verified</span></div>
    <div class="cl-item"><b>${nfmt(m.accrued || 0)}</b><span>MOTUS-s earned</span></div>`;
}

/* ── the Golem gauge: measured on every load, never a stored claim ── */
function renderGolem() {
  const el = $('#golemBody'); if (!el || !GPU.golem) return;
  const g = GPU.golem, s = g.supply || {}, v = g.verdict || {};
  const rt = Object.entries(s.runtimes || {}).map(([k, n]) => `<li><b>${esc(k)}</b><span>${n}</span></li>`).join('');
  el.innerHTML = `
    <div class="gol-grid">
      <div class="pool-stat"><span class="k">PROVIDERS ONLINE</span><b>${s.providers || 0}</b><i>measured just now from Golem's own API</i></div>
      <div class="pool-stat ${s.gpus ? '' : 'zero'}"><span class="k">GPUs ONLINE</span><b>${s.gpus || 0}</b><i>${s.gpus ? 'GPU rental is possible' : 'no GPU supply exists on the network'}</i></div>
      <div class="pool-stat"><span class="k">ADAPTER</span><b>${g.adapter && g.adapter.configured ? 'WIRED' : 'STANDBY'}</b><i>requestor path${g.adapter && g.adapter.configured ? ' configured' : ' — one env var from live'}</i></div>
    </div>
    <ul class="kv gol-rt">${rt || '<li class="empty">no runtimes reported</li>'}</ul>
    <p class="gol-note"><b>Viewers cannot contribute through Golem.</b> ${esc(v.whyNot || '')}</p>
    <p class="gol-note dim">${esc(v.rentNote || '')} <b>This gauge re-measures every time you load the page</b> — if supply ever appears, this panel says so on its own.</p>`;
}

/* ⚠ ONE MOVE, NOT TWO.
   Pledging and computing were separate clicks. The distinction is real —
   "available" is not "go" — but it cost the cheapest-possible-first-move,
   which is the entire thesis of this project. A stranger should not have to
   discover a second button to make anything happen.

   So the primary action now does both, and the copy says so plainly before it
   is pressed. Consent is not weakened: nothing runs until this button, one
   press stops everything, and closing the tab ends it. */
async function pledgeGPU() {
  if (!GPU.probed) await probeGPU();
  if (!GPU.ok) { renderGPU(); return; }
  GPU.pledged = !GPU.pledged;
  try { localStorage.setItem('gpu.pledge', GPU.pledged ? '1' : '0'); } catch {}
  if (GPU.pledged) {
    await pushPledge({ seconds: 0 });
    clearInterval(GPU.beat);
    // a heartbeat is what makes "live now" mean something rather than "ever"
    GPU.beat = setInterval(() => { if (GPU.pledged) pushPledge({ seconds: 60 }); }, 60000);
    if (!W.on && !W.quarantined) toggleWork();     // …and actually start working
  } else {
    clearInterval(GPU.beat); GPU.beat = 0;
    if (W.on) toggleWork();                         // stopping means stopping
  }
  renderGPU(); pollPool(); pollWork();
}
async function saveWallets() {
  const d = ($('#gpuDash').value || '').trim();
  const t = ($('#gpuTrust').value || '').trim();
  const msg = $('#gpuWalletMsg');
  const r = await fetch(`${API}/api/compute`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: GPU.id, tier: 'tab', dash: d, trust: t }),
  }).then((x) => x.json()).catch(() => null);
  if (r && r.ok) {
    GPU.dash = d; GPU.trust = t;
    try { localStorage.setItem('gpu.dash', d); localStorage.setItem('gpu.trust', t); } catch {}
    msg.className = 'gpu-msg ok';
    msg.textContent = 'Saved. When rung 3 pays out, this is where it goes.';
    pollPool();
  } else {
    msg.className = 'gpu-msg bad';
    msg.textContent = (r && r.error) || 'that did not save';
  }
}
function renderGPU() {
  const el = $('#gpuBody'); if (!el) return;
  const i = GPU.info || {};
  el.innerHTML = `
    <p class="gpu-read">${gpuLine()}</p>
    <div class="gpu-row">
      <button class="btn ${GPU.pledged ? '' : 'prime'} ${GPU.ok ? '' : 'off'}" id="gpuBtn" ${GPU.ok ? '' : 'disabled'}>
        ${GPU.pledged ? '◼ STOP' : '⚡ LEND & START'}
      </button>
      <span class="gpu-state ${GPU.pledged ? 'on' : ''}">${GPU.pledged
        ? (W.on ? (W.last || 'computing — claiming a unit…') : 'Lending. Computing is paused; the Work tab restarts it.')
        : 'One press: your machine joins the pool and starts computing. Nothing runs before it, one press stops everything, and closing the tab ends it.'}</span>
    </div>
    <p class="gpu-fine">Lent GPUs run <b>open-weight models</b>, render the MotusLive worlds, and crunch community research — <b>public work only</b>. They cannot speed up Davara: she runs on Claude in Anthropic's data centres, and pretending otherwise would be a lie. No background compute, no auto-start, one click to stop.</p>
    ${GPU.mine && GPU.pledged ? `
    <div class="mine">
      <div class="k">YOUR RECORD — this device, on this ledger</div>
      <div class="mine-row">
        <div><b>${nfmt(GPU.mine.accrued || 0)}</b><span>MOTUS-s contributed</span></div>
        <div><b>${(GPU.mine.owedDash || 0).toFixed(6)}</b><span>$DASH accrued</span></div>
        <div><b>${GPU.mine.capability}</b><span>your capability</span></div>
        <div class="${GPU.mine.settleable ? 'go' : 'hold'}"><b>${GPU.mine.settleable ? 'CLEARS' : 'BUILDING'}</b><span>toward the $5 floor</span></div>
      </div>
      ${(GPU.info && GPU.info.features || []).length ? `<p class="mine-feat">Adapter features: ${(GPU.info.features).map((f) => `<code>${esc(f)}</code>`).join(' ')}</p>` : ''}
      <p class="mine-fine">Attributed to <b>${esc((S.dj && S.dj.name) || 'unknown')}</b> in <b>${esc(S.theater ? 'theater' : S.mode)}</b> mode. Your balance accrues until it clears the off-ramp floor — it never expires and it is never rounded away.</p>
    </div>` : ''}
    <div class="gpu-wallets">
      <div class="k">WHERE TO PAY YOU — optional, and only ever your RECEIVING address</div>
      <div class="gpu-w-row">
        <input class="om-in" id="gpuDash" placeholder="$DASH address (starts with X)…" value="${esc(GPU.dash)}" spellcheck="false" autocomplete="off">
        <input class="om-in" id="gpuTrust" placeholder="$TRUST / EVM address (0x…)…" value="${esc(GPU.trust)}" spellcheck="false" autocomplete="off">
        <button class="mini" id="gpuSave">save</button>
      </div>
      <div class="gpu-msg" id="gpuWalletMsg"></div>

      <div class="rail-pick">
        <div class="k">PAY ME IN — your choice, and only yours</div>
        <div class="rail-opts">
          <button class="rail-opt ${GPU.pref !== 'trust' ? 'on' : ''}" data-rail="dash">
            <b>$DASH</b><span>~2s finality · a real off-ramp · the default</span></button>
          <button class="rail-opt ${GPU.pref === 'trust' ? 'on' : ''}" data-rail="trust">
            <b>$TRUST</b><span>same earned value, sent in $TRUST</span></button>
        </div>
        <p class="rail-fine">Both rails pay the <b>same earned value</b> — only the currency differs, and the $5 floor is applied in USD either way, so choosing $TRUST never means waiting longer.
        <br><b>⚠ To be exact about what $TRUST is here:</b> the operator <b>transfers $TRUST they already hold</b>. It is a payment in your currency of choice. It is <b>not</b> protocol emissions — Intuition emissions go only to veTRUST bonders and cannot be earned for off-chain work by anyone, ever. Nobody should tell you otherwise.</p>
      </div>

      <p class="gpu-warn">⚠ Paste an <b>address</b>, never a private key or a seed phrase. The server refuses anything shaped like a key — but nothing should ever ask you for one, here or anywhere.</p>
    </div>`;
  const b = $('#gpuBtn'); if (b) b.onclick = pledgeGPU;
  const s = $('#gpuSave'); if (s) s.onclick = saveWallets;
  $$('#gpuBody .rail-opt').forEach((o) => { o.onclick = () => setRail(o.dataset.rail); });
}

async function setRail(rail) {
  const msg = $('#gpuWalletMsg');
  const r = await fetch(`${API}/api/compute`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: GPU.id, tier: 'tab', payoutPref: rail }),
  }).then((x) => x.json()).catch(() => null);
  if (r && r.ok) {
    GPU.pref = rail;
    try { localStorage.setItem('gpu.pref', rail); } catch {}
    if (msg) { msg.className = 'gpu-msg ok'; msg.textContent = `Saved — you will be paid in ${rail === 'trust' ? '$TRUST' : '$DASH'}.`; }
    renderGPU(); pollPool();
  } else if (msg) {
    // The refusal that matters: choosing a rail you have no address for would
    // strand the balance forever, so it is refused with the reason.
    msg.className = 'gpu-msg bad';
    msg.textContent = (r && r.error) || 'could not set that rail';
  }
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
  // ⚠ RESUME MEANS RESUME. A returning contributor who already pressed
  // LEND & START came back expecting to still be lending — leaving them
  // "pledged but idle" makes them hunt for a second button to restart
  // something they never chose to stop. The pledge is the consent; the tab
  // being open is the session.
  probeGPU().then(() => {
    renderGPU();
    // resume a pledge across reloads — the heartbeat is what makes "live" true
    if (GPU.pledged && GPU.ok) {
      pushPledge({ seconds: 0 });
      GPU.beat = setInterval(() => { if (GPU.pledged) pushPledge({ seconds: 60 }); }, 60000);
      if (!W.on && !W.quarantined) toggleWork();     // …and pick the work back up
    }
  });
  pollPool(); setInterval(pollPool, 20000);
  // The payout ledger and the Golem gauge change on human timescales, not
  // per-frame ones — polling them hard would burn a phone battery to re-render
  // numbers that did not move. Golem's API is also somebody else's server.
  pollPayouts(); setInterval(pollPayouts, 60000);
  pollGolem(); setInterval(pollGolem, 300000);
  // the commons tabs — restore whichever view they were last on
  $$('.cmn-tab').forEach((t) => {
    t.onclick = () => setTab(t.dataset.tab);
    t.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab(t.dataset.tab); } };
  });
  let startTab = 'pool';
  try { startTab = localStorage.getItem('cmn.tab') || 'pool'; } catch {}
  setTab(startTab);
  pollWork(); setInterval(pollWork, 15000);
  pollReceipts(); setInterval(pollReceipts, 30000);
  pollLive(); pollCrowd();
  setInterval(pollLive, 9000);
  setInterval(pollCrowd, 12000);
});
})();
