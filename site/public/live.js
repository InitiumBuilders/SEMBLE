/* ═══════════════════════════════════════════════════════════════════════════
   THE VIBE ENGINE — Semble.CC/live · AugustJames.Live/livenow · /rightnow
   One file, three doors (the pathname decides the view).
   · Stream cycler: ad-free relay first (Invidious/Piped, open-source ad-strip),
     direct YouTube fallback. Fresh IDs fetched keyless, cached 6h.
   · Visualizer: one canvas engine, eleven scenes — each DJ's systems power
     drawn as physics. Runs on the DJ's own clock (bpm + phrase envelope).
   · The swarm: the resident being (Davara Distinct V3), alive on every view.
   · Broadcast: polls /api/live for what August selected to share. Nothing else
     ever reaches this page — the privacy gate lives server-side with him.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const P = window.PANTHEON;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const API = location.hostname.endsWith('semble.cc') || location.hostname === 'localhost'
  ? '' : 'https://www.semble.cc';               // AJL pages read Semble's API cross-origin
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── view: /rightnow is the tasks-only door ── */
const RIGHTNOW = /rightnow/.test(location.pathname);
if (RIGHTNOW) document.body.classList.add('rightnow');

/* ═══ STATE ═══ */
const S = {
  dj: P.djs[0], power: null, playing: false, mode: 'relay',
  vid: null, rotateT: 0, live: null, energy: 0, phrase: 0, drop: 0,
};

