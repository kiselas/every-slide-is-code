/*! deck-kit runtime · every slide is code · MIT
 * The whole deck is a pure function of (slide, step, t): no animation state is
 * accumulated between frames. That gives exact rest frames for PDF/PPTX, a
 * frame-exact video timeline, and a live mode that can jump anywhere.
 * Reference: 01-runtime.md */
(function () {
'use strict';

/* ───────────────────────── math ───────────────────────── */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const seg = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));
const ease = {
  linear: p => p,
  inQuad: p => p * p,
  outQuad: p => 1 - (1 - p) * (1 - p),
  inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2,
  inCubic: p => p * p * p,
  outCubic: p => 1 - (1 - p) ** 3,
  inOutCubic: p => (p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  outQuart: p => 1 - (1 - p) ** 4,
  inOutQuart: p => (p < .5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  inExpo: p => (p <= 0 ? 0 : 2 ** (10 * p - 10)),
  outExpo: p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inOutExpo: p => (p <= 0 ? 0 : p >= 1 ? 1 : p < .5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
  outBack: (p, s = 1.70158) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,
};
// Closed-form damped spring: deterministic, no integration. zeta < 1 overshoots.
function spring(t, zeta = .5, omega = 16) {
  if (t <= 0) return 0;
  if (!isFinite(t)) return 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
}
function rng(seed = 1) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ───────────────────────── config ───────────────────────── */
const deckEl = document.querySelector('.deck');
if (!deckEl) throw new Error('deck-kit: no .deck element');
const W = +deckEl.dataset.w || 1920, H = +deckEl.dataset.h || 1080;
const Q = new URLSearchParams(location.search);
const MODE = Q.has('render') ? 'render' : Q.has('presenter') ? 'presenter' : Q.has('embed') ? 'embed' : 'live';
const reduced = MODE === 'live' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DIM = +(deckEl.dataset.dim || .28);
const html = document.documentElement;
html.classList.add('dk-mode-' + MODE);
deckEl.style.width = W + 'px';
deckEl.style.height = H + 'px';
const CLOCK0 = performance.now();
const now = () => (performance.now() - CLOCK0) / 1000;

const hooks = {}, ANIMS = {}, TRANSITIONS = {};
let stageSpec = null;

/* ───────────────────────── build animations ─────────────────────────
 * f(el, e, info) returns {opacity, transform, filter, clip}; e is eased 0..1.
 * info = {raw, lt, leaving, b}. Anims may also mutate the element directly. */
function anim(name, spec) { ANIMS[name] = spec; }
const tr = (x, y) => `translate(${x}px, ${y}px)`;
anim('fade',  { dur: .5, curve: ease.outCubic, f: (el, e) => ({ opacity: e }) });
anim('rise',  { dur: .7, curve: ease.outExpo,  f: (el, e) => ({ opacity: e, transform: tr(0, (1 - e) * 44) }) });
anim('drop',  { dur: .7, curve: ease.outExpo,  f: (el, e) => ({ opacity: e, transform: tr(0, (e - 1) * 44) }) });
anim('left',  { dur: .7, curve: ease.outExpo,  f: (el, e) => ({ opacity: e, transform: tr((e - 1) * 64, 0) }) });
anim('right', { dur: .7, curve: ease.outExpo,  f: (el, e) => ({ opacity: e, transform: tr((1 - e) * 64, 0) }) });
anim('scale', { dur: .7, curve: ease.outExpo,  f: (el, e) => ({ opacity: e, transform: `scale(${.88 + .12 * e})` }) });
anim('pop', { dur: .9, curve: ease.outBack, f(el, e, i) {
  const s = i.leaving || !isFinite(i.lt) ? e : spring(Math.max(0, i.lt), .42, 15);
  return { opacity: clamp(i.raw * 5), transform: `scale(${Math.max(0, s)})` };
} });
anim('blur', { dur: .8, curve: ease.outCubic, f: (el, e) => ({
  opacity: e, filter: e < 1 ? `blur(${(1 - e) * 18}px)` : '', transform: tr(0, (1 - e) * 14) }) });
anim('wipe',      { dur: .8, curve: ease.inOutCubic, f: (el, e) => ({ clip: `inset(0 ${(1 - e) * 100}% 0 0)` }) });
anim('wipe-left', { dur: .8, curve: ease.inOutCubic, f: (el, e) => ({ clip: `inset(0 0 0 ${(1 - e) * 100}%)` }) });
anim('wipe-up',   { dur: .8, curve: ease.inOutCubic, f: (el, e) => ({ clip: `inset(${(1 - e) * 100}% 0 0 0)` }) });
anim('wipe-down', { dur: .8, curve: ease.inOutCubic, f: (el, e) => ({ clip: `inset(0 0 ${(1 - e) * 100}% 0)` }) });
anim('none', { dur: 0, f: (el, e) => ({ opacity: e > 0 ? 1 : 0 }) });
// Line of text rises out from under an invisible edge. The runtime wraps the content.
anim('mask', { dur: .9, curve: ease.outExpo,
  init(el) {
    const inner = document.createElement('span');
    inner.className = 'dk-mask-i';
    while (el.firstChild) inner.append(el.firstChild);
    el.append(inner);
    return inner;
  },
  f(el, e, i) { i.b.data.style.transform = `translateY(${(1 - e) * 115}%)`; return { clip: 'inset(-40% -8% 0 -8%)' }; } });
// SVG strokes draw themselves. Works on a geometry element or on a group.
anim('draw', { dur: 1.2, curve: ease.inOutCubic,
  init(el) {
    const g = el instanceof SVGGeometryElement ? [el] : [...el.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect')];
    for (const x of g) { x.setAttribute('pathLength', '1'); x.style.strokeDasharray = '1 1'; }
    return g;
  },
  f(el, e, i) {
    const done = i.raw >= 1;   // finished strokes drop the dash so print and PDF see a plain line
    for (const x of i.b.data) { x.style.strokeDasharray = done ? '' : '1 1'; x.style.strokeDashoffset = done ? '' : String(1 - e); }
    return { opacity: i.raw > 0 ? 1 : 0 };
  } });
// Number counts up to the value written in the markup, so the rest frame is the authored text.
anim('count', { dur: 1.6, curve: ease.outExpo,
  init(el) {
    const m = el.textContent.trim().match(/^([^\d\-−]*)([-−]?[\d,]*\.?\d+)([\s\S]*)$/);
    if (!m) return null;
    return { pre: m[1], suf: m[3], to: parseFloat(m[2].replace(/,/g, '').replace('−', '-')), dec: (m[2].split('.')[1] || '').length,
      comma: m[2].includes(','), from: parseFloat(String(el.dataset.from || 0).replace('−', '-')), last: '' };
  },
  f(el, e, i) {
    const c = i.b.data;
    if (c) {
      const s = c.pre + fmtNum(lerp(c.from, c.to, e), c.dec, c.comma) + c.suf;
      if (s !== c.last) { el.textContent = s; c.last = s; }
    }
    return { opacity: i.raw > 0 || el.dataset.from != null ? 1 : 0 };
  } });
anim('type', { dur: el => Math.max(.3, el.textContent.length * .035), curve: ease.linear,
  init: el => ({ text: el.textContent, last: -1 }),
  f(el, e, i) {
    const d = i.b.data, n = Math.round(e * d.text.length);
    if (n !== d.last) { el.textContent = d.text.slice(0, n); d.last = n; }
    el.classList.toggle('dk-caret', e > 0 && e < 1);
    return { opacity: i.raw > 0 ? 1 : 0 };
  } });
// Emphasis on an element that is already visible: a marker sweeps behind the text.
anim('highlight', { dur: .6, curve: ease.inOutCubic,
  init(el) { el.classList.add('dk-highlight'); },
  f(el, e) { el.style.backgroundSize = `${e * 100}% 100%`; return {}; } });
anim('strike', { dur: .5, curve: ease.inOutCubic,
  init(el) { el.classList.add('dk-strike'); },
  f(el, e) { el.style.backgroundSize = `${e * 100}% 100%`; return {}; } });

/* ───────────────────────── transitions ─────────────────────────
 * fn(A, B, p, o): A = outgoing layer, B = incoming layer, p = 0..1.
 * o.sign is +1 going forward, -1 going back. Layers are reset every frame. */
function transition(name, spec) { TRANSITIONS[name] = spec; }
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const dirOf = (o, def) => { const v = DIRS[o.dir] || DIRS[def]; return [v[0] * o.sign, v[1] * o.sign]; };
const origin = o => o.origin || [W / 2, H / 2];

transition('none', { dur: 0, fn: A => { A.style.visibility = 'hidden'; } });
transition('fade', { dur: .6, fn(A, B, p) {
  const e = ease.inOutSine(p); A.style.opacity = 1 - e; B.style.opacity = e; } });
transition('dip', { dur: .9, fn(A, B, p, o) {       // through a colour: black = time passes
  (p < .5 ? B : A).style.visibility = 'hidden';
  o.veil.style.background = o.color || '#000';
  o.veil.style.opacity = 1 - Math.abs(p * 2 - 1); } });
transition('push', { dur: .8, dir: 'left', fn(A, B, p, o) {
  const e = ease.inOutQuart(p), [dx, dy] = dirOf(o, 'left');
  A.style.transform = tr(dx * e * W, dy * e * H);
  B.style.transform = tr(-dx * (1 - e) * W, -dy * (1 - e) * H); } });
transition('cover', { dur: .8, dir: 'left', opaque: true, fn(A, B, p, o) {
  const e = ease.inOutQuart(p), [dx, dy] = dirOf(o, 'left');
  if (o.sign > 0) {           // B slides over A
    B.style.transform = tr(-dx * (1 - e) * W, -dy * (1 - e) * H);
    B.style.boxShadow = '0 0 80px rgba(0,0,0,.25)';
    A.style.transform = tr(dx * e * W * .25, dy * e * H * .25);
    A.style.filter = `brightness(${1 - .25 * e})`;
  } else {                     // going back: the top card slides away
    A.style.zIndex = 2;
    A.style.transform = tr(dx * e * W, dy * e * H);
    A.style.boxShadow = '0 0 80px rgba(0,0,0,.25)';
    B.style.transform = tr(-dx * (1 - e) * W * .25, -dy * (1 - e) * H * .25);
    B.style.filter = `brightness(${.75 + .25 * e})`;
  } } });
transition('zoom', { dur: .9, fn(A, B, p, o) {      // zoom-through: dive into a point of A
  const [x, y] = origin(o), fwd = o.sign > 0;
  A.style.transformOrigin = B.style.transformOrigin = `${x}px ${y}px`;
  const a = seg(p, 0, .6), b = seg(p, .35, 1);
  A.style.transform = `scale(${fwd ? 1 + ease.inExpo(a) * 2.2 : 1 - ease.inCubic(a) * .3})`;
  A.style.opacity = 1 - ease.inCubic(a);
  A.style.filter = a > 0 ? `blur(${a * 10}px)` : '';
  B.style.transform = `scale(${fwd ? .72 + .28 * ease.outExpo(b) : 3.2 - 2.2 * ease.outExpo(b)})`;
  B.style.opacity = ease.outCubic(b); } });
transition('iris', { dur: .9, fn(A, B, p, o) {
  const [x, y] = origin(o), R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 2;
  const e = ease.inOutCubic(p);
  if (o.sign > 0) {
    const r = e * R;
    B.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
    A.style.maskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 1}px)`;
  } else {
    const r = (1 - e) * R;
    A.style.zIndex = 2;
    A.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
    B.style.maskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 1}px)`;
  } } });
transition('wipe', { dur: .9, dir: 'right', fn(A, B, p, o) {
  const ang = { right: 90, left: 270, down: 180, up: 0 }[o.dir || 'right'] + (o.sign < 0 ? 180 : 0);
  const f = 14, a = ease.inOutCubic(p) * (100 + f) - f, b = a + f;
  B.style.maskImage = `linear-gradient(${ang}deg, #000 ${a}%, transparent ${b}%)`;
  A.style.maskImage = `linear-gradient(${ang}deg, transparent ${a}%, #000 ${b}%)`; } });
transition('blinds', { dur: 1, fn(A, B, p, o) {
  const n = +(o.data.count || 12), w = W / n, e = ease.inOutCubic(p) * w;
  B.style.maskImage = `repeating-linear-gradient(90deg, #000 0 ${e}px, transparent ${e}px ${w}px)`;
  A.style.maskImage = `repeating-linear-gradient(90deg, transparent 0 ${e}px, #000 ${e}px ${w}px)`; } });
transition('cube', { dur: 1.1, opaque: true, fn(A, B, p, o) {
  const e = ease.inOutCubic(p), s = o.sign, P = `perspective(${W * 1.8}px) translateZ(${-W / 2 - Math.sin(Math.PI * e) * 260}px)`;
  A.style.transform = `${P} rotateY(${-90 * e * s}deg) translateZ(${W / 2}px)`;
  B.style.transform = `${P} rotateY(${90 * (1 - e) * s}deg) translateZ(${W / 2}px)`;
  A.style.filter = `brightness(${1 - .45 * e})`;
  B.style.filter = `brightness(${.55 + .45 * e})`; } });
transition('flip', { dur: 1, opaque: true, fn(A, B, p, o) {
  const e = ease.inOutCubic(p), s = o.sign, P = `perspective(${W * 2}px) translateZ(${-Math.sin(Math.PI * e) * 420}px)`;
  A.style.transform = `${P} rotateY(${-180 * e * s}deg)`;
  B.style.transform = `${P} rotateY(${180 * (1 - e) * s}deg)`; } });
// The outgoing slide is torn off along a zigzag edge and lifted away.
let _teeth;
const teeth = () => _teeth || (_teeth = (() => {
  const pts = ['0 0', `${W}px 0`], tw = 26, th = 16;
  for (let x = W, k = 0; x >= 0; x -= tw / 2, k++) pts.push(`${Math.max(0, x)}px ${H - (k % 2 ? th : 0)}px`);
  return `polygon(${pts.join(',')})`;
})());
transition('tear', { dur: 1, opaque: true, fn(A, B, p, o) {
  const top = o.sign > 0 ? A : B, under = o.sign > 0 ? B : A;
  const e = o.sign > 0 ? ease.inCubic(p) : 1 - ease.outCubic(p);
  top.style.zIndex = 2;
  top.style.clipPath = e > 0 ? teeth() : '';
  top.style.transformOrigin = '100% 100%';
  top.style.transform = `translateY(${-e * H * 1.08}px) rotate(${-5 * e}deg)`;
  top.style.boxShadow = e > 0 ? '0 30px 60px rgba(0,0,0,.18)' : '';
  under.style.transform = `scale(${.965 + .035 * e})`;
  under.style.filter = `brightness(${.93 + .07 * e})`; } });
// Noise dissolve through an SVG filter; the two layers get complementary alpha.
transition('dissolve', { dur: 1.1, fn(A, B, p) {
  const th = lerp(.22, .78, ease.inOutSine(p)), S = 14;
  dsv.inA.setAttribute('slope', -S); dsv.inA.setAttribute('intercept', S * th);
  dsv.outA.setAttribute('slope', S); dsv.outA.setAttribute('intercept', 1 - S * th);
  B.style.filter = 'url(#dk-dsv-in)'; A.style.filter = 'url(#dk-dsv-out)'; } });
// Magic move: elements with the same data-morph key fly from their place on A to their place on B.
transition('morph', { dur: 1, fn(A, B, p, o) {
  const e = ease.inOutCubic(p);
  A.style.opacity = 1 - ease.outCubic(seg(p, 0, .45));
  B.style.opacity = ease.inOutSine(seg(p, .35, 1));
  for (const m of o.morph || []) {
    const { a, b, ca, cb } = m, x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e), w = lerp(a.w, b.w, e), h = lerp(a.h, b.h, e);
    ca.style.transform = `${tr(x, y)} scale(${w / a.w}, ${h / a.h})`;
    cb.style.transform = `${tr(x, y)} scale(${w / b.w}, ${h / b.h})`;
    const f = seg(e, .15, .85);
    ca.style.opacity = 1 - f; cb.style.opacity = f;
  } } });
// Camera flies across one continuous world; slides sit at data-pos.
transition('camera', { dur: 1.3, fn(A, B, p, o) {
  const e = ease.inOutCubic(p), a = o.from.pos, b = o.to.pos;
  const dist = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(a.s, b.s);
  const cs = lerp(a.s, b.s, e) * (1 + Math.min(1.6, dist * .32) * (o.lift ?? 1) * Math.sin(Math.PI * e));
  const cx = lerp(a.x + a.s / 2, b.x + b.s / 2, e), cy = lerp(a.y + a.s / 2, b.y + b.s / 2, e);
  const cam = { x: cx - cs / 2, y: cy - cs / 2, s: cs };
  o.cam = cam;
  for (const [L, s] of [[A, o.from], [B, o.to]]) {
    L.style.transformOrigin = '0 0';
    L.style.transform = `${tr((s.pos.x - cam.x) / cam.s * W, (s.pos.y - cam.y) / cam.s * H)} scale(${s.pos.s / cam.s})`;
  } } });

/* ───────────────────────── helpers for charts & diagrams ───────────────────────── */
const SVGNS = 'http://www.w3.org/2000/svg';
// Presentation attributes lose to any CSS rule (`.chart text { fill }` beats fill="red").
// Values passed to the helper are explicit per-element choices, so they go to inline style and win.
const AS_STYLE = new Set(['fill', 'stroke', 'stroke-width', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'fill-opacity', 'stroke-opacity', 'letter-spacing']);
function mk(ns, tag, attrs = {}, parent) {
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (ns && AS_STYLE.has(k)) el.style.setProperty(k, typeof v === 'number' && /size|width|spacing/.test(k) ? v + 'px' : String(v));
    else el.setAttribute(k, v);
  }
  if (parent) parent.append(el);
  return el;
}
const svg = (tag, attrs, parent) => mk(SVGNS, tag, attrs, parent);
const el = (tag, attrs, parent) => mk(null, tag, attrs, parent);
function niceStep(span, n) {
  const raw = span / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
}
function ticks(a, b, n = 5) {
  const st = niceStep(b - a, n), out = [];
  for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-9; v += st) out.push(+v.toFixed(10));
  return out;
}
function scaleLinear(domain, range) {
  let [d0, d1] = domain; const [r0, r1] = range;
  const f = v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);
  f.invert = y => d0 + (y - r0) / (r1 - r0 || 1) * (d1 - d0);
  f.ticks = (n = 5) => ticks(d0, d1, n);
  f.nice = (n = 5) => { const st = niceStep(d1 - d0, n); d0 = Math.floor(d0 / st) * st; d1 = Math.ceil(d1 / st) * st; return f; };
  f.domain = () => [d0, d1]; f.range = () => [r0, r1];
  return f;
}
function scaleBand(keys, range, { padding = .2, outer = padding / 2 } = {}) {
  const [r0, r1] = range, n = keys.length, step = (r1 - r0) / (n - padding + outer * 2);
  const f = k => r0 + step * (outer + keys.indexOf(k));
  f.bw = step * (1 - padding); f.step = step; f.keys = keys;
  return f;
}
// Monotone cubic (Fritsch–Carlson): passes through points, never overshoots.
function linePath(pts, curve = 'monotone') {
  if (!pts.length) return '';
  if (curve === 'linear' || pts.length < 3) return 'M' + pts.map(p => `${p[0]},${p[1]}`).join('L');
  if (curve === 'step') return 'M' + pts.map((p, i) => i ? `H${p[0]}V${p[1]}` : `${p[0]},${p[1]}`).join('');
  const n = pts.length, dx = [], m = [], tg = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  tg[0] = m[0]; tg[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${x0 + h},${y0 + tg[i] * h} ${x1 - h},${y1 - tg[i + 1] * h} ${x1},${y1}`;
  }
  return d;
}
const areaPath = (pts, y0, curve) => pts.length ? `${linePath(pts, curve)}L${pts[pts.length - 1][0]},${y0}L${pts[0][0]},${y0}Z` : '';
// Angles in radians, 0 at twelve o'clock, clockwise.
function arcPath(cx, cy, r0, r1, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  const P = (r, a) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`, big = a1 - a0 > Math.PI ? 1 : 0;
  if (a1 <= a0) return '';
  return r0 > 0
    ? `M${P(r1, a0)}A${r1},${r1} 0 ${big} 1 ${P(r1, a1)}L${P(r0, a1)}A${r0},${r0} 0 ${big} 0 ${P(r0, a0)}Z`
    : `M${cx},${cy}L${P(r1, a0)}A${r1},${r1} 0 ${big} 1 ${P(r1, a1)}Z`;
}
function fmtNum(v, dec = 0, comma = true) {
  const s = Math.abs(v).toFixed(dec), [i, f] = s.split('.');
  const ii = comma ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i;
  return (v < 0 && +s !== 0 ? '−' : '') + ii + (f ? '.' + f : '');
}
function fmt(v, { dec = 0, prefix = '', suffix = '', compact = false, comma = true } = {}) {
  if (compact) {
    const a = Math.abs(v), [d, u] = a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
    return prefix + fmtNum(v / d, dec, comma) + u + suffix;
  }
  return prefix + fmtNum(v, dec, comma) + suffix;
}
function hex(c) { const n = parseInt(c.slice(1), 16); return c.length === 4 ? [(n >> 8 & 15) * 17, (n >> 4 & 15) * 17, (n & 15) * 17] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(c1, c2, p) { const a = hex(c1), b = hex(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], p))).join(',')})`; }
const _len = new WeakMap();
function pointAt(path, p) {
  let L = _len.get(path); if (L == null) { L = path.getTotalLength(); _len.set(path, L); }
  const q = path.getPointAtLength(clamp(p) * L); return { x: q.x, y: q.y };
}

/* ───────────────────────── fit text ─────────────────────────
 * data-fit       shrink until the content fits the element's box (it needs a width, and a height to fit both)
 * data-fit="2"   shrink until the text takes at most 2 lines
 * Runs once after fonts load; never below data-fit-min (default .6) of the authored size. */
function fitText(n) {
  const cs = getComputedStyle(n), size0 = parseFloat(cs.fontSize), lines = +n.dataset.fit || 0;
  const min = size0 * num(n.dataset.fitMin, .6);
  const lh = sz => { const v = parseFloat(getComputedStyle(n).lineHeight); return isFinite(v) ? v : sz * 1.2; };
  const fits = sz => {
    if (n.scrollWidth > n.clientWidth + 1) return false;
    if (lines) return n.offsetHeight <= lh(sz) * lines + 2;
    return n.scrollHeight <= n.clientHeight + 1;   // auto-height boxes always pass
  };
  let sz = size0;
  while (!fits(sz) && sz > min) { sz = Math.max(min, sz - Math.max(1, sz * .03)); n.style.fontSize = sz + 'px'; }
}

/* ───────────────────────── slides & builds ───────────────────────── */
let slides = [];
const num = (v, d) => (v == null || v === '' ? d : +v);

function parsePos(s, prev) {
  if (s) { const [x, y, sc] = s.trim().split(/[\s,]+/).map(Number); return { x: x || 0, y: y || 0, s: sc || 1 }; }
  return prev ? { x: prev.x + prev.s * 1.12, y: prev.y, s: prev.s } : { x: 0, y: 0, s: 1 };
}

const textOf = n => (n ? n.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '') : '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function collect() {
  const secs = [...deckEl.querySelectorAll(':scope > section.slide')];
  let prevPos = null;
  slides = secs.map((sec, i) => {
    const layer = document.createElement('div');
    layer.className = 'dk-layer';
    sec.before(layer); layer.append(sec);
    const d = sec.dataset, notesEl = sec.querySelector(':scope > .notes');
    const pos = parsePos(d.pos, prevPos); prevPos = pos;
    const hold = (d.hold || deckEl.dataset.hold || '3').trim().split(/[\s,]+/).map(Number);
    return {
      i, el: sec, layer, id: sec.id || `s${i + 1}`, d, pos, hold,
      title: d.title || textOf(sec.querySelector('h1,h2,h3')) || `Slide ${i + 1}`,
      notes: notesEl ? notesEl.innerHTML.trim() : '',
      notesText: notesEl ? notesEl.textContent.replace(/\s+/g, ' ').trim() : '',
      hook: hooks[sec.id] || {}, builds: [], steps: 0, entry: 0, api: null,
    };
  });
}

function parseBuilds(s) {
  const seen = new Set(), list = [];
  const push = (node, group, extra) => {
    if (seen.has(node)) return; seen.add(node);
    const d = node.dataset, g = group ? group.dataset : {};
    const name = d.anim || g.anim || (group || d.step != null ? 'rise' : 'fade'), A = ANIMS[name] || ANIMS.rise;
    const b = {
      el: node, A, name,
      noIn: !group && d.step == null && d.anim == null,
      step: num(d.step ?? g.step, 0),
      out: d.out != null || g.out != null ? num(d.out ?? g.out) : null,
      dim: d.dim != null || g.dim != null ? num(d.dim ?? g.dim) : null,
      delay: num(d.delay ?? g.delay, 0) + extra,
      outDelay: num(d.outDelay ?? g.outDelay, 0),
      curve: ease[d.ease || g.ease] || A.curve || ease.outCubic,
      cache: {},
    };
    b.dur = num(d.dur ?? g.dur, typeof A.dur === 'function' ? A.dur(node) : A.dur);
    b.data = A.init ? A.init(node, b) : null;
    list.push(b);
  };
  for (const node of s.el.querySelectorAll('[data-step],[data-anim],[data-stagger],[data-dim],[data-out]')) {
    if (node.closest('.notes')) continue;
    if (node.dataset.stagger != null) {
      const gap = num(node.dataset.stagger, .08) || .08;
      let kids = [...node.children];
      if (node.dataset.order === 'reverse') kids.reverse();
      if (node.dataset.order === 'center') { const c = (kids.length - 1) / 2; kids = kids.map((k, j) => [k, Math.abs(j - c)]).sort((a, b) => a[1] - b[1]).map(x => x[0]); }
      if (node.dataset.order === 'random') { const r = rng(kids.length * 31 + 7); kids = kids.map(k => [k, r()]).sort((a, b) => a[1] - b[1]).map(x => x[0]); }
      seen.add(node);
      kids.forEach((k, j) => push(k, node, j * gap));
    } else if (!seen.has(node)) push(node, null, 0);
  }
  s.builds = list;
  let m = s.hook.steps || 0;
  for (const b of list) m = Math.max(m, b.step, b.out ?? 0, b.dim ?? 0);
  s.steps = m;
}

// Local time since the build for `step` started: +Inf once passed, -Inf while in the future.
function stepLT(n, st, delay) {
  if (n < st.step) return Infinity;
  if (n > st.step) return -Infinity;
  return st.t - delay - (n === 0 ? st.entry : 0);
}

function setStyle(b, k, v) { if (b.cache[k] !== v) { b.cache[k] = v; b.el.style[k] = v; } }

function applyBuild(b, st) {
  const e0 = st.step === 0 ? st.entry : 0;
  if (!b.noIn && b.step === st.step) st._end = Math.max(st._end, e0 + b.delay + b.dur);
  if (b.out === st.step) st._end = Math.max(st._end, e0 + b.outDelay + b.dur);
  if (b.dim === st.step) st._end = Math.max(st._end, e0 + .5);
  const lt = b.noIn ? Infinity : stepLT(b.step, st, b.delay);
  let raw = seg(lt, 0, b.dur), leaving = false;
  if (b.out != null) {
    const ro = seg(stepLT(b.out, st, b.outDelay), 0, b.dur);
    if (ro > 0) { leaving = true; raw = Math.min(raw, 1 - ro); }
  }
  const e = b.curve(raw);
  const r = b.A.f(b.el, e, { raw, lt, leaving, b }) || {};
  let op = clamp(r.opacity ?? 1);
  if (b.dim != null) op *= lerp(1, DIM, ease.outCubic(seg(stepLT(b.dim, st, 0), 0, .5)));
  setStyle(b, 'opacity', op === 1 ? '' : String(+op.toFixed(4)));
  setStyle(b, 'visibility', op <= 0 ? 'hidden' : '');
  setStyle(b, 'transform', r.transform && raw < 1 ? r.transform : '');
  setStyle(b, 'filter', r.filter || '');
  setStyle(b, 'clipPath', r.clip && (raw < 1 || b.name === 'mask') ? r.clip : '');
}

// st records what the frame depended on: the latest end time it asked about (_end) and
// whether it read the global clock (_usesT). A slide past _end that never read T is idle.
function mkState(s, step, t, T, rest) {
  const e0 = n => (n === 0 ? s.entry : 0);
  const st = {
    slide: s, i: s.i, id: s.id, step, t, rest, last: s.steps, entry: s.entry, W, H, _end: 0, _usesT: false,
    get T() { st._usesT = true; return T; },
    // progress 0..1 of a build that starts at `step n` (+delay) and lasts dur
    p: (n, delay = 0, dur = .8, curve = ease.outCubic) => {
      if (n === step) st._end = Math.max(st._end, e0(n) + delay + dur);
      return curve(seg(stepLT(n, st, delay), 0, dur));
    },
    // raw local seconds since step n began (Infinity if passed); counts as active for hook.active seconds
    since: n => { if (n === step) st._end = Math.max(st._end, e0(n) + (s.hook.active ?? 4)); return stepLT(n, st, 0); },
    at: n => step >= n,
    // ambient motion; frozen in rest frames so PDF pages are canonical
    life: (period = 4, amp = 1, phase = 0) => { st._usesT = true; return rest ? 0 : Math.sin(T / period * Math.PI * 2 + phase) * amp; },
  };
  return st;
}

function renderSlide(s, step, t, T, rest = false) {
  const st = mkState(s, step, t, T, rest);
  for (const b of s.builds) applyBuild(b, st);
  if (s.hook.frame) s.hook.frame(s.el, st);
  return st;
}

/* ───────────────────────── stage (persistent background) ───────────────────────── */
let stageCv = null, stageCtx = null, stageQ = 1;
function setupStage() {
  if (!stageSpec) return;
  stageCv = document.createElement('canvas');
  stageCv.className = 'dk-stage';
  deckEl.prepend(stageCv);
  resizeStage();
  stageCtx = stageCv.getContext('2d');
  stageSpec.setup?.(stageCtx, { W, H, deck: deckEl });
}
function resizeStage() {
  if (!stageCv) return false;
  const q = MODE === 'live' ? Math.min(2, (devicePixelRatio || 1) * fitK) : 1;
  const w = Math.round(W * q), h = Math.round(H * q);
  if (stageCv.width === w && stageCv.height === h) return false;
  stageQ = q; stageCv.width = w; stageCv.height = h;
  return true;
}
let stageKey = '', stageUsesT = false, stagePos = null;
// Redraws only when the camera moved, the canvas was resized, or the drawing reads the clock.
// Returns true while the stage animates (it then keeps the deck from going idle).
function drawStage(info) {
  if (!stageCv) return false;
  const resized = resizeStage(), c = info.cam;
  const key = `${c.x},${c.y},${c.s},${info.rest},${info.i}`;
  if (!resized && !stageUsesT && key === stageKey) return false;
  stageKey = key;
  stagePos = stagePos || slides.map(s => s.pos);
  const T = info.T; let used = false;
  const S2 = { W, H, slides: stagePos, ...info, get T() { used = true; return T; } };
  stageCtx.setTransform(stageQ, 0, 0, stageQ, 0, 0);
  stageSpec.draw(stageCtx, S2);
  stageUsesT = used && !info.rest;
  return stageUsesT;
}

/* ───────────────────────── overlays ───────────────────────── */
let veil, blackout, morphLayer, progressEl, numberEl, help, dsv = {};
function overlays() {
  morphLayer = el('div', { class: 'dk-morph' }, deckEl);
  veil = el('div', { class: 'dk-veil' }, deckEl);
  blackout = el('div', { class: 'dk-blackout' }, deckEl);
  const chrome = (deckEl.dataset.chrome || '').split(/[\s,]+/);
  if (chrome.includes('progress')) progressEl = el('div', { class: 'dk-progress' }, deckEl);
  if (chrome.includes('number')) numberEl = el('div', { class: 'dk-number' }, deckEl);
  const f = (id, slope, icpt) => `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".0085" numOctaves="4" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="a"/>
    <feComponentTransfer in="a" result="m"><feFuncA type="linear" slope="${slope}" intercept="${icpt}"/></feComponentTransfer>
    <feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`;
  const defs = el('div', { class: 'dk-defs', html: `<svg width="0" height="0" aria-hidden="true">${f('dk-dsv-in', 0, 0)}${f('dk-dsv-out', 0, 1)}</svg>` }, document.body);
  dsv.inA = defs.querySelector('#dk-dsv-in feFuncA');
  dsv.outA = defs.querySelector('#dk-dsv-out feFuncA');
}

/* ───────────────────────── state machine ───────────────────────── */
const S = { i: 0, step: 0, t0: 0, settled: false, tr: null };
let deckBg = '';

function trCfg(s, sign) {
  const d = s.d, dd = deckEl.dataset;
  let type = d.transition || dd.transition || 'fade';
  if (reduced && type !== 'none') type = 'fade';
  const spec = TRANSITIONS[type] || TRANSITIONS.fade;
  const o = (d.origin || dd.origin || '').split(/[\s,]+/).map(Number);
  return {
    type, spec, sign,
    dur: reduced ? .3 : num(d.transitionDur ?? dd.transitionDur, spec.dur),
    dir: d.dir || dd.dir || spec.dir,
    origin: o.length === 2 && o.every(isFinite) ? o : null,
    color: d.color || dd.color, lift: num(d.lift ?? dd.lift, 1), data: d,
  };
}

function layerOn(s, on) { s.layer.classList.toggle('is-on', on); }
function resetLayer(s) { s.layer.style.cssText = ''; }

function measure(s, node) {
  const k = fitKLive(), base = deckEl.getBoundingClientRect(), r = node.getBoundingClientRect();
  return { x: (r.left - base.left) / k, y: (r.top - base.top) / k, w: Math.max(1, r.width / k), h: Math.max(1, r.height / k) };
}
const INHERIT = ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform',
  'textAlign', 'whiteSpace', 'fontVariantNumeric', 'fontFeatureSettings', 'fill', 'stroke', 'wordSpacing'];
function cloneFor(node, r) {
  const c = node.cloneNode(true), cs = getComputedStyle(node);
  for (const k of INHERIT) c.style[k] = cs[k];
  c.removeAttribute('id');
  Object.assign(c.style, { position: 'absolute', left: '0', top: '0', margin: '0', width: r.w + 'px', height: r.h + 'px',
    transformOrigin: '0 0', boxSizing: 'border-box', visibility: 'visible', opacity: '1' });
  morphLayer.append(c);
  return c;
}

function beginTransition(from, to, sign, T) {
  const A = slides[from.i], B = slides[to.i];
  const cfg = trCfg(sign > 0 ? B : A, sign);
  const tr = { from, to, A, B, cfg, start: T, dur: cfg.dur, morph: null };
  resetLayer(A); resetLayer(B); layerOn(A, true); layerOn(B, true);
  if (cfg.type === 'morph') {
    renderSlide(A, from.step, Infinity, T); renderSlide(B, to.step, Infinity, T);
    tr.morph = [];
    for (const nb of B.el.querySelectorAll('[data-morph]')) {
      const na = A.el.querySelector(`[data-morph="${CSS.escape(nb.dataset.morph)}"]`);
      if (!na) continue;
      const a = measure(A, na), b = measure(B, nb);
      tr.morph.push({ na, nb, a, b, ca: cloneFor(na, a), cb: cloneFor(nb, b) });
      na.style.visibility = nb.style.visibility = 'hidden';
    }
  }
  return tr;
}
function endTransition(tr) {
  resetLayer(tr.A); resetLayer(tr.B);
  if (tr.A !== tr.B) layerOn(tr.A, false);
  veil.style.cssText = '';
  if (tr.morph) { for (const m of tr.morph) { m.na.style.visibility = m.nb.style.visibility = ''; m.ca.remove(); m.cb.remove(); } }
}
function renderTransition(tr, p, T) {
  const { A, B, cfg } = tr;
  resetLayer(A); resetLayer(B); veil.style.cssText = '';
  if (cfg.spec.opaque) A.layer.style.background = B.layer.style.background = `var(--dk-card, ${deckBg})`;
  A.layer.style.willChange = B.layer.style.willChange = 'transform, opacity';
  B.layer.style.zIndex = 1;
  const o = { ...cfg, veil, from: A, to: B, morph: tr.morph, cam: null };
  const fs = tr.from, ts = tr.to;
  renderSlide(A, fs.step, fs.settled ? Infinity : T - fs.t0, T);
  renderSlide(B, ts.step, ts.settled ? Infinity : T - tr.start, T);
  cfg.spec.fn(A.layer, B.layer, clamp(p), o);
  return o;
}
function camOf(s) { return { x: s.pos.x, y: s.pos.y, s: s.pos.s }; }
function lerpCam(a, b, e) { return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), s: lerp(a.s, b.s, e) }; }

// One frame for the live clock. Once every build of the step has finished and nothing reads
// the clock, the slide is idle and frames are skipped until the state changes.
const perf = { rendered: 0, skipped: 0, ms: 0, worst: 0 };
function frame(T) {
  if (S.tr) {
    const p = (T - S.tr.start) / Math.max(1e-6, S.tr.dur);
    if (p >= 1) { endTransition(S.tr); S.tr = null; S.dirty = true; }
    else {
      const o = renderTransition(S.tr, p, T);
      drawStage({ T, rest: false, i: lerp(S.tr.A.i, S.tr.B.i, ease.inOutCubic(p)), p, from: S.tr.A.i, to: S.tr.B.i,
        cam: o.cam || camOf(S.tr.B) });
      chrome();
      perf.rendered++;
      return;
    }
  }
  const key = `${S.i}.${S.step}.${S.settled}.${S.t0}`;
  if (S.idle && S.idleKey === key && !S.dirty) { perf.skipped++; return; }
  const s = slides[S.i], t = S.settled ? Infinity : T - S.t0;
  const st = renderSlide(s, S.step, t, T);
  const stageLive = drawStage({ T, rest: false, i: S.i, p: 1, from: S.i, to: S.i, cam: camOf(s) });
  chrome();
  S.idle = !st._usesT && !stageLive && t >= st._end;
  S.idleKey = key; S.dirty = false;
  perf.rendered++;
}
function chrome() {
  const n = slides.length, s = slides[S.i];
  if (progressEl) progressEl.style.transform = `scaleX(${n > 1 ? (S.i + (s.steps ? S.step / (s.steps + 1) : 0)) / (n - 1) : 1})`;
  if (numberEl) { const txt = `${S.i + 1} / ${n}`; if (numberEl.textContent !== txt) numberEl.textContent = txt; }
}

/* ───────────────────────── navigation ───────────────────────── */
const listeners = [];
function changed(action) {
  if (MODE === 'live' || MODE === 'presenter') {
    const h = `#${S.i + 1}${S.step ? '.' + S.step : ''}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  for (const f of listeners) f({ i: S.i, step: S.step, action });
  hideHint(); uiUpdate();
}
function finishTr() { if (S.tr) { endTransition(S.tr); S.tr = null; } }
function toSlide(i, step, sign, settled) {
  const T = now();
  const from = { i: S.i, step: S.step, t0: S.t0, settled: S.settled };
  finishTr();
  if (i === S.i || MODE === 'presenter') { if (i !== S.i) { layerOn(slides[S.i], false); layerOn(slides[i], true); } S.i = i; S.step = step; S.t0 = T; S.settled = settled; return; }
  S.tr = beginTransition(from, { i, step, settled }, sign, T);
  S.i = i; S.step = step; S.t0 = T; S.settled = settled;
}
function next() {
  const s = slides[S.i];
  if (S.tr) finishTr();
  if (S.step < s.steps) { S.step++; S.t0 = now(); S.settled = false; }
  else if (S.i < slides.length - 1) toSlide(S.i + 1, 0, 1, false);
  else { toast('End of the deck · Home to start again'); return; }
  changed('next');
}
function prev() {
  if (S.tr) finishTr();
  if (S.step > 0) { S.step--; S.t0 = now(); S.settled = true; }
  else if (S.i > 0) toSlide(S.i - 1, slides[S.i - 1].steps, -1, true);
  else { toast('First slide'); return; }
  changed('prev');
}
function goto(i, step = 0, { animate = false } = {}) {
  i = clamp(i | 0, 0, slides.length - 1); step = clamp(step | 0, 0, slides[i].steps);
  if (animate && i !== S.i) toSlide(i, step, i > S.i ? 1 : -1, step > 0);
  else {
    finishTr();
    for (const s of slides) if (s.i !== i) layerOn(s, false);
    layerOn(slides[i], true);
    S.i = i; S.step = step; S.t0 = now(); S.settled = step > 0;
  }
  changed('goto');
}
// Follow another window: animate if the target is one move away, otherwise cut.
function sync(i, step) {
  if (i === S.i && step === S.step) return;
  const s = slides[S.i];
  const isNext = (i === S.i && step === S.step + 1) || (i === S.i + 1 && step === 0 && S.step === s.steps);
  const isPrev = (i === S.i && step === S.step - 1) || (i === S.i - 1 && S.step === 0 && step === slides[i].steps);
  if (isNext) next(); else if (isPrev) prev(); else goto(i, step);
}
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return null;
  const [a, b] = h.split('.');
  let i = /^\d+$/.test(a) ? +a - 1 : slides.findIndex(s => s.id === a);
  if (i < 0) return null;
  return { i, step: +b || 0 };
}

