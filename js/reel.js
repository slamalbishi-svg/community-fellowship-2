// ============================================================
//  Fellowship Reel — 70s @ 60fps — deterministic render(t)
// ============================================================
const C = document.getElementById('c'), X = C.getContext('2d');
const W = 1080, H = 1920, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const COL = { ink: '#07090F', navy: '#0B1322', cream: '#F4EFE4', em: '#00B67A', deep: '#03392B', gold: '#F2B233', coral: '#FF5A3C' };
const { env, hits } = window.TIMING;
let Q = 1; window.setQ = q => { Q = q; C.width = Math.round(W * q); C.height = Math.round(H * q); };

// ---------- math ----------
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const pr = (t, a, b) => cl((t - a) / (b - a));
const E = {
  lin: p => p,
  o3: p => 1 - Math.pow(1 - p, 3),
  o5: p => 1 - Math.pow(1 - p, 5),
  i3: p => p * p * p,
  io3: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  oExpo: p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p),
  iExpo: p => p <= 0 ? 0 : Math.pow(2, 10 * p - 10),
  ioExpo: p => p <= 0 ? 0 : p >= 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
  oBack: p => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  oElastic: p => p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * TAU / 3) + 1,
};
const ep = (t, a, d, e = E.oExpo) => e(pr(t, a, a + d));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const AR = s => String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---------- audio features ----------
const envAt = t => env[cl(Math.floor(t * 60), 0, env.length - 1)] || 0;
function kick(t, min = .45, decay = 9) { let k = 0; for (const [h, s] of hits) { if (s < min) continue; const d = t - h; if (d >= 0 && d < 1) k = Math.max(k, s * Math.exp(-d * decay)); } return k; }

// ---------- cues (video seconds, derived from vocal phrase onsets) ----------
const T = { c1: 3.58, c2: 6.55, c3: 8.99, c4: 12.58, c5: 16.83, m8: 19.82, m8b: 21.87, map: 22.84, ct: [25.28, 27.03, 28.81, 30.01, 31.82], ta: 34.8, tb: 36.53, ha: 38.07, hb: 40.96, pl: 42.11, pl2: 44.42, e1: 47.60, e2: 49.30, e3: 51.01, qd: [51.01, 52.8, 54.58, 56.99], la: 58.79, bs: 61.83, vo: 63.91, d1: 66.26, d2: 67.82, d3: 69.57, g1: 70.87, g2: 72.53, g3: 73.82, land: 75.31, i1: 77.61, bu: 80.85, po: 84.58, po2: 86.98, an: 88.83, an2: 90.02, ca: 91.83, ro: 94.8, j1: 98.07, j2: 99.22, cr: 100.83, k1: 101.96, k2: 103.23, qs: 104.94, fin: 110.99, c24: 110.99, END: 132.0 };

// ---------- drawing helpers ----------
const font = (s, w = 900, f = 'T') => `${w} ${s}px ${f}`;
function bg(c) { X.fillStyle = c; X.fillRect(-200, -200, W + 400, H + 400); }
function measure(str, s, w = 900, f = 'T') { X.save(); X.font = font(s, w, f); X.direction = 'rtl'; const m = X.measureText(str).width; X.restore(); return m; }
function fit(str, maxW, s, w = 900, f = 'T') { const m = measure(str, s, w, f); return m > maxW ? s * maxW / m : s; }
function alpha(c, a) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
function circle(x, y, r, c) { if (r <= 0) return; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fillStyle = c; X.fill(); }
function ring(x, y, r, lw, c, a0 = 0, a1 = TAU, cap = 'round') { if (r <= 0 || a1 === a0) return; X.beginPath(); X.arc(x, y, r, a0, a1); X.lineWidth = lw; X.strokeStyle = c; X.lineCap = cap; X.stroke(); }
function dotGrid(sp, r, c, a, ext = 0, ox = 0, oy = 0) {
  if (a <= 0) return; X.save(); X.fillStyle = c; X.globalAlpha = a;
  for (let y = -ext + ((oy % sp) + sp) % sp; y < H + ext; y += sp) for (let x = -ext + ((ox % sp) + sp) % sp; x < W + ext; x += sp) X.fillRect(x - r, y - r, r * 2, r * 2);
  X.restore();
}
function rays(x, y, n, r0, r1, wA, c, rot) { X.save(); X.fillStyle = c; X.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; X.moveTo(x + Math.cos(a - wA) * r0, y + Math.sin(a - wA) * r0); X.lineTo(x + Math.cos(a - wA) * r1, y + Math.sin(a - wA) * r1); X.lineTo(x + Math.cos(a + wA) * r1, y + Math.sin(a + wA) * r1); X.lineTo(x + Math.cos(a + wA) * r0, y + Math.sin(a + wA) * r0); X.closePath(); } X.fill(); X.restore(); }
function glow(x, y, r, c, a) { if (a <= 0) return; const g = X.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, alpha(c, a)); g.addColorStop(1, alpha(c, 0)); X.fillStyle = g; X.fillRect(x - r, y - r, r * 2, r * 2); }

// Word-by-word Arabic kinetic type (RTL layout; joining preserved per word)
function words(str, cx, cy, size, o) {
  const { t, t0, stagger = .08, dur = .75, color = COL.cream, w = 900, f = 'T', out = null, outDur = .4, style = 'up', ease = E.oExpo, stroke = 0, extrude = null } = o;
  X.save(); X.font = font(size, w, f); X.direction = 'rtl'; X.textAlign = 'center'; X.textBaseline = 'middle';
  const ws = str.split(' ');
  let ms = ws.map(s => X.measureText(s).width), sp = size * .27, tot = ms.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  const maxW = o.maxW || 940;
  if (tot > maxW) { size *= maxW / tot; X.font = font(size, w, f); ms = ws.map(s => X.measureText(s).width); sp = size * .27; tot = ms.reduce((a, b) => a + b, 0) + sp * (ws.length - 1); }
  let x = cx + tot / 2;
  ws.forEach((s, i) => {
    const wx = x - ms[i] / 2; x -= ms[i] + sp;
    const p = ease(pr(t, (o.times ? o.times[i] : t0 + i * stagger), (o.times ? o.times[i] : t0 + i * stagger) + dur));
    const q = out != null ? E.iExpo(pr(t, out + i * stagger * .5, out + i * stagger * .5 + outDur)) : 0;
    if (p <= 0 || q >= 1) return;
    X.save();
    if (style === 'up') {
      X.beginPath(); X.rect(wx - ms[i] / 2 - size * .3, cy - size * 1.0, ms[i] + size * .6, size * 2.0); X.clip();
      X.translate(wx, cy + (1 - p) * size * 1.3 - q * size * 1.3);
    } else if (style === 'scale') {
      const s = lerp(2.4, 1, p) * (1 + q * .4); X.translate(wx, cy); X.scale(s, s); X.globalAlpha = cl(p * 1.8) * (1 - q);
    } else if (style === 'drop') {
      X.translate(wx, cy - (1 - p) * size * .6 - q * size); X.rotate((1 - p) * -.12); X.globalAlpha = cl(p * 2) * (1 - q);
    }
    if (extrude) { X.fillStyle = extrude; for (let k = 10; k > 0; k--) X.fillText(s, k * 2.2, k * 2.2); }
    if (stroke) { X.lineWidth = stroke; X.strokeStyle = color; X.lineJoin = 'round'; X.strokeText(s, 0, 0); } else { X.fillStyle = color; X.fillText(s, 0, 0); }
    X.restore();
  });
  X.restore(); return tot;
}
// RTL mask reveal of a full line (keeps Arabic ligatures intact)
function reveal(str, cx, cy, size, t, t0, dur, color, w = 900, f = 'T') {
  const p = ep(t, t0, dur, E.ioExpo); if (p <= 0) return;
  X.save(); X.font = font(size, w, f); X.direction = 'rtl'; X.textAlign = 'center'; X.textBaseline = 'middle';
  const m = X.measureText(str).width, x1 = cx + m / 2 + 30;
  X.beginPath(); X.rect(x1 - (m + 60) * p, cy - size, (m + 60) * p, size * 2); X.clip();
  X.fillStyle = color; X.fillText(str, cx, cy + (1 - p) * 30); X.restore();
  if (p < 1) { X.fillStyle = COL.gold; X.fillRect(x1 - (m + 60) * p - 6, cy - size * .6, 6, size * 1.2); }
}

// Deterministic confetti (drag + gravity + 3D flutter)
function confetti(t, t0, seed, n, x, y, o = {}) {
  const dt = t - t0; const life = o.life || 2.6; if (dt <= 0 || dt > life) return;
  const R = rng(seed), cols = o.cols || [COL.gold, COL.em, COL.cream, COL.coral];
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, v0 = o.v || 2600, g = o.g ?? 1400, k = 2.6;
  for (let i = 0; i < n; i++) {
    const a = a0 + R() * (a1 - a0), v = v0 * (.35 + R() * .85), vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const f = (1 - Math.exp(-k * dt)) / k, px = x + vx * f, py = y + vy * f + .5 * g * dt * dt * .55;
    const sz = (o.s || 18) * (.5 + R()), rot = R() * 6 + dt * (R() * 12 - 6), flip = Math.cos(dt * (6 + R() * 10) + R() * 6);
    const shape = R(), c = cols[Math.floor(R() * cols.length)];
    X.save(); X.globalAlpha = 1 - pr(dt, life - .7, life); X.translate(px, py); X.rotate(rot); X.scale(1, flip); X.fillStyle = c;
    if (shape < .4) X.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
    else if (shape < .7) { X.beginPath(); X.arc(0, 0, sz / 2.6, 0, TAU); X.fill(); }
    else { X.beginPath(); X.moveTo(0, -sz / 2); X.lineTo(sz / 2, sz / 2); X.lineTo(-sz / 2, sz / 2); X.closePath(); X.fill(); }
    X.restore();
  }
}
// Floating geometric field (Dribbble flavour)
function shapes(t, seed, n, cols, a = 1, spd = 1) {
  const R = rng(seed); X.save(); X.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const x = R() * W, y0 = R() * H, s = 18 + R() * 40, ty = R(), c = cols[Math.floor(R() * cols.length)], ph = R() * TAU, v = (20 + R() * 50) * spd;
    const y = ((y0 - t * v) % (H + 200) + H + 200) % (H + 200) - 100;
    X.save(); X.translate(x + Math.sin(t * .8 + ph) * 20, y); X.rotate(t * (R() - .5) * 2 + ph); X.strokeStyle = c; X.fillStyle = c; X.lineWidth = 4;
    if (ty < .3) { X.beginPath(); X.arc(0, 0, s / 2, 0, TAU); X.stroke(); }
    else if (ty < .55) { X.strokeRect(-s / 2, -s / 2, s, s); }
    else if (ty < .8) { X.fillRect(-s / 2, -2.5, s, 5); X.fillRect(-2.5, -s / 2, 5, s); }
    else { X.beginPath(); X.moveTo(0, -s / 2); X.lineTo(s / 2, s / 2); X.lineTo(-s / 2, s / 2); X.closePath(); X.stroke(); }
    X.restore();
  }
  X.restore();
}
function shockwaves(t, x, y, from, to, c, rMax = 520, min = .5, lw = 4) {
  for (const [h, s] of hits) { if (s < min || h < from || h > to) continue; const d = t - h; if (d < 0 || d > 1.1) continue; const p = E.o3(d / 1.1); X.globalAlpha = (1 - p) * .7 * s; ring(x, y, 40 + rMax * p, lw * (1 - p) + 1, c); X.globalAlpha = 1; }
}

