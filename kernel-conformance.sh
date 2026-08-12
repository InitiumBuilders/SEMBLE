#!/usr/bin/env bash
# KERNEL CONFORMANCE — does the DEPLOYED kernel match an implementation written
# only from the published spec?
#
# This is the check that turns "reproducible by anyone" from a claim into a
# fact. It also catches the failure that nearly shipped: a NUL byte replaced the
# separator in the `score` kernel, which does not throw — it produces a
# CONSISTENTLY WRONG answer that two honest machines compute identically and
# consensus happily settles. Silently wrong AND verified is the worst outcome
# this system has, and only a known-answer test finds it.
set -u
B=https://www.semble.cc

node - <<'JS'
const B = 'https://www.semble.cc';

// ── independent implementation, from the spec alone ──
const fnv1a = (s, seed) => { let h = (seed >>> 0) || 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) & 0xff; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const embed = (t, seed, d = 64) => { const v = new Array(d).fill(0);
  for (const x of String(t).toLowerCase().split(/[^a-z0-9]+/)) { if (x.length < 2) continue; v[fnv1a(x, seed) % d]++; } return v; };
const isqrt = (n) => { if (n < 2) return n < 0 ? 0 : n; let x = n, y = Math.floor((x + 1) / 2);
  while (y < x) { x = y; y = Math.floor((x + Math.floor(n / x)) / 2); } return x; };
const scoreVec = (a, b) => { let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0; return Math.floor((dot * 10000) / Math.max(1, isqrt(na) * isqrt(nb))); };
const tile = (seed, n) => { const v = new Array(n * n); let h = (seed >>> 0) || 2166136261;
  for (let i = 0; i < n * n; i++) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; v[i] = ((h >>> 24) & 0xff) - 128; } return v; };
const matmulTile = (a, b, n) => { const c = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const aik = a[i * n + k]; if (!aik) continue;
    for (let j = 0; j < n; j++) c[i * n + j] += aik * b[k * n + j]; } return c; };

function mine(kind, payload, seed) {
  let out = '';
  if (kind === 'embed' || kind === 'canary') out = embed(payload, seed).join(',');
  else if (kind === 'score') { const sp = String(payload).split(' ');
    out = String(scoreVec(embed(sp[0] || '', seed), embed(sp.slice(1).join(' ') || '', seed))); }
  else if (kind === 'matmul') { const n = Math.max(4, Math.min(64, parseInt(payload, 10) || 32));
    const c = matmulTile(tile(seed, n), tile((seed ^ 0x9e3779b9) >>> 0, n), n);
    let s = 0; for (let i = 0; i < c.length; i++) s = (s + Math.imul(c[i], i + 1)) | 0; out = `${n}:${s}`; }
  return { out, digest: (fnv1a(out, seed) >>> 0).toString(16).padStart(8, '0') };
}

const CASES = [
  { kind: 'embed',  payload: 'motus is the mindset the mindset means move', seed: 2654435761 },
  { kind: 'embed',  payload: 'a stock is a quantity a flow is a rate',      seed: 99991 },
  { kind: 'score',  payload: 'leverage systems thinking leverage points',   seed: 12345 },
  { kind: 'score',  payload: 'unrelated completely different subject here', seed: 777 },
  { kind: 'matmul', payload: '32',                                          seed: 424242 },
  { kind: 'matmul', payload: '16',                                          seed: 8675309 },
  { kind: 'canary', payload: 'known answer probe',                          seed: 31337 },
];

(async () => {
  let pass = 0, fail = 0;
  for (const c of CASES) {
    const r = await fetch(`${B}/api/work`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'kernel-probe', ...c }),
    }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    const m = mine(c.kind, c.payload, c.seed);
    const ok = r.digest === m.digest;
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? '✓' : '⚠ MISMATCH'}  ${c.kind.padEnd(7)} seed ${String(c.seed).padEnd(11)} server ${r.digest || '—'}  mine ${m.digest}`);
    if (!ok) { console.log(`      server out: ${String(r.out).slice(0, 90)}`); console.log(`      mine   out: ${m.out.slice(0, 90)}`); }
  }
  console.log();
  console.log(`  ${pass}/${pass + fail} kernels reproduce exactly from the published spec`);

  // the score kernel specifically — the one the NUL corrupted
  const s1 = mine('score', 'alpha alpha', 5).out;
  const s2 = mine('score', 'alpha beta', 5).out;
  console.log(`  score sanity: identical="${s1}" (want 10000)  different="${s2}" (want < 10000) — ${s1 === '10000' && Number(s2) < 10000 ? 'CORRECT ✓' : '⚠ SEPARATOR BROKEN'}`);
  process.exit(fail ? 1 : 0);
})();
JS