/* ───────────────────────── fit to window ───────────────────────── */
let fitK = 1;
const fitKLive = () => (MODE === 'render' ? 1 : fitK);
function fit() {
  if (MODE === 'render') { deckEl.style.transform = ''; fitK = 1; return; }
  const vw = innerWidth, vh = innerHeight;
  fitK = Math.min(vw / W, vh / H);
  deckEl.style.transform = `translate(${(vw - W * fitK) / 2}px, ${(vh - H * fitK) / 2}px) scale(${fitK})`;
  S.dirty = true;
}

/* ───────────────────────── overview & help ───────────────────────── */
let overview = false, ovSel = 0;
function toggleOverview(on = !overview) {
  overview = on;
  html.classList.toggle('dk-overview', on);
  if (on) {
    finishTr();
    const n = slides.length, cols = Math.ceil(Math.sqrt(n * 1.25)), rows = Math.ceil(n / cols), g = 28;
    const cap = 15 / fitKLive(), gy = g + cap * 1.9, top = 44 / fitKLive();   // caption height and a hint row, in canvas px
    const z = Math.min((W - g * (cols + 1)) / (cols * W), (H - top - gy * rows) / (rows * H));
    const ox = (W - (cols * W * z + (cols - 1) * g)) / 2, oy = top + (H - top - (rows * H * z + (rows - 1) * gy + cap * 1.9)) / 2;
    ovSel = S.i;
    for (const s of slides) {
      layerOn(s, true);
      const c = s.i % cols, r = Math.floor(s.i / cols), x = ox + c * (W * z + g), y = oy + r * (H * z + gy);
      renderSlide(s, s.steps, Infinity, 0, true);
      Object.assign(s.layer.style, { transformOrigin: '0 0', background: `var(--dk-card, ${deckBg})`,
        transform: `translate(${x}px, ${y}px) scale(${z})` });
      el('div', { class: 'dk-ov-cap', text: `${s.i + 1}  ${s.title}`, style: { left: x + 'px', top: y + H * z + cap * .45 + 'px',
        width: W * z + 'px', fontSize: cap + 'px' } }, deckEl);
    }
    markOv();
    if (!document.querySelector('.dk-ov-hint')) el('div', { class: 'dk-ov-hint', html: 'Click a slide, or use the arrows and <kbd>Enter</kbd> · <kbd>Esc</kbd> to go back' }, document.body);
  } else {
    document.querySelector('.dk-ov-hint')?.remove();
    for (const s of slides) { resetLayer(s); s.layer.classList.remove('dk-ov-sel'); layerOn(s, s.i === S.i); }
    for (const c of deckEl.querySelectorAll('.dk-ov-cap')) c.remove();
    S.dirty = true; stageKey = '';
  }
  uiUpdate();
}
function markOv() { for (const s of slides) s.layer.classList.toggle('dk-ov-sel', s.i === ovSel); }
function toggleHelp(on) {
  if (!help) {
    help = el('div', { class: 'dk-help', html: `<div role="dialog" aria-label="Keyboard shortcuts"><h3>Shortcuts</h3><div class="dk-help-cols">
      <table><caption>Move</caption>
        <tr><td><kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd></td><td>next step</td></tr>
        <tr><td><kbd>←</kbd> <kbd>PgUp</kbd></td><td>back</td></tr>
        <tr><td><kbd>Home</kbd> <kbd>End</kbd></td><td>first / last slide</td></tr>
        <tr><td><kbd>7</kbd> <kbd>Enter</kbd></td><td>go to slide 7</td></tr>
        <tr><td>click right / left side</td><td>next / back</td></tr>
        <tr><td>swipe</td><td>next / back</td></tr></table>
      <table><caption>Views</caption>
        <tr><td><kbd>O</kbd> <kbd>Esc</kbd></td><td>all slides</td></tr>
        <tr><td><kbd>P</kbd></td><td>presenter view with notes</td></tr>
        <tr><td><kbd>F</kbd></td><td>fullscreen</td></tr>
        <tr><td><kbd>B</kbd> <kbd>.</kbd></td><td>black screen</td></tr>
        <tr><td><kbd>?</kbd></td><td>this help</td></tr></table></div>
      <p>Dots under the title show the steps left on this slide. The bar at the bottom jumps to any slide.</p></div>` }, document.body);
    help.addEventListener('click', e => { if (e.target === help) toggleHelp(false); });
  }
  help.classList.toggle('is-on', on ?? !help.classList.contains('is-on'));
}