// ===== SCENES =====
// A — passion spark → target (goal)
const aP = (() => { const R = rng(7), a = []; for (let i = 0; i < 84; i++) a.push({ ang: R() * TAU, d: 220 + R() * 520, ring: i % 3, s: 4 + R() * 6, ph: R() * TAU, c: R() < .6 ? COL.gold : COL.cream }); return a; })();
function sA(t) {
  bg(COL.ink);
  dotGrid(60, 1.6, COL.cream, .09 * ep(t, 0, 1.2, E.o3));
  const ox = CX, oy = CY - 250, k = kick(t);
  const push = E.iExpo(pr(t, T.c3 - .75, T.c3 + .5));
  X.save(); X.translate(ox, oy); X.scale(1 + push * 3, 1 + push * 3); X.rotate(push * .3); X.translate(-ox, -oy);
  glow(ox, oy, 420, COL.gold, .22 * ep(t, 0, 1) + .2 * k);
  X.save(); X.setLineDash([3, 16]); ring(ox, oy, 330 * ep(t, 0, 1.4), 3, alpha(COL.cream, .35), t * .5, t * .5 + TAU * ep(t, .1, 1.6, E.io3), 'butt'); X.restore();
  shockwaves(t, ox, oy, .1, T.c3, COL.gold, 420);
  // target rings (goal)
  const R3 = [240, 165, 92];
  R3.forEach((r, i) => { const p = ep(t, T.c2 + .02 + i * .1, .9, E.io3); ring(ox, oy, r, i === 0 ? 10 : 7, [COL.gold, COL.cream, COL.em][i], -Math.PI / 2, -Math.PI / 2 + TAU * p, 'round'); });
  // particles: burst at c1, converge onto rings at c2
  for (let i = 0; i < aP.length; i++) {
    const q = aP[i];
    const b = E.oExpo(pr(t, T.c1, T.c1 + 1.6)), dr = q.d * b;
    const a = q.ang + Math.sin(t * .7 + q.ph) * .08;
    let x = ox + Math.cos(a) * dr + Math.sin(t * 1.3 + q.ph) * 14 * b, y = oy + Math.sin(a) * dr + Math.cos(t * 1.1 + q.ph) * 14 * b;
    const p = E.io3(pr(t, T.c2 - .1 + i * .004, T.c2 + .7 + i * .004));
    const ta = q.ang + (t - T.c2) * .35 * (q.ring % 2 ? 1 : -1), tr = R3[q.ring];
    x = lerp(x, ox + Math.cos(ta) * tr, p); y = lerp(y, oy + Math.sin(ta) * tr, p);
    if (b > 0) circle(x, y, q.s * (1 - .4 * p) * (1 + .5 * k), q.c);
  }
  const r0 = E.oElastic(pr(t, 0, 1)) * 48 * (1 + .45 * k) + ep(t, T.c2, .6, E.oBack) * 10;
  circle(ox, oy, r0, COL.gold); circle(ox, oy, r0 * .38, COL.ink);
  X.restore();
  words('بدأنا بشغف', CX, CY + 190, 176, { t, t0: T.c1 + .05, stagger: .14, dur: .9, out: T.c2 - .32 });
  words('وجمعنا هدف', CX, CY + 190, 176, { t, t0: T.c2 + .04, stagger: .14, dur: .9, out: T.c3 - .5, color: COL.cream });
  const u = ep(t, T.c2 + .3, .7, E.io3) * (1 - ep(t, T.c3 - .5, .4, E.iExpo)); X.fillStyle = COL.gold; X.fillRect(CX - 170 * u, CY + 318, 340 * u, 8);
}

// B — learning (ruled lines + highlighter)
function sB(t) {
  bg(COL.cream);
  for (let i = 0; i < 15; i++) { const p = ep(t, T.c3 + .05 + i * .03, 1, E.oExpo), y = 180 + i * 116; X.fillStyle = alpha(COL.ink, .09); X.fillRect(W - 90 - (W - 180) * p, y, (W - 180) * p, 2); }
  const mp = ep(t, T.c3 + .2, 1.2, E.io3); X.fillStyle = alpha(COL.coral, .7); X.fillRect(W - 170, 0, 3, H * mp);
  shapes(t, 11, 12, [COL.ink, COL.em, COL.gold], .55 * ep(t, T.c3, .8));
  const s = 214; X.save(); X.font = font(s); X.direction = 'rtl';
  const w1 = X.measureText('أن').width, w2 = X.measureText('نتعلّم').width; X.restore();
  const tot = w1 + w2 + s * .27, x2c = CX + tot / 2 - w1 - s * .27 - w2 / 2;
  const hp = ep(t, T.c3 + .55, .6, E.io3) * (1 - ep(t, T.c4 - .45, .35, E.iExpo));
  X.fillStyle = COL.gold; X.save(); X.translate(x2c + w2 / 2 + 20, CY + 30); X.rotate(-.025); X.fillRect(-(w2 + 40) * hp, -52, (w2 + 40) * hp, 104); X.restore();
  words('أن نتعلّم', CX, CY - 10, s, { t, t0: T.c3 + .15, stagger: .15, dur: .9, color: COL.ink, out: T.c4 - .4 });
  // pen dot orbit
  const a = t * 2.2; circle(CX + Math.cos(a) * 380, CY - 10 + Math.sin(a) * 220, 10 * ep(t, T.c3 + .3, .5, E.oBack), COL.em);
}

// B2 — impact ripples
function sB2(t) {
  bg(COL.em);
  const k = kick(t);
  for (let j = 0; j < 14; j++) { const b = T.c4 - .2 + j * .42; const d = t - b; if (d < 0) continue; const r = d * 700; if (r > 1500) continue; X.globalAlpha = cl(1 - r / 1500) * .85; ring(CX, CY, r, j % 3 === 0 ? 14 : 4, j % 3 === 0 ? COL.gold : COL.cream); }
  X.globalAlpha = 1;
  glow(CX, CY, 700, COL.cream, .14 + .15 * k);
  words('لنصنع أثرًا', CX, CY, 210, { t, t0: T.c4 + .05, stagger: .16, dur: .7, style: 'scale', out: T.c5 - .38, extrude: alpha(COL.deep, .35) });
}

// C — eight months ring
function sC(t) {
  bg(COL.navy);
  dotGrid(54, 1.4, COL.cream, .07);
  const ox = CX, oy = CY - 210, k = kick(t), R = 330;
  X.save(); X.setLineDash([2, 14]); ring(ox, oy, R + 70, 2, alpha(COL.cream, .4), -t * .3, -t * .3 + TAU * ep(t, T.m8, 1.2), 'butt'); X.restore();
  for (let i = 0; i < 8; i++) {
    const a0 = -Math.PI / 2 + i * TAU / 8 + .06, a1 = a0 + TAU / 8 - .12;
    ring(ox, oy, R, 34, alpha(COL.cream, .1), a0, a1, 'butt');
    const p = ep(t, T.m8 + .2 + i * .26, .45, E.o5);
    ring(ox, oy, R, 34 + 10 * k * p, i % 2 ? COL.gold : COL.em, a0, a0 + (a1 - a0) * p, 'butt');
    const mx = ox + Math.cos(-Math.PI / 2 + i * TAU / 8) * (R + 70), my = oy + Math.sin(-Math.PI / 2 + i * TAU / 8) * (R + 70);
    circle(mx, my, 6 * ep(t, T.m8 + .2 + i * .26, .4, E.oBack), COL.cream);
  }
  const ns = E.oElastic(pr(t, T.m8, T.m8 + 1.1)) * (1 + .06 * k);
  X.save(); X.translate(ox, oy + 30); X.scale(ns, ns); X.font = font(470); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = COL.cream; X.fillText('٨', 0, 0); X.restore();
  words('ثمانية أشهر', CX, CY + 300, 150, { t, t0: T.m8 + .1, stagger: .12, out: T.map - .3 });
  words('من المعرفة والتجربة', CX, CY + 470, 88, { t, t0: T.m8b, stagger: .08, color: COL.gold, w: 700, out: T.map - .3 });
}

// E — learning from experts (echo stack) → field test build-up
function sE(t) {
  if (t < T.e2) {
    bg(COL.gold);
    const str = 'تعلّمنا من الخبراء', s = fit(str, 960, 150);
    for (let k = -4; k <= 4; k++) {
      const dx = (k % 2 ? 1 : -1) * (t - T.e1) * 70 * Math.abs(k);
      words(str, CX + dx, CY + k * 170, s, { t, t0: T.e1 + .05 + Math.abs(k) * .06, stagger: .06, color: k ? alpha(COL.ink, 1 - Math.abs(k) * .2) : COL.ink, stroke: k ? 2.5 : 0 });
    }
    return;
  }
  bg(COL.ink);
  const b = pr(t, T.e2, T.e3), zz = 1 + .16 * E.iExpo(b);
  X.save(); X.translate(CX, CY); X.scale(zz, zz); X.translate(-CX, -CY);
  rays(CX, CY, 40, 260, 1500, .012 + .01 * b, alpha(COL.cream, .06 + .12 * b), (t - T.e2) * (.2 + 1.8 * b * b));
  shapes(t * (1 + b * 3), 23, 16, [COL.gold, COL.em], .5);
  const s1 = fit('واختبرنا المعرفة', 940, 150);
  words('واختبرنا المعرفة', CX, CY - 110, s1, { t, t0: T.e2 + .02, stagger: .1 });
  words('في الميدان', CX, CY + 110, 190, { t, t0: T.e2 + .45, stagger: .12, color: COL.gold });
  X.restore();
  const bw = 760; X.fillStyle = alpha(COL.cream, .15); X.fillRect(CX - bw / 2, H - 300, bw, 10); X.fillStyle = COL.gold; X.fillRect(CX + bw / 2 - bw * E.i3(b), H - 300, bw * E.i3(b), 10);
  // eye-open cut from gold part
  const o = ep(t, T.e2, .3, E.o5); if (o < 1) { X.fillStyle = COL.gold; const g = H / 2 * (1 - o); X.fillRect(0, 0, W, g); X.fillRect(0, H - g, W, g); }
  X.fillStyle = `rgba(255,255,255,${.95 * E.i3(pr(t, T.e3 - .28, T.e3))})`; X.fillRect(0, 0, W, H);
}

// F — DROP: three hits
const dropW = [
  { t: T.d1, s: 'أنصتنا', bg: COL.em, fg: COL.cream, ex: COL.deep },
  { t: T.d2, s: 'شاركنا', bg: COL.gold, fg: COL.ink, ex: '#9C6B08' },
  { t: T.d3, s: 'وبادرنا', bg: COL.coral, fg: COL.cream, ex: '#8E2311' },
];
function marquee(str, y, size, speed, c, t, t0) {
  X.save(); X.font = font(size); X.direction = 'rtl'; X.textAlign = 'left'; X.textBaseline = 'middle'; X.lineWidth = 2.5; X.strokeStyle = c;
  const w = X.measureText(str).width + size * .6; let off = ((t - t0) * speed) % w; if (off > 0) off -= w;
  for (let x = off - w; x < W + w; x += w) X.strokeText(str, x, y);
  X.restore();
}
function sF(t) {
  let i = 0; for (let j = 0; j < 3; j++) if (t >= dropW[j].t) i = j;
  const w = dropW[i], lt = t - w.t;
  bg(i ? dropW[i - 1].bg : w.bg);
  X.save(); X.beginPath(); X.arc(CX, CY, i ? 1400 * E.o5(cl(lt / .3)) : 2000, 0, TAU); X.clip(); bg(w.bg);
  X.globalAlpha = .2; for (let r = 0; r < 9; r++) marquee(w.s, 130 + r * 215, 150, (r % 2 ? 1 : -1) * (300 + r * 40), w.fg, t, w.t - 2); X.globalAlpha = 1;
  rays(CX, CY, 18, 120, 1500, .05, alpha(w.fg, .13), t * .5 + i);
  const s = fit(w.s, 960, 330), sl = E.oExpo(cl(lt / .38));
  X.save(); X.translate(CX, CY); X.rotate((1 - sl) * (i % 2 ? .1 : -.1)); X.scale(lerp(1.9, 1, sl), lerp(1.9, 1, sl)); X.translate(-CX, -CY);
  words(w.s, CX, CY, s, { t, t0: w.t, stagger: 0, dur: .01, color: w.fg, extrude: alpha(w.ex, .55) });
  X.restore();
  confetti(t, w.t, 100 + i, 34, CX, CY, { v: 3000, s: 22, cols: [w.fg, COL.ink, COL.gold, COL.cream].filter(c => c !== w.bg) });
  X.restore();
  // white impact flash per hit
  X.fillStyle = `rgba(255,255,255,${.55 * (1 - cl(lt / .18))})`; X.fillRect(0, 0, W, H);
  // iris close → idea dot
  const ir = pr(t, T.g1 - .42, T.g1);
  if (ir > 0) { const R = 1300 * (1 - E.ioExpo(ir)); X.beginPath(); X.rect(-50, -50, W + 100, H + 100); X.arc(CX, CY, Math.max(R, .1), 0, TAU, true); X.fillStyle = COL.ink; X.fill('evenodd'); circle(CX, CY, 26 * E.oBack(pr(t, T.g1 - .18, T.g1)), COL.gold); }
}