/* ═══ THE STREAM ENGINE — ad-free first ═══ */
// Invidious & Piped are the open-source YouTube front-ends that strip every ad.
// Public instances rotate; we try several, cache what answers, and fall back to
// a direct youtube-nocookie embed (fewer ads on live sets, never tracked cookies).
const INV = ['https://yewtu.be', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://iv.ggtyler.dev'];
const PIPED_API = ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee', 'https://pipedapi.adminforge.de'];

async function tryJson(url, ms = 4500) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); clearTimeout(t); if (!r.ok) throw 0; return await r.json(); }
  catch { clearTimeout(t); return null; }
}
async function searchIds(query) {
  const key = 'vibe.ids.' + query;
  const hit = localStorage.getItem(key);
  if (hit) { try { const j = JSON.parse(hit); if (Date.now() - j.ts < 6 * 3600e3 && j.ids.length) return j.ids; } catch {} }
  let ids = [];
  for (const base of PIPED_API) {                       // Piped search API (keyless, CORS-open)
    const j = await tryJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
    if (j && j.items) { ids = j.items.map((x) => (x.url || '').split('v=')[1]).filter(Boolean); if (ids.length) break; }
  }
  if (!ids.length) for (const base of INV) {            // Invidious search API
    const j = await tryJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    if (Array.isArray(j)) { ids = j.map((x) => x.videoId).filter(Boolean); if (ids.length) break; }
  }
  if (ids.length) localStorage.setItem(key, JSON.stringify({ ts: Date.now(), ids: ids.slice(0, 24) }));
  return ids;
}
function embedUrl(id) {
  if (S.mode === 'relay') {
    const inst = localStorage.getItem('vibe.inst') || INV[0];
    return `${inst}/embed/${id}?autoplay=1&local=true`;   // proxied through the relay = no ads at all
  }
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&modestbranding=1&rel=0&iv_load_policy=3`;
}
async function spin(next) {
  const dj = S.dj;
  let ids = await searchIds(dj.query);
  if (!ids.length) { note(`the open relay instances are asleep — tap SOURCE to go direct`); return; }
  if (next) ids = ids.filter((x) => x !== S.vid);
  S.vid = ids[Math.floor(Math.random() * Math.min(ids.length, 10))];
  const f = $('#player');
  f.src = embedUrl(S.vid);
  $('.curtain').classList.add('gone');
  S.playing = true;
  clearTimeout(S.rotateT);
  S.rotateT = setTimeout(() => spin(true), (dj.setMin || 13) * 60e3);
  note(`now spinning <b>${dj.name}</b> — ${S.mode === 'relay' ? 'ad-free relay' : 'direct'} · next drop in ${dj.setMin} min`);
}
function note(html) { $('#tnote').innerHTML = html; }

/* ═══ DJ SWITCHING ═══ */
function setDj(dj, andSpin) {
  S.dj = dj;
  document.documentElement.style.setProperty('--dj', dj.hue);
  document.documentElement.style.setProperty('--dj2', dj.hue2);
  $$('.dj-card').forEach((c) => c.classList.toggle('on', c.dataset.id === dj.id));
  $('#hud-dj').innerHTML = `MODE: <b>${dj.name}</b>`;
  $('#hud-pow').textContent = dj.power.toUpperCase();
  document.title = `${dj.name} · LIVE — the builder stream`;
  if (andSpin || S.playing) spin(true);
}

/* ═══ WAVE POWERS ═══ */
function setPower(pw) {
  S.power = S.power && S.power.id === pw.id ? null : pw;
  $$('.power').forEach((c) => c.classList.toggle('on', !!S.power && c.dataset.id === S.power.id));
  const chip = $('#hud-power');
  chip.style.display = S.power ? '' : 'none';
  if (S.power) chip.textContent = `POWER: ${S.power.name.toUpperCase()}`;
  if (S.power && S.power.id === 'vibez') { S.energy = Math.min(S.energy, .35); }     // balancing loop bites now
}

/* ═══ THE CLOCK — bpm + 32-bar phrase envelope (build → DROP → sustain) ═══ */
function clock(t) {
  const dj = S.dj;
  const beat = (t / 1000) * (dj.bpm / 60);
  const bar = beat / 4, phrase = (bar % 32) / 32;       // 32-bar phrase
  S.phrase = phrase;
  // energy envelope: rise 0→.55, spike at the drop (phrase .5), sustain, breathe out
  let e = phrase < .5 ? phrase * 1.1 : phrase < .55 ? 1 : .72 - (phrase - .55) * .5;
  if (S.power) {
    if (S.power.id === 'hype') e = Math.min(1, e * 1.35);         // reinforcing loop
    if (S.power.id === 'vibez') e *= .45;                          // balancing loop
  }
  S.drop = phrase >= .5 && phrase < .56 ? 1 - (phrase - .5) / .06 : 0;
  S.energy += (e - S.energy) * .04;
  return { beat, bar, phrase };
}

/* ═══ THE VISUALIZER — one engine, eleven scenes ═══ */
const viz = $('#viz'); const vg = viz ? viz.getContext('2d') : null;
let VW = 0, VH = 0;
function vsize() { if (!viz) return; const r = viz.parentElement.getBoundingClientRect(); VW = viz.width = r.width * devicePixelRatio; VH = viz.height = r.height * devicePixelRatio; }
addEventListener('resize', vsize);

const pool = Array.from({ length: 190 }, (_, i) => ({
  x: Math.random(), y: Math.random(), vx: 0, vy: 0, ph: Math.random() * 7, sz: 1.5 + Math.random() * 2,
}));
function hex(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

const SCENES = {
  /* DAUOZ — TECTONIC: charged horizon, shockwave rings at the drop */
  tectonic(g, t, e) {
    const cx = VW / 2, hy = VH * .62;
    g.strokeStyle = hex(S.dj.hue, .5 + e * .4); g.lineWidth = 2.5 * devicePixelRatio;
    g.beginPath();
    for (let x = 0; x <= VW; x += 8) {
      const y = hy + Math.sin(x * .004 + t * .0006) * 26 * e * devicePixelRatio + Math.sin(x * .013 - t * .0011) * 9 * devicePixelRatio;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    if (S.drop > 0) for (let i = 0; i < 3; i++) {
      const r = (1 - S.drop) * VW * (.25 + i * .22);
      g.strokeStyle = hex(i === 1 ? '#E8C46B' : S.dj.hue2, S.drop * .8);
      g.lineWidth = (4 - i) * devicePixelRatio;
      g.beginPath(); g.arc(cx, hy, r, 0, 7); g.stroke();
    }
  },
  /* QOREUS — KEYSTONE: lattice flexing from one gold node */
  keystone(g, t, e) {
    const cx = VW / 2, cy = VH / 2, N = 6;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = ((i + .5) / N) * VW, y = ((j + .5) / N) * VH;
      const d = Math.hypot(x - cx, y - cy) / Math.hypot(cx, cy);
      const k = Math.sin(t * .002 - d * 6) * e * 14 * devicePixelRatio * (1 - d);
      g.fillStyle = d < .08 ? hex('#E8C46B', .95) : hex(S.dj.hue2, .35 + e * .3);
      g.beginPath(); g.arc(x + k, y + k * .6, (d < .08 ? 6 + e * 7 : 2.5) * devicePixelRatio, 0, 7); g.fill();
    }
  },
  /* FREQUEST — WAVEGRID: waveforms that echo back (feedback) */
  wavegrid(g, t, e) {
    for (let r = 0; r < 4; r++) {
      g.strokeStyle = hex(r % 2 ? S.dj.hue : S.dj.hue2, .55 - r * .11);
      g.lineWidth = (3 - r * .5) * devicePixelRatio;
      g.beginPath();
      for (let x = 0; x <= VW; x += 6) {
        const y = VH * (.3 + r * .14) + Math.sin(x * .008 + t * .002 * (r % 2 ? -1 : 1) + r) * (18 + e * 44) * devicePixelRatio;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  },
  /* DAOMODE — the swarm itself, self-organizing */
  swarm(g, t, e) {
    for (const p of pool) {
      const ax = (Math.sin(p.ph + t * .0004) * .5 + .5) * VW, ay = (Math.cos(p.ph * 1.7 + t * .0003) * .5 + .5) * VH;
      p.vx += (ax - p.x * VW) * .00002 * (1 + e); p.vy += (ay - p.y * VH) * .00002 * (1 + e);
      p.vx *= .96; p.vy *= .96; p.x += p.vx / VW * 16; p.y += p.vy / VH * 16;
      g.fillStyle = hex(S.dj.hue, .5 + e * .4);
      g.beginPath(); g.arc(p.x * VW, p.y * VH, p.sz * devicePixelRatio, 0, 7); g.fill();
    }
    g.strokeStyle = hex(S.dj.hue2, .13 + e * .12); g.lineWidth = devicePixelRatio;
    for (let i = 0; i < 40; i++) {
      const a = pool[(i * 7) % pool.length], b = pool[(i * 13 + 5) % pool.length];
      if (Math.hypot((a.x - b.x) * VW, (a.y - b.y) * VH) < VW * .09) {
        g.beginPath(); g.moveTo(a.x * VW, a.y * VH); g.lineTo(b.x * VW, b.y * VH); g.stroke();
      }
    }
  },
  /* WAVESIDE — LIQUID: streamlines + a filling vessel */
  liquid(g, t, e) {
    for (let r = 0; r < 5; r++) {
      g.strokeStyle = hex(r % 2 ? S.dj.hue : S.dj.hue2, .4 - r * .06);
      g.lineWidth = 2 * devicePixelRatio;
      g.beginPath();
      for (let x = 0; x <= VW; x += 10) {
        const y = VH * (.2 + r * .15) + Math.sin(x * .003 + t * .0012 + r * 2) * 30 * devicePixelRatio * (0.5 + e);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    const lvl = VH * (1 - .12 - S.energy * .22);
    g.fillStyle = hex(S.dj.hue, .12);
    g.fillRect(0, lvl, VW, VH - lvl);
  },
  /* FREQRO — SPECTRUM: the signal out of the noise */
  spectrum(g, t, e) {
    const n = 48, w = VW / n;
    for (let i = 0; i < n; i++) {
      const sig = Math.abs(Math.sin(i * .4 + t * .0015)) * Math.abs(Math.sin(t * .0004 + i));
      const h = (sig * .75 + Math.random() * .25) * e * VH * .5 + 4;
      g.fillStyle = i % 8 === 4 ? hex(S.dj.hue2, .9) : hex(S.dj.hue, .5);
      g.fillRect(i * w + w * .18, VH - h, w * .64, h);
    }
  },
  /* RAZE — SHATTER: glitch tears that heal */
  shatter(g, t, e) {
    if (Math.random() < e * .35) {
      const y = Math.random() * VH, h = (6 + Math.random() * 26) * devicePixelRatio;
      g.fillStyle = hex(Math.random() < .5 ? S.dj.hue : S.dj.hue2, .4 + e * .3);
      g.fillRect(0, y, VW, h);
    }
    g.strokeStyle = hex(S.dj.hue, .6); g.lineWidth = 2 * devicePixelRatio;
    for (let i = 0; i < 5; i++) {
      const x = ((t * .00007 * (i + 1)) % 1) * VW;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.sin(t * .003 + i) * 40, VH); g.stroke();
    }
  },
  /* NAUZ — NOISEFIELD: turbulence finding resonance rings */
  noisefield(g, t, e) {
    for (const p of pool) {
      const a = Math.sin(p.x * 9 + t * .0006) + Math.cos(p.y * 7 - t * .0005);
      p.x += Math.cos(a * 3.1) * .0016 * (1 + e * 2); p.y += Math.sin(a * 3.1) * .0016 * (1 + e * 2);
      if (p.x < 0) p.x += 1; if (p.x > 1) p.x -= 1; if (p.y < 0) p.y += 1; if (p.y > 1) p.y -= 1;
      g.fillStyle = hex(S.dj.hue, .45);
      g.fillRect(p.x * VW, p.y * VH, 2 * devicePixelRatio, 2 * devicePixelRatio);
    }
    if (S.drop > 0) {
      g.strokeStyle = hex(S.dj.hue2, S.drop); g.lineWidth = 3 * devicePixelRatio;
      g.beginPath(); g.arc(VW / 2, VH / 2, (1 - S.drop) * VW * .4, 0, 7); g.stroke();
    }
  },
  /* SÂV — RINGS: growth rings + memory echoes */
  rings(g, t, e) {
    const cx = VW / 2, cy = VH / 2;
    for (const r of [13, 21, 34, 55, 89]) {
      const rr = r * 4.6 * devicePixelRatio * (1 + Math.sin(t * .0008 + r) * .04 * (1 + e));
      g.strokeStyle = hex(r === 55 ? '#E8C46B' : S.dj.hue2, .5 - r * .003);
      g.lineWidth = 2.5 * devicePixelRatio;
      g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke();
    }
  },
  /* AUXTRO — PORTAL: the boundary keeps redrawing wider */
  portal(g, t, e) {
    const k = (t * .0002) % 1;
    for (let i = 0; i < 5; i++) {
      const s = ((k + i / 5) % 1);
      const w = VW * (.2 + s * .8), h = VH * (.2 + s * .8);
      g.strokeStyle = hex(i % 2 ? S.dj.hue : S.dj.hue2, (1 - s) * (.5 + e * .3));
      g.lineWidth = 2.5 * devicePixelRatio;
      g.strokeRect((VW - w) / 2, (VH - h) / 2, w, h);
    }
  },
  /* AUDEA — CHORUS: a thousand voices phase-locking into waves */
  chorus(g, t, e) {
    for (const p of pool) {
      const y = p.y * VH * .8 + VH * .1 + Math.sin(p.x * 9 + t * .0018) * 30 * devicePixelRatio * e;
      g.fillStyle = hex(Math.sin(p.x * 9 + t * .0018) > .7 ? '#E8C46B' : S.dj.hue, .6);
      g.beginPath(); g.arc(p.x * VW, y, p.sz * devicePixelRatio, 0, 7); g.fill();
    }
  },
};
function vloop(t) {
  if (!vg || REDUCED) return;
  if (document.hidden || !viz.checkVisibility?.() && false) { requestAnimationFrame(vloop); return; }
  clock(t);
  vg.clearRect(0, 0, VW, VH);
  (SCENES[S.dj.scene] || SCENES.swarm)(vg, t, S.energy);
  requestAnimationFrame(vloop);
}

/* ═══ THE RESIDENT SWARM — the page's being (Davara V3) ═══ */
const sw = $('#swarm'); const sg = sw ? sw.getContext('2d') : null;
let SWW = 0, SWH = 0, attractor = { x: .5, y: .3 };
function swsize() { if (!sw) return; SWW = sw.width = innerWidth * devicePixelRatio; SWH = sw.height = innerHeight * devicePixelRatio; }
addEventListener('resize', swsize);
const being = Array.from({ length: innerWidth < 700 ? 70 : 130 }, () => ({
  x: Math.random() * innerWidth, y: Math.random() * innerHeight,
  vx: 0, vy: 0, ph: Math.random() * 7, sz: 1.2 + Math.random() * 2,
}));
setInterval(() => {                                     // the being visits the charged section
  const secs = $$('.deck-wrap, .stage, .workgrid, .card');
  const vis = secs.filter((s) => { const r = s.getBoundingClientRect(); return r.top < innerHeight * .7 && r.bottom > 0; });
  if (vis.length) { const r = vis[0].getBoundingClientRect(); attractor = { x: (r.left + r.width / 2) / innerWidth, y: Math.max(60, r.top + 40) / innerHeight }; }
}, 2400);
function swloop(t) {
  if (!sg || REDUCED) return;
  if (document.hidden) { requestAnimationFrame(swloop); return; }
  sg.clearRect(0, 0, SWW, SWH);
  const ax = attractor.x * innerWidth, ay = attractor.y * innerHeight;
  for (const p of being) {
    const dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy) || 1;
    const ring = 90 + Math.sin(p.ph) * 40;
    p.vx += (dx / d) * (d - ring) * .0016 + Math.sin(t * .001 + p.ph) * .05;
    p.vy += (dy / d) * (d - ring) * .0016 + Math.cos(t * .0008 + p.ph) * .05;
    p.vx += -dy / d * .06; p.vy += dx / d * .06;        // tangential orbit
    p.vx *= .95; p.vy *= .95; p.x += p.vx; p.y += p.vy;
    sg.fillStyle = hex(S.dj.hue, .5);
    sg.beginPath(); sg.arc(p.x * devicePixelRatio, p.y * devicePixelRatio, p.sz * devicePixelRatio, 0, 7); sg.fill();
  }
  for (let i = 0; i < 26; i++) {                        // micro-lightning inside the being
    const a = being[(i * 5) % being.length], b = being[(i * 11 + 3) % being.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 60) {
      sg.strokeStyle = hex(S.dj.hue2, .16); sg.lineWidth = devicePixelRatio;
      sg.beginPath(); sg.moveTo(a.x * devicePixelRatio, a.y * devicePixelRatio);
      sg.lineTo(b.x * devicePixelRatio, b.y * devicePixelRatio); sg.stroke();
    }
  }
  requestAnimationFrame(swloop);
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
  const ag = $('#agents');
  ag.innerHTML = (j.agents || []).length
    ? j.agents.map((a) => `<div class="agent-row"><span class="nm">${esc(a.name)}</span><span class="fo">${esc(a.focus)}</span></div>`).join('')
    : `<div class="quiet">The fleet is resting.</div>`;
  if (j.dj && j.dj !== S.dj.id && !RIGHTNOW) { const d = P.djs.find((x) => x.id === j.dj); if (d) setDj(d, false); }
  if (j.power) { const pw = P.powers.find((x) => x.id === j.power); if (pw && (!S.power || S.power.id !== pw.id)) setPower(pw); }
}
function esc(s) { const d = document.createElement('i'); d.textContent = String(s || ''); return d.innerHTML; }

/* ═══ SEMBLES — the live thread ═══ */
async function pollChat() {
  const j = await tryJson(`${API}/api/chat?ts=${Date.now()}`, 8000);
  if (!j || !j.msgs) return;
  $('#msgs').innerHTML = j.msgs.slice(0, 60).map((m) =>
    `<div class="msg"><span class="who">${esc(m.name)}</span><span class="when">${new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><div class="tx">${esc(m.text)}</div></div>`).join('')
    || '<div class="quiet">No sembles yet — be the first voice in the room.</div>';
}
async function sendChat(e) {
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
  if (r && r.ok) { $('#c-text').value = ''; pollChat(); }
  else note(r && r.error ? esc(r.error) : 'the thread is catching its breath — try again in a moment');
}

/* ═══ BUILD THE UI ═══ */
function buildDeck() {
  $('#deck').innerHTML = P.djs.map((d) => `
    <div class="dj-card" role="button" tabindex="0" data-id="${d.id}" style="--c:${d.hue}">
      <div class="dj-name">${d.name}</div>
      <div class="dj-say">/${d.say}/${d.headliner ? ' · HEADLINER' : d.artist ? ' · THE ARTIST' : ''}</div>
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
  $$('.power').forEach((c) => {
    const go = () => setPower(P.powers.find((p) => p.id === c.dataset.id));
    c.addEventListener('click', go);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

/* ═══ IGNITION ═══ */
addEventListener('DOMContentLoaded', () => {
  buildDeck();
  setDj(P.djs[0], false);
  vsize(); swsize();
  requestAnimationFrame(vloop);
  requestAnimationFrame(swloop);
  $('#play').addEventListener('click', () => spin(false));
  $('#next').addEventListener('click', () => spin(true));
  $('#src').addEventListener('click', () => {
    S.mode = S.mode === 'relay' ? 'direct' : 'relay';
    $('#src').textContent = S.mode === 'relay' ? '⛨ AD-FREE RELAY' : '▶ DIRECT';
    if (S.playing) spin(false);
  });
  $('#chat-form').addEventListener('submit', sendChat);
  pollLive(); pollChat();
  setInterval(pollLive, 9000);
  setInterval(pollChat, 12000);
});
})();