/* ───────────────────────── on-screen controls ─────────────────────────
 * Live mode only, outside the scaled canvas, so they never reach an export.
 * data-controls="off" on .deck disables them (kiosk, embedded decks). */
const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>',
  pv: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="12" height="9" rx="1"/><path d="M18 7h3M18 11h3M3 18h18"/></svg>',
  fs: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};
let ui = null, uiT = 0, uiHover = false, hintEl = null, toastEl = null, toastT = 0, uiKey = '';
function controls() {
  if (MODE !== 'live') return;
  toastEl = el('div', { class: 'dk-toast', role: 'status' }, document.body);
  if (deckEl.dataset.controls === 'off') return;
  ui = el('div', { class: 'dk-ui', html: `
    <div class="dk-scrub" role="navigation" aria-label="Slides">${slides.map(s =>
      `<button class="dk-seg" data-i="${s.i}" data-tip="${s.i + 1}. ${s.title.replace(/"/g, '&quot;')}" aria-label="Slide ${s.i + 1}: ${s.title.replace(/"/g, '&quot;')}"><i></i></button>`).join('')}</div>
    <div class="dk-bar">
      <button class="dk-b" data-act="prev" data-tip="Back (←)" aria-label="Back">${ICON.prev}</button>
      <div class="dk-where"><b class="dk-num"></b><span class="dk-title"></span><span class="dk-steps"></span></div>
      <button class="dk-b dk-b-next" data-act="next" data-tip="Next (→ or click)" aria-label="Next">${ICON.next}</button>
      <i class="dk-sep"></i>
      <button class="dk-b" data-act="overview" data-tip="All slides (O)" aria-label="All slides">${ICON.grid}</button>
      <button class="dk-b" data-act="presenter" data-tip="Presenter view (P)" aria-label="Presenter view">${ICON.pv}</button>
      <button class="dk-b" data-act="fullscreen" data-tip="Fullscreen (F)" aria-label="Fullscreen">${ICON.fs}</button>
      <button class="dk-b" data-act="help" data-tip="Shortcuts (?)" aria-label="Shortcuts">?</button>
    </div>` }, document.body);
  el('div', { class: 'dk-edge dk-edge-l', html: ICON.prev }, document.body);
  el('div', { class: 'dk-edge dk-edge-r', html: ICON.next }, document.body);
  hintEl = el('div', { class: 'dk-hint', html: '<kbd>→</kbd> or click to advance · <kbd>←</kbd> back · <kbd>O</kbd> all slides · <kbd>?</kbd> shortcuts' }, document.body);
  setTimeout(() => hintEl.classList.add('is-on'), 600);
  setTimeout(hideHint, 6000);
  ui.addEventListener('mouseenter', () => { uiHover = true; showUI(); });
  ui.addEventListener('mouseleave', () => { uiHover = false; showUI(); });
  ui.addEventListener('click', e => {
    e.stopPropagation();
    const b = e.target.closest('[data-act],[data-i]'); if (!b) return;
    if (b.dataset.i != null) { if (overview) toggleOverview(false); goto(+b.dataset.i, 0, { animate: Math.abs(+b.dataset.i - S.i) === 1 }); }
    else ({ prev, next, help: () => toggleHelp(), overview: () => toggleOverview(), presenter: openPresenter,
      fullscreen: () => (document.fullscreenElement ? document.exitFullscreen() : html.requestFullscreen?.()) })[b.dataset.act]();
    broadcast();
  });
  showUI(4500);
  uiUpdate();
}
function hideHint() { if (hintEl) { hintEl.classList.remove('is-on'); hintEl = null; } }
function showUI(ms = 2600) {
  if (!ui) return;
  html.classList.add('dk-ui-on');
  clearTimeout(uiT);
  uiT = setTimeout(() => { if (!uiHover) html.classList.remove('dk-ui-on'); }, ms);
}
function toast(msg, ms = 1800) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.add('is-on');
  clearTimeout(toastT);
  if (ms) toastT = setTimeout(() => toastEl.classList.remove('is-on'), ms);
}
function uiUpdate() {
  if (!ui) return;
  const s = slides[S.i], key = `${S.i}.${S.step}.${overview}`;
  if (key === uiKey) return; uiKey = key;
  ui.querySelector('.dk-num').textContent = `${S.i + 1} / ${slides.length}`;
  ui.querySelector('.dk-title').textContent = s.title;
  const dots = ui.querySelector('.dk-steps');
  dots.innerHTML = s.steps ? Array.from({ length: s.steps + 1 }, (_, k) => `<i class="${k <= S.step ? 'on' : ''}"></i>`).join('') : '';
  dots.title = s.steps ? `step ${S.step + 1} of ${s.steps + 1}` : '';
  ui.querySelectorAll('.dk-seg').forEach((b, k) => {
    b.classList.toggle('is-past', k < S.i); b.classList.toggle('is-cur', k === S.i);
    b.firstChild.style.transform = `scaleX(${k < S.i ? 1 : k > S.i ? 0 : (S.step + 1) / (s.steps + 1)})`;
  });
  ui.querySelector('[data-act=prev]').disabled = S.i === 0 && S.step === 0;
  ui.querySelector('[data-act=next]').disabled = S.i === slides.length - 1 && S.step === s.steps;
}
function hud() {
  const d = el('div', { class: 'dk-hud' }, document.body);
  let frames = 0, last = performance.now(), prevR = 0;
  const tick = () => { frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setInterval(() => {
    const t = performance.now(), sec = (t - last) / 1000, s = slides[S.i];
    d.textContent = `${Math.round(frames / sec)} fps · drawn ${Math.round((perf.rendered - prevR) / sec)}/s · ${perf.ms.toFixed(2)} ms (worst ${perf.worst.toFixed(1)}) · ${S.tr ? 'transition' : S.idle ? 'idle' : 'animating'} · ${s.el.getElementsByTagName('*').length} nodes`;
    frames = 0; last = t; prevR = perf.rendered; perf.worst = 0;
  }, 500);
}

/* ───────────────────────── presenter view ───────────────────────── */
let presenterWin = null;
function openPresenter() {
  const url = location.href.split('#')[0].split('?')[0] + '?presenter' + location.hash;
  presenterWin = window.open(url, 'dk-presenter', 'width=1400,height=860');
}
function post(win, msg) { try { win && !win.closed && win.postMessage({ dk: 1, ...msg }, '*'); } catch (e) { /* closed */ } }
function broadcast() { post(presenterWin, { i: S.i, step: S.step }); if (MODE === 'presenter') post(window.opener, { i: S.i, step: S.step }); }

function nextState(i, step) {
  const s = slides[i];
  if (step < s.steps) return { i, step: step + 1 };
  if (i < slides.length - 1) return { i: i + 1, step: 0 };
  return null;
}
function presenterUI() {
  const base = location.href.split('#')[0].split('?')[0];
  document.body.classList.add('dk-presenter');
  const ui = el('div', { class: 'dk-pv', html: `
    <header><span class="dk-pv-timer" title="click to reset">00:00</span><span class="dk-pv-pos"></span>
      <button data-pv="prev" aria-label="Back">‹ Back</button><button data-pv="next" aria-label="Next">Next ›</button><span class="dk-pv-clock"></span></header>
    <main>
      <section class="dk-pv-cur"><div class="dk-pv-frame"><iframe tabindex="-1"></iframe></div></section>
      <aside><div class="dk-pv-next"><label>Next</label><div class="dk-pv-frame"><iframe tabindex="-1"></iframe></div></div>
        <div class="dk-pv-notes"></div></aside>
    </main>` }, document.body);
  const [cur, nxt] = ui.querySelectorAll('iframe');
  cur.src = `${base}?embed#${S.i + 1}.${S.step}`;
  const timer = ui.querySelector('.dk-pv-timer'), pos = ui.querySelector('.dk-pv-pos'), clock = ui.querySelector('.dk-pv-clock'), notes = ui.querySelector('.dk-pv-notes');
  let t0 = Date.now();
  timer.onclick = () => { t0 = Date.now(); };
  ui.querySelector('[data-pv=prev]').onclick = () => { prev(); broadcast(); };
  ui.querySelector('[data-pv=next]').onclick = () => { next(); broadcast(); };
  const two = n => String(n).padStart(2, '0');
  setInterval(() => {
    const e = Math.floor((Date.now() - t0) / 1000);
    timer.textContent = `${two(Math.floor(e / 60))}:${two(e % 60)}`;
    const d = new Date(); clock.textContent = `${two(d.getHours())}:${two(d.getMinutes())}`;
  }, 250);
  let nxtKey = '';
  const refresh = () => {
    const s = slides[S.i], n = nextState(S.i, S.step);
    pos.textContent = `${S.i + 1} / ${slides.length}${s.steps ? ` · step ${S.step + 1} of ${s.steps + 1}` : ''} · ${s.title}`;
    notes.innerHTML = s.notes || '<em>No notes for this slide.</em>';
    const key = n ? `${n.i + 1}.${n.step}` : 'end';
    if (key !== nxtKey) {
      nxtKey = key;
      if (n) { nxt.removeAttribute('srcdoc'); nxt.src = `${base}?embed&rest#${key}`; }
      else nxt.srcdoc = '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#000;color:#777;font:24px system-ui">End of deck</body>';
    }
    post(cur.contentWindow, { i: S.i, step: S.step });
  };
  listeners.push(refresh);
  refresh();
}

/* ───────────────────────── input ───────────────────────── */
function input() {
  let buf = '', bufT = 0;
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^\d$/.test(k)) { buf += k; toast(`Go to slide ${buf} · Enter`, 2500); clearTimeout(bufT); bufT = setTimeout(() => { buf = ''; }, 2500); return; }
    if (k === 'Enter' && buf) { if (overview) toggleOverview(false); goto(+buf - 1); toast('', 1); buf = ''; e.preventDefault(); broadcast(); return; }
    buf = '';
    if (overview) {
      const cols = Math.ceil(Math.sqrt(slides.length * 1.25));
      const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[k];
      if (mv) { ovSel = clamp(ovSel + mv, 0, slides.length - 1); markOv(); e.preventDefault(); return; }
      if (k === 'Enter' || k === ' ') { const i = ovSel; toggleOverview(false); goto(i); e.preventDefault(); return; }
      if (k === 'Escape' || k === 'o' || k === 'O') { toggleOverview(false); return; }
      return;
    }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': case 'n': case 'N':
        e.shiftKey && k === ' ' ? prev() : next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
      case 'Home': goto(0); break;
      case 'End': goto(slides.length - 1, slides[slides.length - 1].steps); break;
      case 'o': case 'O': if (MODE === 'live') toggleOverview(); break;
      case 'p': case 'P': if (MODE === 'live') openPresenter(); break;
      case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : html.requestFullscreen?.(); break;
      case 'b': case 'B': case '.': blackout.classList.toggle('is-on'); break;
      case '?': case 'h': case 'H': toggleHelp(); break;
      case 'Escape':
        if (help && help.classList.contains('is-on')) toggleHelp(false);
        else if (blackout.classList.contains('is-on')) blackout.classList.remove('is-on');
        else if (MODE === 'live') toggleOverview();
        break;
      default: return;
    }
    e.preventDefault();
    broadcast();
  });
  if (MODE !== 'live') return;
  // Click anywhere: the left fifth of the screen goes back, the rest goes forward.
  let swiped = 0;
  const EDGE = .2;
  addEventListener('click', e => {
    if (Date.now() - swiped < 500) return;
    if (e.target.closest('.dk-ui,.dk-help,.dk-toast')) return;
    if (overview) {
      const layer = e.target.closest('.dk-layer'); if (!layer) return;
      const s = slides.find(x => x.layer === layer); toggleOverview(false); goto(s.i); broadcast(); return;
    }
    if (e.target.closest('a,button,input,select,textarea,label,[data-no-advance]')) return;
    e.clientX < innerWidth * EDGE ? prev() : next(); broadcast();
  });
  let tx = null, ty = null;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; showUI(); }, { passive: true });
  addEventListener('touchend', e => {
    if (tx == null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { swiped = Date.now(); dx < 0 ? next() : prev(); broadcast(); }
  });
  let idle;
  addEventListener('mousemove', e => {
    html.classList.remove('dk-idle'); clearTimeout(idle); idle = setTimeout(() => html.classList.add('dk-idle'), 2600);
    showUI();
    const x = e.clientX / innerWidth, inUI = !!e.target.closest?.('.dk-ui');
    html.classList.toggle('dk-edge-l-on', !overview && !inUI && x < EDGE);
    html.classList.toggle('dk-edge-r-on', !overview && !inUI && x > 1 - EDGE);
  });
  document.addEventListener('mouseleave', () => html.classList.remove('dk-edge-l-on', 'dk-edge-r-on'));
  addEventListener('hashchange', () => { const h = parseHash(); if (h && (h.i !== S.i || h.step !== S.step)) { goto(h.i, h.step); broadcast(); } });
}
addEventListener('message', e => {
  const m = e.data; if (!m || m.dk !== 1 || !slides.length) return;
  if (MODE === 'embed' && Q.has('rest')) { goto(m.i, m.step); show(m.i, m.step); return; }
  sync(m.i, m.step);
});