// G — idea → application → 47 projects
const GR = (() => { const a = []; const tile = 92, gap = 14, cols = 7; for (let i = 0; i < 47; i++) { const r = Math.floor(i / cols), c = i % cols; const n = r === 6 ? 5 : 7; a.push({ x: (n - 1) / 2 * (tile + gap) - c * (tile + gap), y: (r - 3) * (tile + gap) }); } return a; })();
function sG(t) {
  bg(COL.ink);
  dotGrid(50, 1.4, COL.cream, .07);
  const k = kick(t);
  const Rp = [CX + 300, CY - 280], Lp = [CX - 300, CY - 280];
  const mv = ep(t, T.g1, .5, E.ioExpo), dx = lerp(CX, Rp[0], mv), dy = lerp(CY, Rp[1], mv);
  const gone = ep(t, T.g2, .3, E.o3);
  if (gone < 1) {
    X.globalAlpha = 1 - gone;
    glow(dx, dy, 200, COL.gold, .45 + .3 * k); circle(dx, dy, 34 * (1 + .3 * k), COL.gold);
    const lp = ep(t, T.g1 + .35, .8, E.io3);
    X.save(); X.setLineDash([14, 12]); X.lineDashOffset = t * 60; X.beginPath(); X.moveTo(Rp[0] - 70, Rp[1]); X.lineTo(Rp[0] - 70 - (Rp[0] - Lp[0] - 190) * lp, Rp[1]); X.lineWidth = 5; X.strokeStyle = COL.cream; X.stroke(); X.restore();
    if (lp > .95) { X.beginPath(); X.moveTo(Lp[0] + 120, Rp[1] - 18); X.lineTo(Lp[0] + 102, Rp[1]); X.lineTo(Lp[0] + 120, Rp[1] + 18); X.lineWidth = 5; X.strokeStyle = COL.cream; X.stroke(); }
    const sq = ep(t, T.g1 + 1.05, .6, E.oBack); if (sq > 0) { X.save(); X.translate(...Lp); X.rotate((1 - sq) * 1.2); X.fillStyle = COL.em; X.beginPath(); X.roundRect(-80 * sq, -80 * sq, 160 * sq, 160 * sq, lerp(80, 22, sq) * sq); X.fill(); X.restore(); }
    X.globalAlpha = 1;
  }
  // grid
  const up = ep(t, T.g3, .7, E.ioExpo), gcx = CX, gcy = lerp(CY - 260, CY - 470, up), gs = lerp(1, .74, up);
  const cnt = Math.round(47 * E.io3(pr(t, T.g3 + .1, T.land)));
  const landP = pr(t, T.land, T.land + .5);
  GR.forEach((g, i) => {
    const p = pr(t, T.g2 + i * .012, T.g2 + i * .012 + .6); if (p <= 0) return;
    const pe = E.oExpo(p), sz = 92 * gs * lerp(.3, 1, E.oBack(p));
    const x = lerp(Lp[0], gcx + g.x * gs, pe), y = lerp(Lp[1], gcy + g.y * gs, pe);
    const lit = t >= T.g3 && i < cnt;
    let c = alpha(COL.cream, .1); if (lit) c = landP > 0 && landP < 1 ? (landP < .3 ? COL.cream : COL.gold) : COL.gold;
    const pop = lit ? 1 + .15 * Math.exp(-(t - T.g3 - .1 - i * .03) * 6) * 0 : 1;
    X.fillStyle = c; X.beginPath(); X.roundRect(x - sz / 2 * pop, y - sz / 2 * pop, sz * pop, sz * pop, 14 * gs); X.fill();
    if (!lit) { X.strokeStyle = alpha(COL.cream, .3); X.lineWidth = 2; X.stroke(); }
    const ck = ep(t, T.land + .45 + i * .028, .25, E.oBack); if (ck > 0) { X.save(); X.translate(x, y); X.scale(ck, ck); X.strokeStyle = COL.ink; X.lineWidth = 9 * gs; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(-22 * gs, 0); X.lineTo(-6 * gs, 16 * gs); X.lineTo(24 * gs, -18 * gs); X.stroke(); X.restore(); }
  });
  words('ومن الفكرة إلى التطبيق', CX, CY + 170, fit('ومن الفكرة إلى التطبيق', 940, 118), { t, t0: T.g1 + .15, stagger: .08, out: T.g2 - .3 });
  words('تشكّلت مشاريعنا', CX, CY + 330, 140, { t, t0: T.g2 + .1, stagger: .12, out: T.g3 - .25 });
  // counter
  const ci = ep(t, T.g3, .45, E.oBack);
  if (ci > 0) {
    glow(CX, CY + 210, 520, COL.gold, .12 + .3 * (1 - cl(landP * 1.5)) * (t >= T.land ? 1 : 0));
    const slam = t >= T.land ? lerp(1.35, 1, E.oElastic(landP)) : 1;
    X.save(); X.translate(CX, CY + 220); X.scale(ci * slam, ci * slam); X.font = font(430); X.textAlign = 'center'; X.textBaseline = 'middle'; X.direction = 'rtl'; X.fillStyle = COL.gold; X.fillText(AR(cnt), 0, 0); X.restore();
    if (t >= T.land) { const d = t - T.land; for (let j = 0; j < 2; j++) { const p = E.o3(cl((d - j * .12) / 1)); if (p > 0 && p < 1) { X.globalAlpha = 1 - p; ring(CX, CY + 220, 120 + 900 * p, 10 - j * 5, j ? COL.cream : COL.gold); X.globalAlpha = 1; } } }
    confetti(t, T.land, 301, 60, CX, CY + 220, { v: 3200, s: 20 });
  }
  words('مشروع تخرّج', CX, CY + 530, 112, { t, t0: T.g3 + .3, stagger: .12, w: 700 });
  if (t >= T.land) { X.fillStyle = `rgba(255,255,255,${.5 * (1 - cl((t - T.land) / .22))})`; X.fillRect(0, 0, W, H); }
}

// I — ambition extends further
const iL = (() => { const R = rng(41), a = []; for (let i = 0; i < 46; i++) a.push({ x: R() * W, l: 150 + R() * 650, v: 1600 + R() * 2600, o: R() * 3000, c: R() < .25 ? COL.gold : COL.em, w: R() < .2 ? 6 : 2 }); return a; })();
function sI(t) {
  bg(COL.deep);
  const lt = t - T.i1;
  iL.forEach(l => { const y = H + 200 - ((l.o + lt * l.v) % (H + l.l + 400)); X.fillStyle = alpha(l.c, .55); X.fillRect(l.x, y, l.w, l.l); });
  const bp = ep(t, T.i1 + .05, .6, E.o5); X.fillStyle = COL.gold; X.fillRect(CX - 4, H - (H + 50) * bp, 8, (H + 50) * bp);
  for (let j = 0; j < 16; j++) { const y = H - ((j * 150 + lt * 700) % (H + 150)); X.save(); X.globalAlpha = .7 * bp; X.strokeStyle = COL.cream; X.lineWidth = 6; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(CX - 34, y + 22); X.lineTo(CX, y - 12); X.lineTo(CX + 34, y + 22); X.stroke(); X.restore(); }
  X.save(); X.fillStyle = COL.deep; X.globalAlpha = .75; X.fillRect(0, CY - 290, W, 520); X.restore();
  words('وطموحٌ', CX, CY - 120, 200, { t, t0: T.i1 + .05, stagger: .1 });
  words('يمتدّ أبعد', CX, CY + 100, 170, { t, t0: T.i1 + .3, stagger: .14, color: COL.gold });
}

// J — today… we celebrate
const jS = (() => { const R = rng(55), a = []; for (let i = 0; i < 110; i++) a.push({ x: R() * W, y: R() * H, s: 1 + R() * 3.5, ph: R() * TAU, v: 10 + R() * 40, c: R() < .5 ? COL.gold : COL.cream }); return a; })();
function sJ(t) {
  bg(COL.ink);
  const cel = t >= T.j2, ct = t - T.j2;
  if (cel) { glow(CX, CY, 1100, COL.gold, .28 * ep(t, T.j2, .4)); rays(CX, CY, 24, 180, 1600, .035, alpha(COL.gold, .14), ct * .35); }
  jS.forEach(s => { const y = ((s.y - t * s.v) % H + H) % H; X.globalAlpha = .35 + .35 * Math.sin(t * 3 + s.ph); circle(s.x, y, s.s, s.c); }); X.globalAlpha = 1;
  const br = 1 + .04 * pr(t, T.j1, T.j2);
  X.save(); X.translate(CX, CY); X.scale(br, br); X.translate(-CX, -CY); glow(CX, CY, 360, COL.cream, .08 * (1 - ep(t, T.j2 - .2, .2)));
  words('واليوم', CX, CY, 140, { t, t0: T.j1 + .08, stagger: 0, dur: 1.1, ease: E.o5, out: T.j2 - .22, outDur: .2 });
  X.restore();
  if (cel) {
    const sl = E.oExpo(cl(ct / .4));
    X.save(); X.translate(CX, CY - 100); X.scale(lerp(2, 1, sl), lerp(2, 1, sl)); X.translate(-CX, -(CY - 100));
    words('نحتفي', CX, CY - 100, 260, { t, t0: T.j2, stagger: 0, dur: .01, color: COL.gold, extrude: alpha('#000000', .35) });
    X.restore();
    words('بختام الزمالة', CX, CY + 130, 150, { t, t0: T.j2 + .15, stagger: .12 });
    words('تُوِّجت رحلتنا', CX, CY + 380, 120, { t, t0: T.cr, stagger: .12, color: COL.gold });
    { const cp = ep(t, T.cr - .05, .5, E.oBack); if (cp > 0) { X.save(); X.translate(CX, CY - 360); X.scale(cp, cp); X.fillStyle = COL.gold; X.beginPath(); X.moveTo(-150, 70); X.lineTo(-170, -80); X.lineTo(-80, 0); X.lineTo(0, -110); X.lineTo(80, 0); X.lineTo(170, -80); X.lineTo(150, 70); X.closePath(); X.fill(); [-170, 0, 170].forEach((x, i) => circle(x, [-80, -110, -80][i] - 18, 16, COL.cream)); X.restore(); } }
    confetti(t, T.j2, 501, 70, -20, H + 20, { a0: -1.45, a1: -.85, v: 3600, s: 22, life: 3 });
    confetti(t, T.j2, 502, 70, W + 20, H + 20, { a0: -2.3, a1: -1.7, v: 3600, s: 22, life: 3 });
    confetti(t, T.j2, 503, 40, CX, CY - 100, { v: 2600, s: 18 });
    X.fillStyle = `rgba(255,255,255,${.5 * (1 - cl(ct / .2))})`; X.fillRect(0, 0, W, H);
  }
}

// K — new chapter (card stack)
function card(x, y, w, h, rot, c, s) { X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s); X.fillStyle = 'rgba(0,0,0,.18)'; X.beginPath(); X.roundRect(-w / 2 + 16, -h / 2 + 22, w, h, 40); X.fill(); X.fillStyle = c; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, 40); X.fill(); X.restore(); }
function sK(t) {
  bg(COL.cream);
  dotGrid(48, 1.5, COL.ink, .08);
  shapes(t, 71, 10, [COL.ink, COL.em, COL.coral], .5);
  const k = kick(t), lt = t - T.k1;
  const p1 = ep(t, T.k1 + .05, .8, E.oBack), p2 = ep(t, T.k1 + .15, .8, E.oBack), p3 = ep(t, T.k1 + .25, .8, E.oBack);
  card(CX, CY + 10, 800, 980, -.2 * p1 + Math.sin(t) * .01, COL.em, lerp(.7, 1, p1));
  card(CX, CY + 10, 800, 980, .13 * p2, COL.gold, lerp(.7, 1, p2));
  card(CX, CY + 10, 800, 980, -.03 * p3, COL.ink, lerp(.7, 1, p3) * (1 + .01 * k));
  X.save(); X.translate(CX, CY + 10); X.rotate(-.03 * p3);
  const rb = ep(t, T.k1 + .5, .7, E.oBack); X.fillStyle = COL.coral; X.beginPath(); X.moveTo(230, -490); X.lineTo(310, -490); X.lineTo(310, -490 + 220 * rb); X.lineTo(270, -490 + 190 * rb); X.lineTo(230, -490 + 220 * rb); X.fill();
  for (let i = 0; i < 4; i++) { const p = ep(t, T.k1 + .5 + i * .06, .7); X.fillStyle = alpha(COL.cream, .15); X.fillRect(300 - 600 * p, 250 + i * 50, 600 * p, 6); }
  X.restore();
  words('وبدأ فصلٌ جديدٌ', CX, CY - 150, fit('وبدأ فصلٌ جديدٌ', 680, 116), { t, t0: T.k1 + .3, stagger: .1 });
  words('من العمل والعطاء', CX, CY + 40, fit('من العمل والعطاء', 680, 104), { t, t0: T.k2, stagger: .1, color: COL.gold });
}

