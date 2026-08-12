/* ═══════════════════════════════════════════════════════════════════════════
   MOTUSLIVE · THE VISUAL ENGINE
   Eleven worlds. One physics. No repeats, ever.

   WHY THIS LOOKS DIFFERENT FROM CANVAS "DEMOS" — four techniques, applied
   everywhere, that are the actual difference between a line drawing and light:

   1 · TRAILS, NOT CLEARS. Each frame fades the previous one instead of wiping
       it. Every particle draws its own history — comet tails, light streaks,
       long exposures. This single change is most of the "magic".
   2 · ADDITIVE LIGHT. globalCompositeOperation='lighter'. Overlapping light
       SUMS, so dense regions bloom white-hot on their own. Light behaves like
       light instead of like paint.
   3 · PRE-RENDERED GLOW SPRITES. A radial-gradient sprite per hue, drawn with
       drawImage. Thousands of soft glowing bodies at 60fps — a hard-edged
       arc() fill can never look like this, at any count.
   4 · REAL DEPTH. Points live in 3D and are projected (k = F/(F+z)); size,
       brightness and speed all fall off with distance. Nothing is flat.

   ⛔ NO ROTATING BORDER RINGS. Banned forever, on every project.

   Each world also carries a MEANING — the systems idea its DJ owns, drawn as
   physics rather than decoration. And each mutates its own genome every 32-bar
   phrase (see evolve()), so the same world is never watched twice.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const M = (window.MOTUSVIZ = {});

/* ── glow sprites: the bloom primitive ── */
const _spr = {};
function sprite(hex) {
  if (_spr[hex]) return _spr[hex];
  const S = 72, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,.98)');
  gr.addColorStop(.14, `rgba(${Math.min(255, r + 70)},${Math.min(255, gg + 70)},${Math.min(255, b + 70)},.9)`);
  gr.addColorStop(.34, `rgba(${r},${gg},${b},.42)`);
  gr.addColorStop(.66, `rgba(${r},${gg},${b},.1)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return (_spr[hex] = c);
}
/* one glowing body */
function dot(g, x, y, r, hex, a) {
  if (a <= .004 || r <= .05) return;
  g.globalAlpha = a > 1 ? 1 : a;
  const s = sprite(hex), d = r * 2;
  g.drawImage(s, x - r, y - r, d, d);
}
/* a glowing line — the streak primitive (light with a direction) */
function streak(g, x1, y1, x2, y2, w, hex, a) {
  g.globalAlpha = a; g.strokeStyle = hex; g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
const TAU = Math.PI * 2;
const F = 900;                                  // focal length for the 3D projection

/* ── the field: 3D bodies reused by every world, so switching is instant ── */
const N = 760;
const P = Array.from({ length: N }, (_, i) => ({
  x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: Math.random(),
  a: Math.random() * TAU, r: Math.random(), t: Math.random() * TAU,
  s: .5 + Math.random() * .9, seed: Math.random(), i,
}));
const RINGS = [];                               // Sâv's permanent memory rings

/* every world declares its own trail persistence — the shutter speed */
const FADE = {
  singularity: .09, keystone: .13, feedback: .06, murmuration: .045, liquid: .08,
  spectrum: .16, shatter: .18, turbulence: .04, rings: .05, portal: .10, chorus: .09,
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE ELEVEN WORLDS
   signature: (g, ctx) where ctx = {t, e, drop, phrase, W, H, hue, hue2, v, DPR, count}
   ═══════════════════════════════════════════════════════════════════════════ */
const WORLDS = {

  /* ── DJ DAOZ · SINGULARITY ─────────────────────────────────────────────
     A lensed black hole. Stars live in 3D and are DISPLACED by the real
     lensing relation r' = r + Rs²/r, so light visibly bends around the hole
     and the sky behind it folds into an Einstein ring. The disk is thousands
     of additive bodies on a tilted orbit, Doppler-brightened on the
     approaching side. At the drop the paradigm collapses past its own horizon
     and detonates outward.  MEANING: rung 2 — transcend the frame. */
  singularity(g, c) {
    const { W, H, t, e, drop, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2;
    const Rs = Math.min(W, H) * (.185 + e * .028) * (1 - drop * .5);    // horizon collapses on the drop
    // ── the lensed sky ──
    for (let i = 0; i < c.count; i++) {
      const p = P[i];
      p.t += .00016 * (1 + p.seed);
      const zz = ((p.z + t * .000012 * v.warp) % 1);
      const k = F / (F + zz * 1700);
      let sx = cx + p.x * W * .82 * k, sy = cy + p.y * H * .82 * k;
      const dx = sx - cx, dy = sy - cy;
      const r = Math.hypot(dx, dy) || 1;
      // gravitational lensing — the whole reason this reads as a black hole
      const rl = r + (Rs * Rs) / r;
      sx = cx + (dx / r) * rl; sy = cy + (dy / r) * rl;
      if (rl > Math.hypot(W, H)) continue;
      const near = Math.max(0, 1 - (rl - Rs) / (Rs * 1.9));            // hot near the ring
      const size = (1 + p.s * 2) * k * c.DPR * (1 + near * 3);
      dot(g, sx, sy, size, near > .45 ? '#FFFFFF' : (p.seed > .6 ? hue2 : '#BBD6FF'), (.22 + p.s * .4) * k + near * .8);
    }
    // ── the accretion disk: additive bodies on a tilted orbit, biased INWARD
    //    so the inner edge is a blazing band rather than a thin scatter ──
    const tilt = .28 + Math.sin(t * .00008) * .05;
    for (let i = 0; i < c.count; i++) {
      const p = P[i];
      const bias = Math.pow(p.r, 2.2);                                  // most mass near the hole
      const orb = Rs * (1.1 + bias * 2.2);
      const w = (.0018 + .5 / orb) * (1 + e * .8) * v.warp;
      p.a += w;
      const ca = Math.cos(p.a + v.drift), sa = Math.sin(p.a + v.drift);
      const sx = cx + ca * orb, sy = cy + sa * orb * tilt;
      const front = sa > 0;
      // relativistic beaming: the side sweeping toward us is far brighter
      const beam = .45 + Math.pow((ca + 1) / 2, 2.2) * 1.8;
      const hot = orb < Rs * 1.55;
      dot(g, sx, sy, (1.6 + p.s * 2.6) * c.DPR * (front ? 1.2 : .85),
        hot ? '#FFF6E2' : (p.seed > .5 ? hue : hue2), (.2 + e * .22) * beam * (front ? 1 : .5));
      if (hot && p.seed > .7) {                                         // inner-edge tidal streaks
        streak(g, sx, sy, cx + Math.cos(p.a + v.drift - .3) * orb, cy + Math.sin(p.a + v.drift - .3) * orb * tilt,
          1.6 * c.DPR, '#FFE9C0', .18 * beam);
      }
    }
    // ── the shadow, then the photon ring on top of it ──
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1; g.fillStyle = '#000';
    g.beginPath(); g.arc(cx, cy, Rs, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    dot(g, cx, cy, Rs * 2.5, hue2, .1 + e * .1);                        // the halo the hole sits in
    for (let i = 0; i < 3; i++) {                                       // layered bloom = a real ring
      g.globalAlpha = [.95, .5, .22][i] * (.75 + e * .45);
      g.strokeStyle = i === 0 ? '#FFFFFF' : hue2;
      g.lineWidth = [2.2, 7, 18][i] * c.DPR;
      g.beginPath(); g.arc(cx, cy, Rs * 1.03, 0, TAU); g.stroke();
    }
    // ── THE DROP — lensed shockwaves. Gold appears only here. ──
    if (drop > 0) for (let i = 0; i < 5; i++) {
      const rr = Rs + (1 - drop) * Math.min(W, H) * (.2 + i * .3);
      g.globalAlpha = drop * (.6 - i * .1);
      g.strokeStyle = i === 1 ? '#E8C46B' : (i % 2 ? hue : hue2);
      g.lineWidth = (5 - i * .7) * c.DPR;
      g.beginPath(); g.ellipse(cx, cy, rr, rr * (tilt + .45), 0, 0, TAU); g.stroke();
    }
  },

  /* ── Qoreus · KEYSTONE ───────────────────────────────────────────────────
     A 3D lattice with ONE gold node. Pulses are born at the keystone and
     travel every edge outward — the small shift that moves everything, drawn
     literally.  MEANING: rung 4 — leverage points. */
  keystone(g, c) {
    const { W, H, t, e, drop, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2, G = 4 + v.form;                        // grid resolution mutates
    const nodes = [];
    for (let ix = 0; ix < G; ix++) for (let iy = 0; iy < G; iy++) for (let iz = 0; iz < 3; iz++) {
      const zz = (iz / 3 - .35) * 1000 + Math.sin(t * .0004 + ix + iy) * 90;
      const k = F / (F + zz + 700);
      nodes.push({
        x: cx + ((ix + .5) / G - .5) * W * 1.05 * k,
        y: cy + ((iy + .5) / G - .5) * H * 1.05 * k,
        k, d: Math.hypot(ix - (G - 1) / 2, iy - (G - 1) / 2) / G + iz * .3,
      });
    }
    const wave = (t * .0011 * v.warp) % 1;                              // the pulse front
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const dd = Math.hypot(n.x - m.x, n.y - m.y);
        if (dd > W * .13) continue;
        const lit = Math.max(0, 1 - Math.abs(n.d - wave) * 7);          // the pulse passing this edge
        streak(g, n.x, n.y, m.x, m.y, (.6 + lit * 2.2) * c.DPR, lit > .3 ? '#E8C46B' : hue2, .05 + lit * .5 * (.5 + e));
      }
      const key = n.d < .1;
      dot(g, n.x, n.y, (key ? 9 + e * 12 : 1.6 + n.k * 1.7) * c.DPR,
        key ? '#E8C46B' : hue, key ? .8 : .1 + n.k * .22);
    }
    if (drop > 0) {                                                     // one node, the whole system
      g.globalAlpha = drop * .8; g.strokeStyle = '#E8C46B'; g.lineWidth = 3 * c.DPR;
      g.beginPath(); g.arc(cx, cy, (1 - drop) * Math.min(W, H) * .8, 0, TAU); g.stroke();
    }
  },

  /* ── DJ Frequest · FEEDBACK ──────────────────────────────────────────────
     An oscilloscope that hears itself: the live Lissajous curve plus eight
     DELAYED echoes of its own past, each dimmer. Reinforcing loops swell it;
     balancing loops tighten it.  MEANING: rung 7 — feedback loops. */
  feedback(g, c) {
    const { W, H, t, e, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2, A = Math.min(W, H) * (.2 + e * .17);
    const fx = 2 + v.form, fy = 3;
    for (let echo = 8; echo >= 0; echo--) {
      const lag = echo * 130 * v.warp;
      const a = echo === 0 ? .85 : .3 * (1 - echo / 9);
      g.globalAlpha = a; g.strokeStyle = echo === 0 ? '#FFFFFF' : (echo % 2 ? hue : hue2);
      g.lineWidth = (echo === 0 ? 2.2 : 1.5) * c.DPR;
      g.beginPath();
      for (let i = 0; i <= 220; i++) {
        const th = (i / 220) * TAU;
        const tt = (t - lag) * .0009;
        const x = cx + Math.sin(th * fx + tt + v.drift) * A * (1 + Math.sin(tt * .7) * .12);
        const y = cy + Math.sin(th * fy + tt * 1.31) * A * .62;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      if (echo === 0) for (let i = 0; i < 40; i++) {                     // hot points ride the live curve
        const th = (i / 40) * TAU, tt = t * .0009;
        dot(g, cx + Math.sin(th * fx + tt + v.drift) * A, cy + Math.sin(th * fy + tt * 1.31) * A * .62,
          2.4 * c.DPR, hue2, .35);
      }
    }
  },

  /* ── DJ DaoMode · MURMURATION ────────────────────────────────────────────
     True flocking in 3D — separation, alignment, cohesion. Nobody leads; the
     shape is emergent, and it leaves trails so you see the collective
     decision happen.  MEANING: rung 5 — emergence & stigmergy. */
  murmuration(g, c) {
    const { W, H, t, e, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2;
    // TWO wandering attractors on different clocks — a single one collapses
    // the whole flock into a knot, which is not a murmuration, it is a blob.
    const gx = cx + Math.sin(t * .00034 + v.drift) * W * .32;
    const gy = cy + Math.cos(t * .00028) * H * .26;
    const hx = cx + Math.sin(t * .00019 + 2.1) * W * .34;
    const hy = cy + Math.cos(t * .00023 + 1.3) * H * .28;
    for (let i = 0; i < c.count; i++) {
      const p = P[i];
      if (p.px === undefined) {                                         // spread, never stacked
        p.px = (p.x * .5 + .5) * W; p.py = (p.y * .5 + .5) * H;
        p.vx = (Math.random() - .5) * 3; p.vy = (Math.random() - .5) * 3;
      }
      let ax = 0, ay = 0, cnt = 0, sx = 0, sy = 0;
      for (let n = 1; n <= 6; n++) {                                    // sampled neighbours
        const q = P[(i + n * 37) % c.count];
        if (q.px === undefined) continue;
        const dx = q.px - p.px, dy = q.py - p.py, d = Math.hypot(dx, dy) || 1;
        if (d < 74) { ax -= dx / d * (74 - d) * .045; ay -= dy / d * (74 - d) * .045; }  // separation, distance-weighted
        if (d < 150) { sx += q.vx; sy += q.vy; cnt++; }                 // alignment
      }
      if (cnt) { ax += (sx / cnt - p.vx) * .14; ay += (sy / cnt - p.vy) * .14; }
      // half the flock follows each idea — the split is what makes the shape
      const tx = (p.seed > .5 ? gx : hx) - p.px, ty = (p.seed > .5 ? gy : hy) - p.py;
      const td = Math.hypot(tx, ty) || 1;
      const pull = .1 + e * .16;                                        // gentle: cohesion, not collapse
      ax += tx / td * pull; ay += ty / td * pull;
      ax += Math.sin(t * .0007 + p.ph) * .09; ay += Math.cos(t * .0006 + p.ph * 1.7) * .09;  // wander
      p.vx = (p.vx + ax) * .965; p.vy = (p.vy + ay) * .965;
      const sp = Math.hypot(p.vx, p.vy) || 1, cap = 2.6 * v.warp * (1 + e * .6);
      if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
      if (sp < .7) { p.vx *= 1.5; p.vy *= 1.5; }                        // never stalls
      const ox = p.px, oy = p.py;
      p.px += p.vx * c.DPR; p.py += p.vy * c.DPR;
      const m = 40 * c.DPR;                                             // soft wrap keeps the field full
      if (p.px < -m) p.px = W + m; if (p.px > W + m) p.px = -m;
      if (p.py < -m) p.py = H + m; if (p.py > H + m) p.py = -m;
      if (Math.abs(p.px - ox) < W * .5) streak(g, ox, oy, p.px, p.py, 1.5 * c.DPR, p.seed > .78 ? hue2 : hue, .34);
      dot(g, p.px, p.py, (1.4 + p.s * 1.2) * c.DPR, p.seed > .93 ? '#FFFFFF' : hue, .26);
    }
  },

  /* ── DJ WaveSide · LIQUID ────────────────────────────────────────────────
     Layered fluid sheets with caustic highlights, and a reservoir that fills
     and drains with the energy stock. Pacing made visible.
     MEANING: rung 10 — stocks & flows. */
  liquid(g, c) {
    const { W, H, t, e, hue, hue2, v } = c;
    for (let L = 0; L < 7; L++) {
      const base = H * (.14 + L * .118);
      g.globalAlpha = .1 + L * .035; g.strokeStyle = L % 2 ? hue : hue2;
      g.lineWidth = (1.2 + L * .35) * c.DPR;
      g.beginPath();
      for (let x = 0; x <= W; x += 7) {
        const y = base
          + Math.sin(x * .0032 * v.warp + t * .0011 + L * .9 + v.drift) * (12 + e * 34) * c.DPR
          + Math.sin(x * .0091 - t * .0017 + L) * (5 + e * 11) * c.DPR;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      for (let i = 0; i < 26; i++) {                                     // caustics riding the sheet
        const x = ((i / 26) + ((t * .00007 * (L + 1)) % 1)) % 1 * W;
        const y = base + Math.sin(x * .0032 * v.warp + t * .0011 + L * .9 + v.drift) * (12 + e * 34) * c.DPR;
        dot(g, x, y, (1.6 + Math.sin(i + t * .003) * .9) * c.DPR, '#DFF6FF', .13 + e * .13);
      }
    }
    const lvl = H * (1 - .06 - e * .3);                                  // the reservoir
    g.globalAlpha = .1; g.fillStyle = hue; g.fillRect(0, lvl, W, H - lvl);
    for (let x = 0; x <= W; x += 12) dot(g, x, lvl + Math.sin(x * .02 + t * .003) * 3 * c.DPR, 3 * c.DPR, hue2, .1);
  },

  /* ── DJ Freqro · SPECTRUM ────────────────────────────────────────────────
     A POLAR analyser: the spectrum wrapped into a ring with a rotating radar
     sweep, so the signal is found rather than merely displayed. Peaks throw
     light outward.  MEANING: rung 6 — information flows. */
  spectrum(g, c) {
    const { W, H, t, e, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .17;
    const bands = 96;
    const sweep = (t * .0004) % TAU;
    for (let i = 0; i < bands; i++) {
      const th = (i / bands) * TAU;
      const noise = Math.abs(Math.sin(i * .7 * v.warp + t * .0016 + v.drift));
      const sig = Math.abs(Math.sin(i * .21 + t * .0004)) * noise;
      const len = R + sig * Math.min(W, H) * (.16 + e * .3) * v.density;
      let lit = Math.cos(th - sweep); lit = lit > .93 ? (lit - .93) / .07 : 0;   // the radar sweep
      const peak = sig > .74;
      streak(g, cx + Math.cos(th) * R, cy + Math.sin(th) * R,
        cx + Math.cos(th) * len, cy + Math.sin(th) * len,
        (1.4 + lit * 2.6) * c.DPR, peak ? '#FFFFFF' : (i % 8 === 0 ? hue2 : hue), .16 + lit * .7 + (peak ? .3 : 0));
      if (peak) dot(g, cx + Math.cos(th) * len, cy + Math.sin(th) * len, 3.4 * c.DPR, hue2, .5);
    }
    g.globalAlpha = .3; g.strokeStyle = hue2; g.lineWidth = 1.2 * c.DPR;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    dot(g, cx, cy, R * .5, hue, .1 + e * .13);
  },

  /* ── DJ Raze · SHATTER ───────────────────────────────────────────────────
     The frame breaks into shards that fly apart and are pulled back — and the
     drop is a full white fracture. Demolition on purpose, with the rebuild
     already in the motion.  MEANING: rung 3 — creative destruction. */
  shatter(g, c) {
    const { W, H, t, e, drop, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2, SH = 16 + v.form * 6;
    const burst = drop > 0 ? drop : Math.max(0, Math.sin(t * .0007) * .35);
    for (let i = 0; i < SH; i++) {
      const th = (i / SH) * TAU + v.drift * .2;
      const push = burst * Math.min(W, H) * .3 * (.6 + (i % 3) * .3);
      const ox = cx + Math.cos(th) * push, oy = cy + Math.sin(th) * push;
      const R = Math.min(W, H) * (.3 + (i % 4) * .07);
      const spin = th + t * .00022 * ((i % 2) ? 1 : -1);
      g.globalAlpha = .18 + e * .3 + burst * .35;
      g.strokeStyle = i % 3 === 0 ? '#FFFFFF' : (i % 2 ? hue : hue2);
      g.lineWidth = (1 + (i % 3)) * c.DPR;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = spin + k * 2.3, rr = R * (k === 1 ? .6 : 1);
        const x = ox + Math.cos(a) * rr, y = oy + Math.sin(a) * rr * .8;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.stroke();
    }
    for (let i = 0; i < c.count; i++) {                                  // debris
      const p = P[i];
      p.a += .004 * v.warp * (1 + e);
      const rr = (p.r * .5 + .18 + burst * .5) * Math.min(W, H);
      dot(g, cx + Math.cos(p.a + p.t) * rr, cy + Math.sin(p.a + p.t) * rr * .8, 1.4 * c.DPR, hue, .13);
    }
    if (drop > .5) { g.globalAlpha = (drop - .5) * .3; g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H); }
  },

  /* ── DJ Nauz · TURBULENCE ────────────────────────────────────────────────
     A curl-noise flow field with very long exposures — structured chaos as a
     probe. Resonance rings appear where the field rings true.
     MEANING: rung 8 — resonance testing. */
  turbulence(g, c) {
    const { W, H, t, e, drop, hue, hue2, v } = c;
    for (let i = 0; i < c.count; i++) {
      const p = P[i];
      if (p.fx === undefined) { p.fx = Math.random() * W; p.fy = Math.random() * H; }
      const n = Math.sin(p.fx * .0042 * v.warp + t * .0005 + v.drift) + Math.cos(p.fy * .0037 - t * .0004);
      const a = n * 3.2;
      const sp = (1.1 + e * 3.4) * c.DPR * v.density;
      const ox = p.fx, oy = p.fy;
      p.fx += Math.cos(a) * sp; p.fy += Math.sin(a) * sp;
      if (p.fx < -20) p.fx = W + 20; if (p.fx > W + 20) p.fx = -20;
      if (p.fy < -20) p.fy = H + 20; if (p.fy > H + 20) p.fy = -20;
      if (Math.abs(p.fx - ox) < W * .5) streak(g, ox, oy, p.fx, p.fy, (.8 + p.s * .9) * c.DPR, p.seed > .8 ? hue2 : hue, .18);
    }
    if (drop > 0) for (let i = 0; i < 3; i++) {
      g.globalAlpha = drop * (.5 - i * .13); g.strokeStyle = i ? hue2 : '#FFFFFF';
      g.lineWidth = (3 - i) * c.DPR;
      g.beginPath(); g.arc(W / 2, H / 2, (1 - drop) * Math.min(W, H) * (.3 + i * .25), 0, TAU); g.stroke();
    }
  },

  /* ── DJ Sâv · RINGS ──────────────────────────────────────────────────────
     Growth rings that actually RECORD: every phrase lays a permanent ring, so
     the visual accumulates its own history and you can read the set's age off
     it. The canon loop, made visible.  MEANING: rung 6 — system memory. */
  rings(g, c) {
    const { W, H, t, e, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2;
    for (const r of RINGS) {                                            // the archive
      r.r += .12 * c.DPR;
      g.globalAlpha = Math.max(0, r.a * (1 - r.r / (Math.max(W, H) * .95)));
      g.strokeStyle = r.gold ? '#E8C46B' : hue2; g.lineWidth = 1.3 * c.DPR;
      g.beginPath(); g.arc(cx, cy, r.r, 0, TAU); g.stroke();
    }
    for (const [i, fib] of [13, 21, 34, 55, 89].entries()) {             // the living rings
      const rr = fib * Math.min(W, H) * .0055 * (1 + Math.sin(t * .0007 * v.warp + i + v.drift) * .05 * (1 + e));
      const gold = fib === 55;
      g.globalAlpha = .18 + e * .3; g.strokeStyle = gold ? '#E8C46B' : hue;
      g.lineWidth = (gold ? 2.6 : 1.7) * c.DPR;
      g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke();
      const cnt = 8 + i * 5;
      for (let k = 0; k < cnt; k++) {                                    // sample points, sampling the past
        const th = (k / cnt) * TAU + t * .0002 * (i % 2 ? 1 : -1) + v.drift;
        dot(g, cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, (1.5 + i * .35) * c.DPR, gold ? '#F0D48C' : hue2, .2 + e * .22);
      }
    }
    dot(g, cx, cy, Math.min(W, H) * .06 * (1 + e * .3), '#E8C46B', .16);
  },

  /* ── DJ Auxtro · PORTAL ──────────────────────────────────────────────────
     A tunnel of squircle frames rushing at the viewer — the boundary redrawn
     wider and wider until the observer is inside it.
     MEANING: rung 5 — boundary expansion. */
  portal(g, c) {
    const { W, H, t, e, hue, hue2, v } = c;
    const cx = W / 2, cy = H / 2, RINGN = 16;
    for (let i = 0; i < RINGN; i++) {
      const z = ((i / RINGN + (t * .00013 * v.warp) % 1) % 1);
      const k = .04 + z * z * 1.5;
      const w = W * k, h = H * k;
      g.globalAlpha = (1 - z) * (.28 + e * .4); g.strokeStyle = i % 2 ? hue : hue2;
      g.lineWidth = (.8 + z * 2.4) * c.DPR;
      g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * .22); g.stroke();
      const cn = 4;
      for (let q = 0; q < cn; q++) {                                     // corner lights streaming in
        const ax = cx + (q % 2 ? 1 : -1) * w * .5, ay = cy + (q < 2 ? -1 : 1) * h * .5;
        dot(g, ax, ay, (1 + z * 4) * c.DPR, '#FFFFFF', (1 - z) * .3);
      }
    }
    for (let i = 0; i < c.count; i++) {                                  // stars falling through the boundary
      const p = P[i];
      const z = ((p.z + t * .00022 * v.warp) % 1);
      const k = .04 + z * z * 1.5;
      dot(g, cx + p.x * W * .55 * k, cy + p.y * H * .55 * k, (.6 + z * 2.6) * c.DPR, hue2, (1 - z) * .3);
    }
  },

  /* ── DJ Audea · CHORUS ───────────────────────────────────────────────────
     A field of voices that PHASE-LOCK. Each carries its own phase; as the
     phrase builds they synchronise, and at lock they flare gold together —
     one wave out of a thousand.  MEANING: rung 5 — emergent chorus. */
  chorus(g, c) {
    const { W, H, t, e, drop, hue, v } = c;
    const lock = Math.pow(e, 1.6);                                       // how synchronised the room is
    for (let i = 0; i < c.count; i++) {
      const p = P[i];
      const own = p.t * 6;                                               // its own phase
      const common = t * .0021 * v.warp;
      const ph = own * (1 - lock) + common * lock + v.drift;
      const bx = ((p.i * 73) % 997) / 997 * W;
      const amp = (18 + e * 60) * c.DPR;
      const y = H * .5 + Math.sin(bx * .0055 + ph) * amp + Math.sin(bx * .019 - ph * .6) * amp * .3;
      const crest = Math.sin(bx * .0055 + ph);
      const hot = crest > .82 && lock > .45;
      dot(g, bx, y, (1.2 + p.s * 1.4) * c.DPR * (hot ? 2 : 1), hot ? '#E8C46B' : hue, hot ? .55 : .16 + lock * .2);
      if (hot) streak(g, bx, y, bx, H * .5, 1 * c.DPR, '#E8C46B', .12);
    }
    if (drop > 0) {                                                      // the room becomes one voice
      g.globalAlpha = drop * .5; g.strokeStyle = '#E8C46B'; g.lineWidth = 3 * c.DPR;
      g.beginPath();
      for (let x = 0; x <= W; x += 6) { const y = H * .5 + Math.sin(x * .0055 + t * .002) * 70 * c.DPR * drop; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  },
};

/* ── THE MOTUS SIGIL — five nodes, one wheel, always turning. The signature
   that says this motion means something. Drawn in the corner, faint. ── */
function sigil(g, c) {
  const { W, H, t, e, hue, hue2 } = c;
  const cx = W - 58 * c.DPR, cy = H - 54 * c.DPR, R = 22 * c.DPR;
  const a0 = t * .00019;
  g.globalAlpha = .2 + e * .16; g.strokeStyle = hue2; g.lineWidth = 1.3 * c.DPR;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = a0 + (i % 5) * (TAU / 5);
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  for (let i = 0; i < 5; i++) {
    const a = a0 + i * (TAU / 5);
    dot(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, (i === 0 ? 3.4 : 2.4) * c.DPR, i === 0 ? '#E8C46B' : hue, .5);
  }
}

/* ── the public engine ── */
M.WORLDS = WORLDS;
M.FADE = FADE;
M.sigil = sigil;
M.dot = dot;
M.markPhrase = (gold) => { RINGS.push({ r: 4, a: .5, gold: !!gold }); if (RINGS.length > 26) RINGS.shift(); };
// Switching worlds must not inherit the last world's bodies — a flock's
// positions are meaningless as a spectrum's, and stale state reads as a glitch.
M.reset = () => {
  for (const p of P) { p.px = p.py = p.fx = p.fy = undefined; p.r = Math.random(); p.a = Math.random() * TAU; }
  RINGS.length = 0;
};
M.render = function render(g, name, c) {
  const world = WORLDS[name] || WORLDS.murmuration;
  // 1 · TRAILS: fade the last frame rather than wiping it
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = `rgba(3,5,9,${FADE[name] != null ? FADE[name] : .12})`;
  g.fillRect(0, 0, c.W, c.H);
  // 2 · ADDITIVE LIGHT for everything that follows
  g.globalCompositeOperation = 'lighter';
  world(g, c);
  sigil(g, c);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
};
})();