/* ───────────────────────── export & video API ───────────────────────── */
// Video timeline: each step holds for data-hold seconds, transitions play in between.
function timeline() {
  const segs = []; let T = 0;
  slides.forEach((s, i) => {
    for (let st = 0; st <= s.steps; st++) {
      if (i > 0 && st === 0) {
        const cfg = trCfg(s, 1);
        segs.push({ kind: 'tr', from: { i: i - 1, step: slides[i - 1].steps }, to: { i, step: 0 }, t0: T, dur: cfg.dur });
        T += cfg.dur;
      }
      const hold = Q.has('hold') ? +Q.get('hold') : s.hold[Math.min(st, s.hold.length - 1)];
      segs.push({ kind: 'hold', i, step: st, t0: T, dur: hold, entry: st === 0 && i > 0 ? segs[segs.length - 1].dur : 0 });
      T += hold;
    }
  });
  return { segs, duration: T };
}
let TL = null, vidTr = null, vidSeg = null;
function drawAt(T) {
  const g = TL.segs.find(x => T >= x.t0 && T < x.t0 + x.dur) || TL.segs[TL.segs.length - 1];
  if (g !== vidSeg) {
    if (vidTr) { endTransition(vidTr); vidTr = null; }
    for (const s of slides) layerOn(s, false);
    vidSeg = g;
    if (g.kind === 'tr') {
      const prevHold = TL.segs[TL.segs.indexOf(g) - 1];
      vidTr = beginTransition({ ...g.from, t0: prevHold.t0 - (prevHold.entry || 0), settled: false }, { ...g.to, settled: false }, 1, g.t0);
    } else layerOn(slides[g.i], true);
  }
  if (g.kind === 'tr') {
    const p = (T - g.t0) / g.dur, o = renderTransition(vidTr, p, T);
    drawStage({ T, rest: false, i: lerp(g.from.i, g.to.i, ease.inOutCubic(p)), p, from: g.from.i, to: g.to.i,
      cam: o.cam || camOf(slides[g.to.i]) });
  } else {
    const s = slides[g.i];
    renderSlide(s, g.step, T - g.t0 + (g.entry || 0), T);
    drawStage({ T, rest: false, i: g.i, p: 1, from: g.i, to: g.i, cam: camOf(s) });
  }
  S.i = g.kind === 'tr' ? g.to.i : g.i; chrome();
}
// Rest frame: every build of `step` finished, ambient motion frozen.
function show(i, step) {
  finishTr();
  if (vidTr) { endTransition(vidTr); vidTr = null; vidSeg = null; }
  for (const s of slides) { resetLayer(s); layerOn(s, s.i === i); }
  S.i = i; S.step = step;
  renderSlide(slides[i], step, Infinity, 0, true);
  drawStage({ T: 0, rest: true, i, p: 1, from: i, to: i, cam: camOf(slides[i]) });
  chrome();
}
function states(which = 'all') {
  const out = [];
  for (const s of slides) {
    const only = (s.d.export || '').trim();
    if (which === 'last' || only === 'last') out.push({ i: s.i, step: s.steps });
    else for (let st = 0; st <= s.steps; st++) out.push({ i: s.i, step: st });
  }
  return out;
}
// Vector print layout: one page per state, built from clones of rest frames.
function buildPrint(list) {
  const root = el('div', { class: 'deck dk-print' });
  let n = 0;
  for (const { i, step } of list) {
    show(i, step);
    const page = el('div', { class: 'dk-page' }, root);
    page.style.cssText = `width:${W}px;height:${H}px;background:${deckBg}`;
    if (stageCv) el('img', { src: stageCv.toDataURL('image/png'), class: 'dk-page-stage' }, page);
    const c = slides[i].layer.cloneNode(true);
    const liveCv = slides[i].layer.querySelectorAll('canvas'), cloneCv = c.querySelectorAll('canvas');
    cloneCv.forEach((cv, j) => { const img = el('img', { src: liveCv[j].toDataURL('image/png') }); img.style.cssText = cv.style.cssText; img.className = cv.className; img.width = cv.width; img.height = cv.height; cv.replaceWith(img); });
    const sfx = `__p${n++}`;
    c.querySelectorAll('[id]').forEach(x => { x.id += sfx; });
    c.querySelectorAll('*').forEach(x => {
      if (!(x instanceof SVGElement)) return;
      for (const a of [...x.attributes]) {
        if (/^(xlink:)?href$/.test(a.name) && a.value.startsWith('#')) x.setAttribute(a.name, a.value + sfx);
        else if (a.value.includes('url(#')) x.setAttribute(a.name, a.value.replace(/url\(#([^)"']+)\)/g, `url(#$1${sfx})`));
      }
    });
    c.classList.add('is-on');
    page.append(c);
  }
  document.body.append(root);
  html.classList.add('dk-printing');
  return list.length;
}

/* ───────────────────────── init ───────────────────────── */
async function init() {
  collect();
  deckBg = getComputedStyle(deckEl).backgroundColor;
  if (!deckBg || deckBg === 'rgba(0, 0, 0, 0)') deckBg = getComputedStyle(document.body).backgroundColor || '#fff';
  overlays();
  fit();
  // Lay out every slide once, hidden: that requests every font the deck uses, so
  // fonts.ready really means "all text is final" and setup code can measure text.
  html.classList.add('dk-warm');
  for (const s of slides) layerOn(s, true);
  void deckEl.offsetHeight;
  await document.fonts.ready;
  setupStage();
  for (const s of slides) {
    s.api = api;
    s.hook.setup?.(s.el, api);
  }
  for (const n of deckEl.querySelectorAll('[data-fit]')) fitText(n);
  for (const s of slides) layerOn(s, false);
  html.classList.remove('dk-warm');
  for (const s of slides) {
    parseBuilds(s);
    s.entry = s.i === 0 ? .15 : trCfg(s, 1).dur * .55;
  }
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { fit(); if (overview) toggleOverview(true); }); });
  const h = parseHash();
  goto(h ? h.i : 0, h ? h.step : 0);
  if (MODE === 'embed' && Q.has('rest')) show(S.i, S.step);
  TL = timeline();
  window.__deck = { W, H, slides: slides.map(s => ({ id: s.id, title: s.title, notes: s.notesText, steps: s.steps })),
    states, show, buildPrint, timeline: () => TL, count: slides.length };
  window.__meta = { W, H, FPS: +(deckEl.dataset.fps || 30), DURATION: TL.duration };
  window.__draw = drawAt;
  if (MODE === 'presenter') presenterUI();
  if (MODE === 'live' || MODE === 'presenter') input();
  controls();
  if (Q.has('perf')) hud();
  html.classList.add('dk-ready');
  await document.fonts.ready;
  await Promise.all([...document.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  window.__ready = true;
  if (MODE === 'render' || MODE === 'presenter' || (MODE === 'embed' && Q.has('rest'))) return;
  const loop = () => {
    if (!overview) { const a = performance.now(); frame(now()); const ms = performance.now() - a; perf.ms = perf.ms * .9 + ms * .1; perf.worst = Math.max(perf.worst, ms); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ───────────────────────── public API ───────────────────────── */
const api = {
  // Deck.slide('id', { steps, setup(el, api), frame(el, st) })
  slide(id, spec) { hooks[id] = spec; return api; },
  // Deck.stage({ setup(ctx), draw(ctx, S) }): canvas behind every slide
  stage(spec) { stageSpec = spec; return api; },
  anim, transition, next, prev, goto, toast,
  on(f) { listeners.push(f); return api; },
  get state() { return { i: S.i, step: S.step, count: slides.length }; },
  W, H, MODE, ease, clamp, lerp, seg, spring, rng, mix,
  svg, el, scaleLinear, scaleBand, ticks, linePath, areaPath, arcPath, fmt, pointAt,
};
window.Deck = api;
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : queueMicrotask(init);
})();