// L/M — network → brand lockup
const nodes = (() => { const R = rng(91), a = []; for (let i = 0; i < 26; i++) { const ang = R() * TAU, r = Math.sqrt(R()); a.push({ x: CX + Math.cos(ang) * r * 440, y: CY - 280 + Math.sin(ang) * r * 520, d: R() * .7, c: [COL.gold, COL.em, COL.cream, COL.coral][i % 4] }); } return a; })();
const edges = (() => { const e = []; nodes.forEach((n, i) => { const d = nodes.map((m, j) => [j, Math.hypot(m.x - n.x, m.y - n.y)]).filter(v => v[0] !== i).sort((a, b) => a[1] - b[1]); for (let k = 0; k < 2; k++) { const j = d[k][0]; if (!e.some(v => (v[0] === j && v[1] === i))) e.push([i, j, n.d + k * .1]); } }); return e; })();

// ================= NEW SCENES (same visual language as v1) =================
// H — «وبدأت حكاية الزمالة…»
function sH(t) {
  bg(COL.ink);
  dotGrid(60, 1.6, COL.cream, .08);
  const lt = t - T.c5, k = kick(t);
  glow(CX, CY - 40, 900, COL.gold, .22 + .2 * k);
  rays(CX, CY - 40, 28, 200, 1600, .03, alpha(COL.gold, .12), lt * .3);
  for (let j = 0; j < 3; j++) { const d = lt - j * .14; if (d < 0 || d > 1.3) continue; const p = E.o3(d / 1.3); X.globalAlpha = 1 - p; ring(CX, CY - 40, 80 + 1100 * p, 14 * (1 - p) + 2, j === 1 ? COL.cream : COL.gold); X.globalAlpha = 1; }
  shapes(t, 17, 14, [COL.gold, COL.em, COL.cream], .45);
  words('وبدأت', CX, CY - 380, 140, { t, t0: T.c5 + .02, out: T.m8 - .35 });
  const sl = E.oExpo(pr(t, T.c5 + .12, T.c5 + .5));
  X.save(); X.translate(CX, CY - 60); X.scale(lerp(1.9, 1, sl), lerp(1.9, 1, sl)); X.translate(-CX, -(CY - 60));
  words('حكاية', CX, CY - 60, 330, { t, t0: T.c5 + .12, stagger: 0, dur: .01, color: COL.gold, extrude: alpha('#000000', .4), out: T.m8 - .35 });
  X.restore();
  words('الزمالة', CX, CY + 250, 160, { t, t0: T.c5 + .3, out: T.m8 - .35 });
  X.fillStyle = `rgba(255,255,255,${.4 * (1 - cl(lt / .2))})`; X.fillRect(0, 0, W, H);
}

function bez(p, a, c, b) { const u = 1 - p; return [u * u * a[0] + 2 * u * p * c[0] + p * p * b[0], u * u * a[1] + 2 * u * p * c[1] + p * p * b[1]]; }
// D5 — five countries on one route
// TS — learned · travelled · horizons widen · goals unite
const tsP = (() => { const R = rng(21), a = []; for (let i = 0; i < 70; i++) a.push({ x: R() * W, y: R() * H, ring: i % 3, ang: R() * TAU, s: 4 + R() * 5, c: R() < .6 ? COL.gold : COL.cream }); return a; })();
function sTS(t) {
  bg(COL.navy);
  const zo = ep(t, T.ha, 1.4, E.ioExpo), sc = lerp(1.5, .55, zo);
  dotGrid(54 * sc, 1.6, COL.cream, .1, 0, CX * (1 - sc), CY * (1 - sc));
  // learned — highlighter
  const hp = ep(t, T.ta + .3, .5, E.io3) * (1 - ep(t, T.tb - .3, .25, E.iExpo)), hw = Math.min(980, measure('تعلّمنا', 230) + 60);
  X.fillStyle = COL.gold; X.save(); X.translate(CX + hw / 2, CY - 100); X.rotate(-.025); X.fillRect(-hw * hp, -60, hw * hp, 120); X.restore();
  words('تعلّمنا', CX, CY - 150, 230, { t, t0: T.ta, out: T.tb - .25 });
  // travelled — speed lines
  if (t > T.tb - .1 && t < T.ha + .3) { const lt = t - T.tb; iL.forEach((l, i) => { if (i > 30) return; const x = W + 300 - ((l.o + lt * l.v) % (W + l.l + 600)); X.fillStyle = alpha(l.c, .55 * (1 - pr(t, T.ha - .2, T.ha + .2))); X.fillRect(x, 200 + (l.x / W) * 1500, l.l, l.w + 1); }); }
  words('وسافرنا', CX, CY - 150, 230, { t, t0: T.tb, color: COL.em, out: T.ha - .25, style: 'scale' });
  // horizons: aperture rings
  for (let j = 0; j < 4; j++) { const d = t - T.ha - j * .14; if (d < 0 || d > 1.8) continue; const p = E.o3(d / 1.8); X.globalAlpha = 1 - p; ring(CX, CY - 150, 60 + 1300 * p, 8 - j * 1.5, j % 2 ? COL.cream : COL.gold); X.globalAlpha = 1; }
  if (t > T.ha) { X.save(); X.globalAlpha = ep(t, T.ha + .3, .6); X.lineWidth = 3; X.strokeStyle = alpha(COL.cream, .45); for (let i = 0; i < 90; i++) { const a = i * TAU / 90 + t * .1, r1 = 520, r2 = i % 5 ? 545 : 580; X.beginPath(); X.moveTo(CX + Math.cos(a) * r1, CY - 150 + Math.sin(a) * r1); X.lineTo(CX + Math.cos(a) * r2, CY - 150 + Math.sin(a) * r2); X.stroke(); } X.restore(); }
  // goals: particles converge onto target rings
  const R3 = [240, 165, 92], gp = pr(t, T.hb - .2, T.hb + .7);
  if (t > T.hb - .2) {
    R3.forEach((r, i) => { const p = ep(t, T.hb + i * .1, .8, E.io3); ring(CX, CY - 150, r, i === 0 ? 10 : 7, [COL.gold, COL.cream, COL.em][i], -Math.PI / 2, -Math.PI / 2 + TAU * p); });
    tsP.forEach((q, i) => { const p = E.io3(cl(gp * 1.3 - i * .004)); const a = q.ang + (t - T.hb) * .35 * (q.ring % 2 ? 1 : -1); circle(lerp(q.x, CX + Math.cos(a) * R3[q.ring], p), lerp(q.y, CY - 150 + Math.sin(a) * R3[q.ring], p), q.s, q.c); });
    circle(CX, CY - 150, 40 * ep(t, T.hb + .3, .5, E.oElastic) * (1 + .3 * kick(t)), COL.gold);
  }
  words('اتّسعت آفاقنا', CX, CY + 540, 150, { t, t0: T.ha + .05, stagger: .12 });
  words('وجمعتنا أهدافنا', CX, CY + 720, 130, { t, t0: T.hb, stagger: .12, color: COL.gold });
  X.fillStyle = `rgba(255,255,255,${.45 * (1 - cl((t - T.ha) / .2)) * (t > T.ha ? 1 : 0)})`; X.fillRect(0, 0, W, H);
}

// PLAN — planned · coordinated · split · executed
const ROWS = [[.1, .55, COL.em], [.28, .75, COL.gold], [.05, .42, COL.coral], [.45, .92, COL.em], [.2, .62, COL.navy], [.55, .98, COL.gold]];
function sPlan(t) {
  bg(COL.cream);
  for (let i = 0; i < 15; i++) { const p = ep(t, T.pl + i * .03, 1), y = 180 + i * 116; X.fillStyle = alpha(COL.ink, .07); X.fillRect(W - 90 - (W - 180) * p, y, (W - 180) * p, 2); }
  shapes(t, 31, 10, [COL.ink, COL.em, COL.gold], .45);
  const x0 = 110, x1 = 970;
  ROWS.forEach(([a, b, c], i) => {
    const y = CY - 330 + i * 115, p = ep(t, T.pl + .25 + i * .1, .6, E.o5), bx0 = x0 + a * (x1 - x0), bx1 = x0 + b * (x1 - x0), xs = lerp(bx1, bx0, p);
    X.fillStyle = c; X.beginPath(); X.roundRect(xs, y, bx1 - xs, 64, 32); X.fill();
    const sp = ep(t, T.pl2 + i * .07, .45, E.oBack);
    if (sp > 0) { for (let s = 1; s < 3; s++) { X.fillStyle = COL.cream; X.fillRect(lerp(bx0, bx1, s / 3) - 4 * sp, y - 2, 8 * sp, 68); } circle(bx0 - 44, y + 32, 24 * sp, [COL.coral, COL.em, COL.gold, COL.navy, COL.coral, COL.em][i]); }
    const ck = ep(t, T.pl2 + .5 + i * .1, .3, E.io3); if (ck > 0) { X.save(); X.strokeStyle = COL.cream; X.lineWidth = 9; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(bx1 - 58, y + 32); X.lineTo(bx1 - 58 + 14 * cl(ck * 2), y + 32 + 14 * cl(ck * 2)); if (ck > .5) X.lineTo(bx1 - 44 + 26 * (ck - .5) * 2, y + 46 - 30 * (ck - .5) * 2); X.stroke(); X.restore(); }
  });
  const ph = lerp(x1, x0, (t - T.pl) * .3 % 1); X.fillStyle = COL.coral; X.fillRect(ph, CY - 370, 4, 740); circle(ph + 2, CY - 370, 10, COL.coral);
  words('خطّطنا ونسّقنا', CX, 420, 150, { t, t0: T.pl, stagger: .14, color: COL.ink });
  words('تقاسمنا المهام ونفّذنا', CX, CY + 560, 110, { t, t0: T.pl2, stagger: .1, color: COL.ink });
}

// QUAD — four pairs, four colour hits
const QW = [
  { a: 'معارف', b: 'وخبرات', t: T.qd[0], bg: COL.em, fg: COL.cream, ex: COL.deep },
  { a: 'مهام', b: 'وواجبات', t: T.qd[1], bg: COL.gold, fg: COL.ink, ex: '#9C6B08' },
  { a: 'اختبارات', b: 'ومشروعات', t: T.qd[2], bg: COL.coral, fg: COL.cream, ex: '#8E2311' },
  { a: 'تطبيق', b: 'وجولات', t: T.qd[3], bg: COL.navy, fg: COL.gold, ex: '#000000' },
];
function sQuad(t) {
  let i = 0; QW.forEach((w, j) => { if (t >= w.t) i = j; }); const w = QW[i], lt = t - w.t;
  bg(i ? QW[i - 1].bg : w.bg);
  X.save(); X.beginPath(); X.arc(CX, CY, i ? 1400 * E.o5(cl(lt / .3)) : 2000, 0, TAU); X.clip(); bg(w.bg);
  X.globalAlpha = .18; for (let r = 0; r < 9; r++) marquee(w.a + ' ' + w.b, 130 + r * 215, 140, (r % 2 ? 1 : -1) * (320 + r * 40), w.fg, t, w.t - 2); X.globalAlpha = 1;
  rays(CX, CY, 18, 120, 1500, .05, alpha(w.fg, .12), t * .5 + i);
  const sl = E.oExpo(cl(lt / .38));
  X.save(); X.translate(CX, CY - 80); X.rotate((1 - sl) * (i % 2 ? .1 : -.1)); X.scale(lerp(1.9, 1, sl), lerp(1.9, 1, sl)); X.translate(-CX, -(CY - 80));
  words(w.a, CX, CY - 80, fit(w.a, 940, 300), { t, t0: w.t, stagger: 0, dur: .01, color: w.fg, extrude: alpha(w.ex, .55) });
  X.restore();
  words(w.b, CX, CY + 200, 170, { t, t0: w.t + .15, stagger: 0, dur: .4, color: w.fg, style: 'up' });
  X.save(); X.font = font(34, 600, 'P'); X.textAlign = 'center'; X.fillStyle = alpha(w.fg, .7); X.fillText(AR('0' + (i + 1)) + ' / ' + AR('04'), CX, CY + 380); X.restore();
  confetti(t, w.t, 900 + i, 30, CX, CY - 80, { v: 2800, s: 22, cols: [w.fg, COL.ink, COL.gold, COL.cream].filter(c => c !== w.bg) });
  X.restore();
  X.fillStyle = `rgba(255,255,255,${.5 * (1 - cl(lt / .18))})`; X.fillRect(0, 0, W, H);
}

// LAUNCH — «انطلقنا لصناعة الأثر…»
function sLa(t) {
  bg(COL.deep);
  const lt = t - T.la;
  iL.forEach(l => { const y = H + 200 - ((l.o + lt * l.v) % (H + l.l + 400)); X.fillStyle = alpha(l.c, .5); X.fillRect(l.x, y, l.w, l.l); });
  const up = ep(t, T.la, .7, E.i3), dy = lerp(H - 150, 380, up);
  X.fillStyle = alpha(COL.gold, .8); X.fillRect(CX - 4, dy, 8, H - dy);
  glow(CX, dy, 200, COL.gold, .8); circle(CX, dy, 30, COL.gold);
  if (lt > .7) { const d = lt - .7; for (let j = 0; j < 2; j++) { const p = E.o3(cl((d - j * .1) / 1)); if (p > 0 && p < 1) { X.globalAlpha = 1 - p; ring(CX, 380, 40 + 700 * p, 10 * (1 - p) + 2, j ? COL.cream : COL.gold); X.globalAlpha = 1; } } confetti(t, T.la + .7, 1200, 40, CX, 380, { v: 2400, s: 18 }); }
  X.save(); X.fillStyle = COL.deep; X.globalAlpha = .7; X.fillRect(0, CY - 200, W, 480); X.restore();
  words('انطلقنا', CX, CY - 40, 220, { t, t0: T.la + .05 });
  words('لصناعة الأثر', CX, CY + 170, 140, { t, t0: T.la + .3, stagger: .12, color: COL.gold });
}

// CHART — baseline + the beneficiary's voice
function sCh(t) {
  bg(COL.navy);
  dotGrid(54, 1.4, COL.cream, .06);
  const x0 = 120, x1 = 960, yb = CY + 60, y0 = CY + 260;
  const ax = ep(t, T.bs, .6, E.io3); X.fillStyle = alpha(COL.cream, .35); X.fillRect(x0, CY - 330, 3, (y0 - CY + 330) * ax); X.fillRect(x0, y0, (x1 - x0) * ax, 3);
  const bl = ep(t, T.bs + .2, .8, E.io3); X.save(); X.setLineDash([22, 14]); X.strokeStyle = COL.gold; X.lineWidth = 6; X.beginPath(); X.moveTo(x0, yb); X.lineTo(x0 + (x1 - x0) * bl, yb); X.stroke(); X.restore();
  X.save(); X.globalAlpha = ep(t, T.bs + .7, .4); X.font = font(34, 700); X.textAlign = 'right'; X.direction = 'rtl'; X.fillStyle = COL.gold; X.fillText('خط الأساس', x1, yb - 30); X.restore();
  const data = [0, .1, .06, .2, .16, .3, .28, .45, .4, .58, .66, .8, .95], gp = ep(t, T.vo + .3, 1.1, E.io3);
  if (gp > 0) { const n = Math.max(2, Math.ceil(data.length * gp)); const pts = data.slice(0, n).map((v, i) => [x0 + i / 12 * (x1 - x0), yb - v * 420]); const g = X.createLinearGradient(0, CY - 400, 0, y0); g.addColorStop(0, alpha(COL.em, .5)); g.addColorStop(1, alpha(COL.em, 0)); X.fillStyle = g; X.beginPath(); X.moveTo(pts[0][0], y0); pts.forEach(p => X.lineTo(p[0], p[1])); X.lineTo(pts[pts.length - 1][0], y0); X.fill(); X.strokeStyle = COL.em; X.lineWidth = 8; X.lineJoin = 'round'; X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.stroke(); const h = pts[pts.length - 1]; circle(h[0], h[1], 14, COL.cream); glow(h[0], h[1], 80, COL.em, .6); }
  const vp = ep(t, T.vo, .45, E.oBack);
  if (vp > 0) { X.save(); X.translate(CX, CY + 470); X.scale(vp, vp); X.fillStyle = alpha(COL.cream, .08); X.beginPath(); X.roundRect(-420, -90, 840, 180, 90); X.fill(); for (let j = 0; j < 28; j++) { const hh = 14 + 130 * Math.abs(Math.sin(t * 7 + j * .9)) * (.25 + envAt(t)) * Math.sin(Math.PI * (j + .5) / 28); X.fillStyle = j % 3 ? COL.em : COL.gold; X.beginPath(); X.roundRect(-350 + j * 26, -hh / 2, 12, hh, 6); X.fill(); } X.restore(); }
  words('بالمعرفة رسمنا', CX, 300, 120, { t, t0: T.bs, stagger: .1 });
  words('خطّ الأساس', CX, 440, 120, { t, t0: T.bs + .25, stagger: .1, color: COL.gold });
  words('ومن صوت المستفيد', CX, CY + 660, 96, { t, t0: T.vo, stagger: .08 });
  words('استلهمنا مشاريعنا', CX, CY + 790, 96, { t, t0: T.vo + .3, stagger: .08, color: COL.em });
}

// BUILD — «اجتهدنا معًا…» charge-up into the podium
function sBu(t) {
  bg(COL.ink);
  const b = pr(t, T.bu, T.po), zz = 1 + .12 * E.iExpo(b);
  X.save(); X.translate(CX, CY); X.scale(zz, zz); X.translate(-CX, -CY);
  rays(CX, CY, 40, 260, 1500, .012 + .01 * b, alpha(COL.cream, .06 + .12 * b), (t - T.bu) * (.3 + 2 * b * b));
  for (let s = 0; s < 6; s++) { const p = ep(t, T.bu + s * .16, .35, E.oBack), x = 870 - s * 132, h = (s + 1) * 70 * p; X.fillStyle = s % 2 ? COL.gold : COL.em; X.fillRect(x - 60, CY + 560 - h, 120, h); }
  words('اجتهدنا', CX, CY - 160, 210, { t, t0: T.bu });
  words('معًا', CX, CY + 70, 210, { t, t0: T.bu + .2, color: COL.gold });
  X.restore();
  const bw = 760; X.fillStyle = alpha(COL.cream, .15); X.fillRect(CX - bw / 2, H - 300, bw, 10); X.fillStyle = COL.gold; X.fillRect(CX + bw / 2 - bw * E.i3(b), H - 300, bw * E.i3(b), 10);
  X.fillStyle = `rgba(255,255,255,${.95 * E.i3(pr(t, T.po - .25, T.po))})`; X.fillRect(0, 0, W, H);
}

// PODIUM — honour and pride
function trophy(x, y, s, c) { X.save(); X.translate(x, y); X.scale(s, s); X.fillStyle = c; X.beginPath(); X.moveTo(-110, -120); X.lineTo(110, -120); X.quadraticCurveTo(110, 60, 0, 70); X.quadraticCurveTo(-110, 60, -110, -120); X.fill(); X.fillRect(-18, 60, 36, 70); X.fillRect(-80, 125, 160, 36); X.lineWidth = 20; X.strokeStyle = c; X.beginPath(); X.arc(-120, -60, 50, Math.PI * .5, Math.PI * 1.5); X.stroke(); X.beginPath(); X.arc(120, -60, 50, -Math.PI * .5, Math.PI * .5); X.stroke(); X.restore(); }
function sPo(t) {
  bg(COL.navy);
  const lt = t - T.po, k = kick(t);
  glow(CX, CY - 200, 1000, COL.gold, .2 + .15 * k);
  rays(CX, -200, 16, 200, 2400, .03, alpha(COL.gold, .1), Math.PI / 2 + Math.sin(t * .8) * .2 - .5);
  const pod = [[CX, 430, '١', COL.gold], [CX - 290, 300, '٢', COL.cream], [CX + 290, 220, '٣', COL.em]];
  pod.forEach(([x, h, n, c], i) => { const p = ep(t, T.po + i * .08, .7, E.oBack), hh = h * p; X.fillStyle = c; X.beginPath(); X.roundRect(x - 135, CY + 520 - hh, 270, hh, [18, 18, 0, 0]); X.fill(); if (p > .5) { X.save(); X.font = font(130); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = COL.navy; X.fillText(n, x, CY + 520 - hh + 100); X.restore(); } });
  X.fillStyle = COL.ink; X.fillRect(0, CY + 520, W, 600);
  const tp = ep(t, T.po + .4, .6, E.oBack), mv = ep(t, T.po2, .6, E.ioExpo);
  if (tp > 0) trophy(CX, lerp(CY - 230, CY - 330, mv), tp * lerp(1.25, .8, mv) * (1 + .04 * k), COL.gold);
  confetti(t, T.po, 1300, 80, CX, CY - 200, { v: 3200, s: 22 });
  for (let b2 = 0; b2 < 3; b2++) confetti(t, T.po + .4 + b2 * .6, 1310 + b2, 24, CX, -60, { a0: Math.PI * .3, a1: Math.PI * .7, v: 700, g: 900, life: 3 });
  words('وعلى منصة التكريم', CX, 330, 124, { t, t0: T.po, stagger: .1 });
  words('كان فخرُنا ببعضنا', CX, CY + 690, 100, { t, t0: T.po2, stagger: .08 });
  words('أجمل من الجوائز', CX, CY + 820, 110, { t, t0: T.po2 + .35, stagger: .1, color: COL.gold });
  X.fillStyle = `rgba(255,255,255,${.6 * (1 - cl(lt / .25))})`; X.fillRect(0, 0, W, H);
}

// ANSWER — «نعم… استطعنا معًا.»
function sAn(t) {
  bg(COL.cream);
  dotGrid(48, 1.5, COL.ink, .08);
  words('وهنا عرفنا الإجابة', CX, CY - 60, 120, { t, t0: T.an, stagger: .1, color: COL.ink, out: T.an2 - .2 });
  if (t > T.an2) {
    const lt = t - T.an2;
    X.save(); X.beginPath(); X.arc(CX, CY, 2100 * E.o5(cl(lt / .4)), 0, TAU); X.clip(); bg(COL.em);
    rays(CX, CY - 300, 24, 160, 1600, .035, alpha(COL.cream, .12), lt * .4);
    const ck = ep(t, T.an2 + .1, .5, E.io3); X.save(); X.strokeStyle = COL.cream; X.lineWidth = 46; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); const a = [CX - 200, CY - 330], b = [CX - 60, CY - 190], c = [CX + 230, CY - 500];
    X.moveTo(...a); if (ck < .35) X.lineTo(lerp(a[0], b[0], ck / .35), lerp(a[1], b[1], ck / .35)); else { X.lineTo(...b); X.lineTo(lerp(b[0], c[0], (ck - .35) / .65), lerp(b[1], c[1], (ck - .35) / .65)); } X.stroke(); X.restore();
    const sl = E.oExpo(cl(lt / .35)); X.save(); X.translate(CX, CY + 130); X.scale(lerp(2, 1, sl), lerp(2, 1, sl)); X.translate(-CX, -(CY + 130));
    words('نعم', CX, CY + 130, 300, { t, t0: T.an2, stagger: 0, dur: .01, color: COL.cream, extrude: alpha(COL.deep, .5) }); X.restore();
    words('استطعنا معًا', CX, CY + 420, 150, { t, t0: T.an2 + .3, stagger: .12, color: COL.ink });
    confetti(t, T.an2, 1400, 70, CX, CY, { v: 3000, s: 22 });
    X.restore();
    X.fillStyle = `rgba(255,255,255,${.5 * (1 - cl(lt / .18))})`; X.fillRect(0, 0, W, H);
  }
}

// CAP+ROAD — capacity within · brothers & sisters on the road
const RD = (() => { const a = []; for (let i = 0; i <= 80; i++) { const u = i / 80; a.push([CX + Math.sin(u * 7.5 + .6) * 330 * (1 - u * .35), H - 100 - u * 1250]); } return a; })();
function sCR(t) {
  bg(COL.ink);
  dotGrid(60, 1.6, COL.cream, .07);
  const k = kick(t), sw = ep(t, T.ro - .15, .6, E.ioExpo);
  if (sw < 1) { X.save(); X.globalAlpha = 1 - sw; const c = ep(t, T.ca + .1, .9, E.oElastic); glow(CX, CY - 150, 520, COL.gold, .5 * c); circle(CX, CY - 150, 90 * c * (1 + .2 * k), COL.gold); circle(CX, CY - 150, 40 * c, COL.cream); for (let j = 0; j < 4; j++) { const d = ((t - T.ca) * .9 + j * .25) % 1; X.globalAlpha = (1 - sw) * (1 - d); ring(CX, CY - 150, 120 + d * 500, 6, COL.gold); } X.restore();
    words('اكتشفنا القدرة', CX, CY + 360, 140, { t, t0: T.ca, stagger: .1, out: T.ro - .3 }); words('في أنفسنا', CX, CY + 540, 140, { t, t0: T.ca + .25, stagger: .1, color: COL.gold, out: T.ro - .3 }); }
  if (t > T.ro - .2) {
    const rp = ep(t, T.ro - .1, 1.2, E.io3), n = Math.max(2, Math.ceil(RD.length * rp));
    X.strokeStyle = alpha(COL.cream, .5); X.lineWidth = 4; X.setLineDash([16, 14]); X.beginPath(); RD.slice(0, n).forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.stroke(); X.setLineDash([]);
    const P = []; for (let i = 0; i < 14; i++) { const u = .04 + i * .07, q = RD[Math.floor(u * 80)], s = ep(t, T.ro + .1 + i * .08, .4, E.oBack); if (s <= 0) continue; P.push(q); X.save(); X.translate(q[0], q[1]); X.scale(s * (1 + .15 * k), s * (1 + .15 * k)); personIcon(0, 0, 1.5, [COL.gold, COL.em, COL.cream, COL.coral][i % 4]); X.restore(); }
    X.strokeStyle = alpha(COL.gold, .35); X.lineWidth = 2; X.beginPath(); for (let i = 0; i + 3 < P.length; i += 2) { X.moveTo(...P[i]); X.lineTo(...P[i + 3]); } X.stroke();
    words('ووجدنا إخوةً وأخواتٍ', CX, 330, 120, { t, t0: T.ro, stagger: .09 });
    words('على الطريق', CX, 480, 120, { t, t0: T.ro + .3, stagger: .1, color: COL.gold });
  }
}


// ================= v6 additions =================
const D2R = Math.PI / 180;
const IMG = {}; let TEXD = null, CLDD = null;
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }); }
async function loadAssets() {
  for (const k of ['earth', 'clouds', 'mshHud', 'mshFull', 'pf', 'fouad']) IMG[k] = await loadImg(window.ASSETS[k]);
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d'); g.drawImage(IMG.earth, 0, 0, 2048, 1024); TEXD = g.getImageData(0, 0, 2048, 1024).data;
  const c2 = document.createElement('canvas'); c2.width = 1024; c2.height = 512; const g2 = c2.getContext('2d'); g2.drawImage(IMG.clouds, 0, 0, 1024, 512); CLDD = g2.getImageData(0, 0, 1024, 512).data;
}
// soft fade/blur text (calm reveals)
function soft(str, x, y, size, color, t, t0, dur = 1.2, w = 900, f = 'T') {
  const p = E.o3(pr(t, t0, t0 + dur)); if (p <= 0) return;
  X.save(); X.globalAlpha *= p; X.filter = `blur(${(1 - p) * 18}px)`; X.font = font(size, w, f); X.direction = 'rtl'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = color; X.fillText(str, x, y + (1 - p) * 30); X.restore();
}

// ---------- COVER ----------
function sCover(t) {
  bg(COL.ink);
  dotGrid(60, 1.6, COL.cream, .08 * ep(t, 0, 1.2, E.o3));
  const ox = CX, oy = CY - 250, k = kick(t);
  glow(ox, oy, 460, COL.gold, .18 + .25 * k);
  X.save(); X.setLineDash([3, 16]); ring(ox, oy, 300 * ep(t, .1, 1.4), 3, alpha(COL.cream, .3), t * .5, t * .5 + TAU * ep(t, .1, 1.8, E.io3), 'butt'); X.restore();
  shockwaves(t, ox, oy, .05, 3.6, COL.gold, 460, .6);
  const r0 = E.oElastic(pr(t, .1, 1.1)) * 48 * (1 + .45 * k); circle(ox, oy, r0, COL.gold); circle(ox, oy, r0 * .38, COL.ink);
  const out = 1 - ep(t, 3.05, .4, E.i3);
  X.save(); X.globalAlpha = out;
  X.save(); X.globalAlpha = out * .65 * ep(t, .3, .8); X.font = font(26, 600, 'P'); X.textAlign = 'center'; X.letterSpacing = '6px'; X.fillStyle = COL.cream; X.fillText('COMMUNITY ENGAGEMENT FELLOWSHIP 2026', CX + 3, 300); X.restore();
  reveal('حكايةٌ', CX, CY + 170, 230, t, .7, .9, COL.cream);
  reveal('لم تُروَ بعد', CX, CY + 380, 130, t, 1.25, .9, COL.gold);
  const bl = .45 + .55 * Math.abs(Math.sin(t * 3)); X.save(); X.globalAlpha = out * ep(t, 2.0, .5) * bl; X.font = font(34, 600, 'P'); X.textAlign = 'center'; X.direction = 'rtl'; X.fillStyle = COL.cream; X.fillText('تابعها حتى النهاية', CX, H - 330); X.restore();
  X.restore();
  // cinematic bars open into the story
  const bh = 190 * (1 - ep(t, 3.1, .45, E.ioExpo)); X.fillStyle = '#000'; X.fillRect(0, 0, W, bh); X.fillRect(0, H - bh, W, bh);
}

// ---------- GLOBE (real Earth, true coordinates) ----------
const CITY = [['السعودية', 46.72, 24.69, COL.em, '682', '24.7°N  46.7°E'], ['الأردن', 35.93, 31.95, COL.gold, '400', '31.9°N  35.9°E'], ['الإمارات', 54.37, 24.45, COL.coral, '784', '24.5°N  54.4°E'], ['إندونيسيا', 106.85, -6.21, COL.gold, '360', '6.2°S  106.8°E'], ['بريطانيا', -0.13, 51.51, COL.em, '826', '51.5°N  0.1°W']];
const GCv = document.createElement('canvas'); let GImg = null, GS = 0;
function globeRaster(lon0, lat0, R, t) {
  const S = Math.ceil(R * 2) + 2; const gx = GCv.getContext('2d');
  if (GS !== S) { GCv.width = GCv.height = S; GS = S; GImg = gx.createImageData(S, S); }
  const d = GImg.data; d.fill(0);
  const l0 = lon0 * D2R, p0 = lat0 * D2R, cp = Math.cos(p0), sp = Math.sin(p0), Lx = -.55, Ly = .5, Lz = .67, cs = t * .004, h = S / 2;
  for (let j = 0; j < S; j++) {
    const Y = -(j + .5 - h) / R, Y2 = Y * Y; if (Y2 >= 1) continue;
    for (let i = 0; i < S; i++) {
      const Xx = (i + .5 - h) / R, r2 = Xx * Xx + Y2; if (r2 >= 1) continue; const Z = Math.sqrt(1 - r2);
      const lat = Math.asin(Y * cp + Z * sp), lon = l0 + Math.atan2(Xx, Z * cp - Y * sp);
      let u = lon / TAU + .5; u -= Math.floor(u); const v = .5 - lat / Math.PI;
      const k = ((Math.min(1023, (v * 1024) | 0)) * 2048 + ((u * 2048) | 0)) * 4;
      let r = TEXD[k], g = TEXD[k + 1], b = TEXD[k + 2];
      let uc = u + cs; uc -= Math.floor(uc); const cc = CLDD[((Math.min(511, (v * 512) | 0)) * 1024 + ((uc * 1024) | 0)) * 4] / 255 * .5;
      r += (255 - r) * cc; g += (255 - g) * cc; b += (255 - b) * cc;
      const dif = Math.max(0, Xx * Lx + Y * Ly + Z * Lz), sh = .16 + 1.05 * dif, rim = Math.pow(1 - Z, 3);
      const o = (j * S + i) * 4;
      d[o] = Math.min(255, r * sh + 60 * rim); d[o + 1] = Math.min(255, g * sh + 130 * rim); d[o + 2] = Math.min(255, b * sh + 255 * rim); d[o + 3] = Math.min(255, (1 - Math.sqrt(r2)) * R * 380);
    }
  }
  gx.putImageData(GImg, 0, 0); return GCv;
}
function gproj(lon, lat, lon0, lat0, R, cx, cy, alt = 0) {
  const l = (lon - lon0) * D2R, p = lat * D2R, p0 = lat0 * D2R;
  const x = Math.cos(p) * Math.sin(l), y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l), z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  const s = R * (1 + alt); return [cx + x * s, cy - y * s, z];
}
function camAt(t) {
  const K = [[T.map, 150, -2], [T.ct[0], CITY[0][1], CITY[0][2]], [T.ct[1], CITY[1][1], CITY[1][2]], [T.ct[2], CITY[2][1], CITY[2][2]], [T.ct[3], CITY[3][1], CITY[3][2]], [T.ct[4], CITY[4][1], CITY[4][2]], [T.ct[4] + 1.6, 55, 28]];
  if (t <= K[0][0]) return [K[0][1], K[0][2], 0];
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i], b = K[i + 1]; if (t > b[0] && i < K.length - 2) continue;
    const s = i === 0 ? a[0] : Math.max(a[0], b[0] - 1.05), p = E.ioExpo(pr(t, s, b[0]));
    const dist = Math.hypot(b[1] - a[1], b[2] - a[2]);
    return [lerp(a[1], b[1], p), lerp(a[2], b[2], p), Math.sin(Math.PI * p) * Math.min(1, dist / 60)];
  }
  const L = K[K.length - 1]; return [L[1], L[2], 0];
}
const STARS = (() => { const R = rng(808), a = []; for (let i = 0; i < 220; i++) a.push([R() * W, R() * H, .6 + R() * 1.8, R() * TAU]); return a; })();
function sD5(t) {
  bg('#03050B');
  STARS.forEach(([x, y, r, ph]) => { X.globalAlpha = .35 + .35 * Math.sin(t * 2 + ph); circle(x, y, r, COL.cream); }); X.globalAlpha = 1;
  const [lon0, lat0, fly] = camAt(t), cx = CX, cy = CY + 130;
  const intro = ep(t, T.map, 1.6, E.o5), outro = ep(t, T.ct[4] + .4, 1.2, E.io3);
  const R = 400 * lerp(.3, 1, intro) * (1 - .15 * fly) * lerp(1, .86, outro);
  // atmosphere
  const ag = X.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.35); ag.addColorStop(0, 'rgba(90,160,255,.55)'); ag.addColorStop(.35, 'rgba(60,120,255,.18)'); ag.addColorStop(1, 'rgba(40,90,255,0)'); X.fillStyle = ag; X.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);
  const QG = window.GQ || 1, gi = globeRaster(lon0, lat0, R * QG, t); X.drawImage(gi, cx - gi.width / 2 / QG, cy - gi.height / 2 / QG, gi.width / QG, gi.height / QG);
  // countries (true borders)
  const proj = d3.geoOrthographic().rotate([-lon0, -lat0]).scale(R).translate([cx, cy]).clipAngle(90), path = d3.geoPath(proj, X);
  let act = -1; T.ct.forEach((c, j) => { if (t >= c - .15) act = j; });
  window.COUNTRIES.features.forEach(f => { const j = CITY.findIndex(c => c[4] === String(f.id)); const on = t >= T.ct[j] - .15; if (!on) return; X.beginPath(); path(f); X.fillStyle = alpha(CITY[j][3], j === act ? .6 : .38); X.fill(); X.lineWidth = j === act ? 3 : 1.5; X.strokeStyle = alpha(COL.cream, j === act ? .95 : .6); X.stroke(); });
  // flight arcs along great circles
  for (let j = 1; j < 5; j++) {
    const p = E.ioExpo(pr(t, T.ct[j] - 1.05, T.ct[j])); if (p <= 0) continue;
    const A = CITY[j - 1], B = CITY[j], ip = d3.geoInterpolate([A[1], A[2]], [B[1], B[2]]), dist = d3.geoDistance([A[1], A[2]], [B[1], B[2]]);
    X.lineCap = 'round'; X.lineWidth = 6; X.strokeStyle = COL.gold; X.beginPath(); let pen = false, head = null;
    for (let s = 0; s <= 60; s++) { const u = s / 60 * p, q = ip(u), alt = .22 * Math.sin(Math.PI * u) * Math.min(1, dist / 1.2), [x, y, z] = gproj(q[0], q[1], lon0, lat0, R, cx, cy, alt); const vis = z > -.05 - alt * 1.2; if (vis) { pen ? X.lineTo(x, y) : X.moveTo(x, y); pen = true; head = [x, y]; } else pen = false; }
    X.stroke(); if (p < 1 && head) { glow(head[0], head[1], 70, COL.gold, .9); circle(head[0], head[1], 9, COL.cream); }
  }
  // pins + labels at true coordinates
  CITY.forEach(([n, lon, lat, c, id, ll], j) => {
    const s = ep(t, T.ct[j], .5, E.oBack); if (s <= 0) return; const [x, y, z] = gproj(lon, lat, lon0, lat0, R, cx, cy); if (z < .05) return;
    const a = cl(z * 3), d = (t - T.ct[j]) % 1.3; X.save(); X.globalAlpha = a;
    X.globalAlpha = a * (1 - d / 1.3); ring(x, y, 12 + d * 70, 3, c); X.globalAlpha = a;
    circle(x, y, 13 * s, COL.cream); circle(x, y, 7 * s, c);
    const ov = t > T.ct[4] + .4, OFF = [[0, 74], [-110, -58], [110, -40], [0, -64], [0, -64]];
    if (j === act || ov) {
      X.save(); X.translate(x + (ov ? OFF[j][0] : 0), y + (ov ? OFF[j][1] : -64)); X.scale(s * (ov ? .8 : 1), s * (ov ? .8 : 1)); X.font = font(44, 700); X.direction = 'rtl'; const w = X.measureText(n).width + 44;
      X.fillStyle = 'rgba(7,9,15,.78)'; X.beginPath(); X.roundRect(-w / 2, -34, w, 64, 32); X.fill(); X.strokeStyle = c; X.lineWidth = 2; X.stroke();
      X.fillStyle = COL.cream; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(n, 0, 0);
      if (j === act && !ov) { X.font = font(22, 600, 'P'); X.direction = 'ltr'; X.fillStyle = alpha(COL.cream, .7); X.fillText(ll, 0, 52); }
      X.restore();
    }
    X.restore();
  });
  words('بين السعودية والأردن والإمارات', CX, 310, 86, { t, times: [T.map + .2, T.ct[0], T.ct[1], T.ct[2]], dur: .45 });
  words('وإندونيسيا وبريطانيا', CX, 430, 86, { t, times: [T.ct[3], T.ct[4]], dur: .45, color: COL.gold });
}

// person icon (road companions)
function personIcon(x, y, s, c) { circle(x, y - 17 * s, 11 * s, c); X.fillStyle = c; X.beginPath(); X.roundRect(x - 17 * s, y - 2 * s, 34 * s, 24 * s, [17 * s, 17 * s, 5 * s, 5 * s]); X.fill(); }

// ---------- NEW: the question ----------
function sQ(t) {
  bg(COL.ink);
  const OR = '#F7942B', PFG = '#E0B868', PFT = '#8FB9C1';   // «حكايتك» orange · PF sand gold · PF slate teal (lifted for dark ground)
  const br = 1 + .03 * pr(t, T.qs, T.fin);
  jS.forEach(s => { const y = ((s.y - t * s.v * .5) % H + H) % H; X.globalAlpha = .2 + .25 * Math.sin(t * 1.5 + s.ph); circle(s.x, y, s.s, s.c); }); X.globalAlpha = 1;
  glow(CX, CY, 620, COL.gold, .08 + .06 * Math.sin((t - T.qs) * 1.8));
  X.save(); X.translate(CX, CY); X.scale(br, br); X.translate(-CX, -CY);
  const ln = ep(t, T.qs + .4, 1.6, E.io3); X.fillStyle = alpha(COL.gold, .8); X.fillRect(CX - 260 * ln, CY + 20, 520 * ln, 2);
  soft('وأنت', CX, CY - 150, 190, COL.cream, t, T.qs + .4, 1.3);
  const ws = ['متى', 'تبدأ', 'حكايتك؟'], size = 120, Y = CY + 190;
  X.save(); X.font = font(size); X.direction = 'rtl'; const ms = ws.map(w => X.measureText(w).width), mh = X.measureText('حكايتك').width; X.restore();
  const sp = size * .27, tot = ms.reduce((a, b) => a + b, 0) + sp * 2; let x = CX + tot / 2, hx = 0;
  const dim = 1 - .5 * ep(t, T.qs + 3.65, .5, E.io3);
  ws.forEach((w, i) => { const wx = x - ms[i] / 2; x -= ms[i] + sp; if (i === 2) { hx = wx; X.save(); X.globalAlpha = dim; } soft(w, wx, Y, size, i === 2 ? OR : COL.cream, t, T.qs + 1.5 + i * .45, 1.0); if (i === 2) X.restore(); });
  // «زمالتك» — larger, centred in the space beneath the line
  const xr = hx + ms[2] / 2;
  soft('زمالتك', CX, CY + 440, 165, PFG, t, T.qs + 4.15, .9);
  // diagonal strike: top-right → bottom-left, drawn like a pen stroke
  const st = ep(t, T.qs + 3.5, .55, E.io3);
  if (st > 0) { const x0 = xr + 16, y0 = Y - 64, x1 = xr - mh - 16, y1 = Y + 52; X.save(); X.strokeStyle = PFT; X.lineWidth = 11; X.lineCap = 'round'; X.shadowColor = alpha(PFT, .6); X.shadowBlur = 14; X.beginPath(); X.moveTo(x0, y0); X.lineTo(lerp(x0, x1, st), lerp(y0, y1, st)); X.stroke(); X.restore(); }
  const ul = ep(t, T.qs + 4.85, .5, E.io3); if (ul > 0) { X.fillStyle = PFT; X.fillRect(CX + 110 - 220 * ul, CY + 555, 220 * ul, 4); }
  X.restore();
  X.fillStyle = `rgba(0,0,0,${.85 * E.i3(pr(t, T.fin - .45, T.fin))})`; X.fillRect(0, 0, W, H);
}

// ---- finale helpers ----
const SHC = document.createElement('canvas'); SHC.width = 900; SHC.height = 200; const SHX = SHC.getContext('2d');
function shineText(str, x, y, size, t, t0) {   // «النسخة الثانية» with a calm travelling shine
  const p = ep(t, t0, .8, E.o3); if (p <= 0) return;
  SHX.setTransform(1, 0, 0, 1, 0, 0); SHX.clearRect(0, 0, 900, 200); SHX.font = font(size, 900); SHX.direction = 'rtl'; SHX.textAlign = 'center'; SHX.textBaseline = 'middle';
  const g = SHX.createLinearGradient(0, 100 - size * .6, 0, 100 + size * .6); g.addColorStop(0, '#F6DA9B'); g.addColorStop(.55, '#E0B868'); g.addColorStop(1, '#C9974A'); SHX.fillStyle = g; SHX.fillText(str, 450, 100);
  const cyc = ((t - t0 - .6) % 3.6 + 3.6) % 3.6, sx = lerp(-200, 1100, cyc / 1.4);
  if (t > t0 + .6 && cyc < 1.4) { SHX.globalCompositeOperation = 'source-atop'; const s = SHX.createLinearGradient(sx - 90, 0, sx + 90, 0); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(.5, 'rgba(255,250,235,.85)'); s.addColorStop(1, 'rgba(255,255,255,0)'); SHX.fillStyle = s; SHX.fillRect(0, 0, 900, 200); SHX.globalCompositeOperation = 'source-over'; }
  const w = SHX.measureText(str).width;
  X.save(); X.globalAlpha = p; X.drawImage(SHC, x - 450, y - 100 + (1 - p) * 20); X.restore();
  [-1, 1].forEach(d => circle(x + d * (w / 2 + 34), y, 6 * p, '#E0B868'));
}
const TOUCH = new Path2D('M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z');
const CALL = new Path2D('M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z');
// hand tap loop: approach → press → pulse → return (2.4s)
function handTap(x, y, t, t0, s = 4) {
  const a = ep(t, t0, .5); if (a <= 0) return; const f = ((t - t0) % 2.4) / 2.4;
  const app = f < .35 ? E.io3(f / .35) : f < .8 ? 1 : 1 - E.io3((f - .8) / .2), press = f > .35 && f < .5 ? Math.sin((f - .35) / .15 * Math.PI) : 0;
  const ox = lerp(34, 0, app), oy = lerp(30, 0, app), sc = s * (1 - .1 * press);
  const tipX = x + ox + (11.5 - 12) * sc, tipY = y + oy + (4 - 12) * sc;
  if (f > .42 && f < .9) { const q = (f - .42) / .48; X.save(); X.globalAlpha = a * (1 - q) * .9; ring(tipX, tipY, 10 + 46 * q, 4, '#E0B868'); X.restore(); }
  X.save(); X.globalAlpha = a; X.translate(x + ox, y + oy); X.scale(sc, sc); X.translate(-12, -12); X.shadowColor = 'rgba(0,0,0,.45)'; X.shadowBlur = 6; X.fillStyle = COL.cream; X.fill(TOUCH); X.restore();
}
const CTA_Y = 1712;
function ctaGeom() { X.save(); X.font = font(48, 900); X.direction = 'rtl'; const w1 = X.measureText('ابدأ زمالتك الآن').width; X.restore(); const w = w1 + 140; return { w, h: 128, x: CX - w / 2, y: CTA_Y - 64 }; }
// closing credits — tiny footer, fades in once everything has settled
const CREDITS = [['إنشاد', 'مجدي عبدالغني'], ['كلمات', 'أم حمد المري'], ['إعداد', 'نجد المري & سليمان البيشي']];
function credits(t, t0) {
  if (window.WEB) return;   // the web page renders these as real links
  const a = E.io3(pr(t, t0, t0 + 1.6)); if (a <= 0) return;
  const Y = 1862, maxW = 1000, gap = 46;
  let size = 25; const LW = s => font(s, 500), NW = s => font(s, 700);
  const measure = s => { X.font = LW(s); const sep = X.measureText('  |  ').width; return CREDITS.map(([l, n]) => { X.font = LW(s); const lw = X.measureText(l).width; X.font = NW(s); const nw = X.measureText(n).width; return { lw, nw, sep, w: lw + sep + nw }; }); };
  X.save(); X.direction = 'rtl'; X.textBaseline = 'middle'; X.textAlign = 'right';
  let m = measure(size), tot = m.reduce((q, v) => q + v.w, 0) + gap * 2;
  if (tot > maxW) { size *= maxW / tot; m = measure(size); tot = m.reduce((q, v) => q + v.w, 0) + gap * 2; }
  let x = CX + tot / 2;
  CREDITS.forEach(([l, n], i) => {
    const g = m[i];
    X.font = LW(size); X.fillStyle = `rgba(244,239,228,${.5 * a})`; X.fillText(l, x, Y);
    X.fillStyle = `rgba(242,178,51,${.55 * a})`; X.fillText('  |  ', x - g.lw, Y);
    X.font = NW(size); X.fillStyle = `rgba(244,239,228,${.82 * a})`; X.fillText(n, x - g.lw - g.sep, Y);
    x -= g.w + gap;
  });
  X.restore();
}
function sFin(t) {
  bg(COL.navy);
  const lt = t - T.fin, k = kick(t);
  dotGrid(54, 1.4, COL.cream, .06);
  glow(CX, 420, 760, COL.gold, .1 + .06 * k); glow(CX, 1075, 560, COL.em, .12);
  rays(CX, 420, 24, 300, 1600, .02, alpha(COL.cream, .04), lt * .08);
  // TOP block — logo · النسخة الثانية · ومشاركة تصنع الأثر (moved up together)
  const dp = E.o5(pr(t, T.fin, T.fin + 1.9)), lw = 700, lh = lw * IMG.mshFull.height / IMG.mshFull.width, LY = 380, ly = lerp(-lh - 60, LY - lh / 2, dp);
  X.save(); X.globalAlpha = cl(dp * 2.2); X.translate(CX, ly + lh / 2); X.scale(lerp(1.06, 1, dp), lerp(1.06, 1, dp)); X.drawImage(IMG.mshFull, -lw / 2, -lh / 2, lw, lh); X.restore();
  if (lt > 1.4 && lt < 3) { const p = E.o3(pr(t, T.fin + 1.4, T.fin + 3)); X.globalAlpha = 1 - p; ring(CX, LY, 280 + 480 * p, 3, COL.gold); X.globalAlpha = 1; }
  shineText('النسخة الثانية', CX, 668, 64, t, T.fin + 1.4);
  words('ومشاركة تصنع الأثر', CX, 778, 90, { t, t0: T.fin + 1.7, stagger: .12, color: COL.cream });
  // MIDDLE — Dr. Fouad Mardad
  const pp = ep(t, T.fin + 2.2, 1.0, E.o5), PR = 180, PY = 1085;
  if (pp > 0) {
    glow(CX, PY, PR * 2, COL.gold, .16 * pp);
    X.save(); X.globalAlpha = pp; X.setLineDash([2, 12]); ring(CX, PY, PR + 34, 2, alpha(COL.cream, .45), lt * .15, lt * .15 + TAU, 'butt'); X.setLineDash([]);
    ring(CX, PY, PR + 12, 5, COL.gold, -Math.PI / 2, -Math.PI / 2 + TAU * ep(t, T.fin + 2.4, 1.2, E.io3));
    const s = lerp(1.08, 1, pp); X.beginPath(); X.arc(CX, PY, PR, 0, TAU); X.clip(); X.drawImage(IMG.fouad, CX - PR * s, PY - PR * s, PR * 2 * s, PR * 2 * s);
    const vg = X.createRadialGradient(CX, PY, PR * .7, CX, PY, PR); vg.addColorStop(0, 'rgba(11,19,34,0)'); vg.addColorStop(1, 'rgba(11,19,34,.35)'); X.fillStyle = vg; X.fillRect(CX - PR, PY - PR, PR * 2, PR * 2);
    X.restore();
    soft('د. فؤاد مرداد', CX, PY + PR + 62, 46, COL.cream, t, T.fin + 2.7, .8, 700);
  }
  // BOTTOM block — PF identity · CTA · phone
  const fp = ep(t, T.fin + 3.0, .8, E.o5), ph = 118, pw = ph * IMG.pf.width / IMG.pf.height;
  X.save(); X.globalAlpha = fp; X.drawImage(IMG.pf, CX - pw / 2, 1437 + (1 - fp) * 24, pw, ph); X.restore();
  words('شركة الزمالات المهنية', CX, 1597, 54, { t, t0: T.fin + 3.2, stagger: .08, color: COL.cream, w: 700 });
  if (!window.WEB) {
    const cp = ep(t, T.fin + 3.6, .6, E.oBack), g = ctaGeom();
    if (cp > 0) {
      X.save(); X.translate(CX, CTA_Y); X.scale(cp, cp); X.translate(-CX, -CTA_Y);
      X.fillStyle = alpha(COL.gold, .16); X.beginPath(); X.roundRect(g.x, g.y, g.w, g.h, 64); X.fill(); X.strokeStyle = COL.gold; X.lineWidth = 3; X.stroke();
      const cyc = ((t - T.fin - 4.4) % 3.2 + 3.2) % 3.2; if (t > T.fin + 4.4 && cyc < 1.1) { X.save(); X.beginPath(); X.roundRect(g.x, g.y, g.w, g.h, 64); X.clip(); const sx = lerp(g.x - 120, g.x + g.w + 120, cyc / 1.1), s = X.createLinearGradient(sx - 80, 0, sx + 80, 0); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(.5, 'rgba(255,236,190,.35)'); s.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = s; X.fillRect(g.x, g.y, g.w, g.h); X.restore(); }
      X.font = font(48, 900); X.direction = 'rtl'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = COL.gold; X.fillText('ابدأ زمالتك الآن', CX, CTA_Y - 18);
      X.font = font(32, 700); X.fillStyle = COL.cream; X.fillText('سجّل هنا', CX, CTA_Y + 32);
      X.restore();
      handTap(g.x - 40, CTA_Y + 44, t, T.fin + 4.2);
    }
  }
  credits(t, T.fin + 5.2);
}

// ---------- NEW: finale with the approved logo ----------

// ================= TIMELINE =================
const SC = [
  { s: 0, draw: sCover },
  { s: 3.51, draw: sA, tr: 'cut' },
  { s: T.c3, draw: sB, tr: 'circle', td: .9, o: [CX, CY - 250], edge: COL.gold },
  { s: T.c4, draw: sB2, tr: 'circle', td: .75, o: [CX, CY], edge: COL.cream },
  { s: T.c5, draw: sH, tr: 'slabs', td: .7, edge: COL.gold },
  { s: T.m8, draw: sC, tr: 'circle', td: .8, o: [CX, CY - 210], edge: COL.em },
  { s: T.map, draw: sD5, tr: 'diag', td: .8, edge: COL.em },
  { s: T.ta, draw: sTS, tr: 'push', td: .75 },
  { s: T.pl, draw: sPlan, tr: 'page', td: .8, edge: COL.gold },
  { s: T.e1, draw: sE, tr: 'push', td: .75 },
  { s: T.e3, draw: sQuad, tr: 'cut' },
  { s: T.la, draw: sLa, tr: 'circle', td: .75, o: [CX, H + 100], edge: COL.gold },
  { s: T.bs, draw: sCh, tr: 'slabsUp', td: .7, edge: COL.em },
  { s: T.d1, draw: sF, tr: 'cut' },
  { s: T.g1, draw: sG, tr: 'cut' },
  { s: T.i1, draw: sI, tr: 'slabsUp', td: .7, edge: COL.em },
  { s: T.bu, draw: sBu, tr: 'push', td: .65 },
  { s: T.po, draw: sPo, tr: 'cut' },
  { s: T.an, draw: sAn, tr: 'circle', td: .8, o: [CX, CY], edge: COL.gold },
  { s: T.ca, draw: sCR, tr: 'diag', td: .75, edge: COL.gold },
  { s: T.j1, draw: sJ, tr: 'push', td: .7 },
  { s: T.k1, draw: sK, tr: 'page', td: .75, edge: COL.gold },
  { s: T.qs, draw: sQ, tr: 'circle', td: 1.1, o: [CX, CY], edge: alpha(COL.gold, .6) },
  { s: T.fin, draw: sFin, tr: 'cut' },
];

function trShape(sc, p) {
  X.beginPath();
  if (sc.tr === 'circle') X.arc(sc.o[0], sc.o[1], Math.max(.1, p * 2300), 0, TAU);
  else if (sc.tr === 'slabs' || sc.tr === 'slabsUp') { const n = 5; for (let i = 0; i < n; i++) { const q = E.ioExpo(cl(p * 1.6 - i * .15)); if (sc.tr === 'slabs') X.rect(i * W / n - 1, 0, W / n + 2, H * q); else X.rect(i * W / n - 1, H - H * q, W / n + 2, H * q); } }
  else if (sc.tr === 'diag') { const x = W + 500 - (W + 1000) * p; X.moveTo(x, -10); X.lineTo(W + 10, -10); X.lineTo(W + 10, H + 10); X.lineTo(x + 500, H + 10); X.closePath(); }
  else if (sc.tr === 'page') { const x = W - W * p; X.rect(x, -10, W - x + 10, H + 20); }
}
function trEdge(sc, p) {
  if (p <= 0 || p >= 1) return;
  X.fillStyle = sc.edge; X.strokeStyle = sc.edge;
  if (sc.tr === 'circle') ring(sc.o[0], sc.o[1], p * 2300, 26 * (1 - p) + 4, sc.edge);
  else if (sc.tr === 'slabs' || sc.tr === 'slabsUp') { const n = 5; for (let i = 0; i < n; i++) { const q = E.ioExpo(cl(p * 1.6 - i * .15)); if (q <= 0 || q >= 1) continue; const y = sc.tr === 'slabs' ? H * q : H - H * q; X.fillRect(i * W / n, y - 18, W / n, 36); } }
  else if (sc.tr === 'diag') { const x = W + 500 - (W + 1000) * p; X.beginPath(); X.moveTo(x - 40, -10); X.lineTo(x, -10); X.lineTo(x + 500, H + 10); X.lineTo(x + 460, H + 10); X.fill(); }
  else if (sc.tr === 'page') { const x = W - W * p; const g = X.createLinearGradient(x - 160, 0, x, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); X.fillStyle = g; X.fillRect(x - 160, 0, 160, H); X.fillStyle = sc.edge; X.fillRect(x - 6, 0, 12, H); }
}
function drawScene(i, t) {
  const sc = SC[i];
  if (i === 0 || !sc.tr || sc.tr === 'cut' || t >= sc.s + sc.td) { sc.draw(t); return; }
  const p = pr(t, sc.s, sc.s + sc.td);
  if (sc.tr === 'push') { const e = E.ioExpo(p); X.save(); X.translate(0, -H * e); SC[i - 1].draw(t); X.restore(); X.save(); X.translate(0, H * (1 - e)); sc.draw(t); X.restore(); return; }
  const e = sc.tr === 'slabs' || sc.tr === 'slabsUp' ? p : E.ioExpo(p);
  SC[i - 1].draw(t); X.save(); trShape(sc, e); X.clip(); sc.draw(t); X.restore(); trEdge(sc, e);
}

// ---------- overlays ----------
const noise = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256), R = rng(3); for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; } g.putImageData(d, 0, 0); return c; })();
let noisePat = null;
function shake(t) {
  let a = 0;
  for (const [tt, amp] of [[T.d1, 30], [T.d2, 24], [T.d3, 30], [T.land, 26], [T.j2, 22], [T.e2, 10], [T.c4, 8], [T.c5, 14], [T.ha, 22], [T.po, 20], [T.an2, 18], [T.la, 10], ...T.qd.map(q => [q, 24]), ...T.ct.map(q => [q, 6])]) if (t >= tt) a += amp * Math.exp(-(t - tt) * 7);
  if ((t > T.d1 && t < T.g1) || (t > T.qd[0] && t < T.la)) a += 8 * kick(t, .3);
  if (t > T.e2 && t < T.e3) a += 7 * E.i3(pr(t, T.e2, T.e3));
  if (t > T.bu && t < T.po) a += 7 * E.i3(pr(t, T.bu, T.po));
  return [a * Math.sin(t * 97.3) * Math.cos(t * 31.1), a * Math.cos(t * 83.7) * Math.sin(t * 27.9), a * .0009 * Math.sin(t * 61)];
}
function hud(t) {
  const a = ep(t, 3.4, .8) * (1 - ep(t, T.fin - .4, .4));
  if (a <= 0) return;
  X.save(); X.globalCompositeOperation = 'difference'; X.globalAlpha = a * .85; X.fillStyle = '#fff'; X.strokeStyle = '#fff'; X.lineWidth = 3;
  const m = 56, l = 44;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { X.beginPath(); X.moveTo(x, y + sy * l); X.lineTo(x, y); X.lineTo(x + sx * l, y); X.stroke(); });
  // top-left: the Mosharaka mark
  const lw = 170, lh = lw * IMG.mshHud.height / IMG.mshHud.width; X.drawImage(IMG.mshHud, m + 22, m - 4, lw, lh);
  // top-right: programme name
  X.font = font(24, 600, 'P'); X.textBaseline = 'middle'; X.textAlign = 'right'; X.letterSpacing = '2px'; X.fillText('Community Engagement Fellowship 2026', W - m - 22, m + 22);
  // bottom-left: slide counter
  let idx = 0; SC.forEach((c, i) => { if (t >= c.s) idx = i; });
  X.font = font(28, 600, 'P'); X.textAlign = 'left'; X.letterSpacing = '3px'; X.fillText(`${String(idx).padStart(2, '0')} / ${SC.length - 1}`, m + 64, H - m - 70);
  // bottom-right: timecode
  const f = Math.floor(t * 60), s = Math.floor(t), tc = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`;
  X.textAlign = 'right'; X.fillText(tc, W - m - 64, H - m - 70); X.letterSpacing = '0px';
  const pw = W - 2 * (m + 64), px = m + 64, py = H - m - 22; X.globalAlpha = a * .3; X.fillRect(px, py, pw, 3); X.globalAlpha = a * .9; const pp = t / 118; X.fillRect(px + pw * (1 - pp), py - 1, pw * pp, 5);
  SC.forEach(c => { X.fillRect(px + pw * (1 - c.s / 118) - 1, py - 8, 3, 19); });
  X.restore();
}
function render(t) {
  X.setTransform(Q, 0, 0, Q, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over';
  X.fillStyle = COL.ink; X.fillRect(0, 0, W, H);
  const [sx, sy, sr] = shake(t);
  X.save(); X.translate(CX + sx, CY + sy); X.rotate(sr); X.translate(-CX, -CY);
  let i = 0; SC.forEach((c, j) => { if (t >= c.s) i = j; });
  drawScene(i, t);
  X.restore();
  // vignette + grain
  const g = X.createRadialGradient(CX, CY, H * .3, CX, CY, H * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  if (!noisePat) noisePat = X.createPattern(noise, 'repeat');
  const R = rng(Math.floor(t * 60) + 1); X.save(); X.translate(-R() * 256, -R() * 256); X.fillStyle = noisePat; X.fillRect(0, 0, W + 256, H + 256); X.restore();
  hud(t);
}
window.render = render;
window.ready = (async () => { const fs = ['900 100px T', '700 100px T', '500 100px T', '600 40px P']; for (const f of fs) { await document.fonts.load(f, 'بدأنا abc 123'); } await document.fonts.ready; await loadAssets(); render(0); return true; })();