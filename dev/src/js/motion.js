// motion.js — engine chuyển động nhỏ gọn, tự viết (timeline, stagger, tách chữ, animation theo vị trí cuộn).
// API gần với GSAP để dễ thay thế: Motion.to / from / fromTo / set / timeline / splitText / scrub / enter / counter.
import { clamp, lerp } from './util.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- easing ---------- */
const E = {
  linear: (t) => t,
  'sine.inOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  'power2.out': (t) => 1 - (1 - t) ** 2,
  'power2.in': (t) => t * t,
  'power2.inOut': (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  'power3.out': (t) => 1 - (1 - t) ** 3,
  'power3.in': (t) => t ** 3,
  'power3.inOut': (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  'power4.out': (t) => 1 - (1 - t) ** 4,
  'expo.out': (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  'expo.inOut': (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  'back.out': (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  'elastic.out': (t) => (t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
const getEase = (e) => (typeof e === 'function' ? e : E[e] || E['power3.out']);

/* ---------- ticker ---------- */
const ticks = new Set();
let raf = 0, last = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (const fn of [...ticks]) fn(dt, now / 1000);
  raf = ticks.size ? requestAnimationFrame(loop) : 0;
}
const ticker = {
  add(fn) { ticks.add(fn); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } return fn; },
  remove(fn) { ticks.delete(fn); },
};

/* ---------- trạng thái transform của phần tử DOM ---------- */
const states = new WeakMap();
const DEF = { x: 0, y: 0, xPercent: 0, yPercent: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, opacity: 1 };
const TKEYS = new Set(['x', 'y', 'xPercent', 'yPercent', 'rotate', 'scale', 'scaleX', 'scaleY']);
function st(el) { let s = states.get(el); if (!s) { s = { ...DEF }; states.set(el, s); } return s; }
function getV(t, k) {
  if (!(t instanceof Element)) return t[k] ?? 0;
  if (k.startsWith('--')) return parseFloat(t.style.getPropertyValue(k)) || 0;
  return st(t)[k] ?? DEF[k] ?? 0;
}
function setV(t, k, v) {
  if (!(t instanceof Element)) { t[k] = v; return; }
  if (k.startsWith('--')) { t.style.setProperty(k, v); return; }
  const s = st(t); s[k] = v;
  if (k === 'opacity') { t.style.opacity = v; return; }
  if (TKEYS.has(k)) {
    t.style.transform = `translate3d(${s.x}px,${s.y}px,0) translate(${s.xPercent}%,${s.yPercent}%) rotate(${s.rotate}deg) scale(${s.scale * s.scaleX},${s.scale * s.scaleY})`;
  }
}
const RESERVED = new Set(['duration', 'delay', 'ease', 'stagger', 'onUpdate', 'onComplete', 'from']);
const toList = (t) => (typeof t === 'string' ? [...document.querySelectorAll(t)] : t instanceof Element || !t.length ? [t] : [...t]);

/* ---------- Tween đơn ---------- */
class Tw {
  constructor(target, vars, forceFrom) {
    this.targets = toList(target);
    this.dur = Math.max(0.0001, reduced ? 0.0001 : (vars.duration ?? 0.6));
    this.delay = reduced ? 0 : (vars.delay ?? 0);
    this.stag = reduced ? 0 : (vars.stagger ?? 0);
    this.ease = getEase(vars.ease);
    this.to = {}; this.fromV = vars.from || null; this.inv = !!forceFrom;
    for (const k of Object.keys(vars)) if (!RESERVED.has(k)) this.to[k] = vars[k];
    this.onUpdate = vars.onUpdate; this.onComplete = vars.onComplete;
    this.init = false; this.startV = null;
  }
  get total() { return this.delay + this.dur + this.stag * (this.targets.length - 1); }
  capture() {
    if (this.init) return; this.init = true; this.startV = [];
    this.targets.forEach((t) => {
      const s = {};
      for (const k of Object.keys(this.to)) {
        if (this.inv) { s[k] = this.to[k]; }
        else s[k] = this.fromV && k in this.fromV ? this.fromV[k] : getV(t, k);
      }
      this.startV.push(s);
    });
    if (this.inv) { // from(): đích là giá trị hiện tại
      this.endV = this.targets.map((t) => { const e = {}; for (const k of Object.keys(this.to)) e[k] = getV(t, k); return e; });
    }
  }
  render(time) {
    this.capture();
    this.targets.forEach((t, i) => {
      const p = clamp((time - this.delay - i * this.stag) / this.dur, 0, 1);
      const e = this.ease(p);
      for (const k of Object.keys(this.to)) {
        const a = this.startV[i][k];
        const b = this.inv ? this.endV[i][k] : this.to[k];
        setV(t, k, lerp(a, b, e));
      }
    });
    this.onUpdate?.(time / this.total);
  }
}

/* ---------- Timeline ---------- */
class Timeline {
  constructor(o = {}) {
    this.items = []; this.labels = {}; this.t = 0; this.len = 0; this.playing = false;
    this.onComplete = o.onComplete; this.speed = 1; this.lastEnd = 0; this.lastStart = 0; this.fired = new Set();
    this.def = o.defaults || {};
    this._fn = (dt) => this.tick(dt);
    if (!o.paused) queueMicrotask(() => { if (!this._touched) this.play(); });
  }
  _pos(pos) {
    if (pos == null) return this.lastEnd;
    if (typeof pos === 'number') return pos;
    if (pos in this.labels) return this.labels[pos];
    if (pos === '<') return this.lastStart;
    if (pos === '>') return this.lastEnd;
    let m = /^<([+-]=?)([\d.]+)$/.exec(pos); if (m) return this.lastStart + (m[1][0] === '+' ? 1 : -1) * parseFloat(m[2]);
    m = /^([+-])=([\d.]+)$/.exec(pos); if (m) return this.lastEnd + (m[1] === '+' ? 1 : -1) * parseFloat(m[2]);
    return this.lastEnd;
  }
  _add(tw, pos) {
    const start = Math.max(0, this._pos(pos));
    this.items.push({ start, tw });
    this.lastStart = start; this.lastEnd = start + tw.total; this.len = Math.max(this.len, this.lastEnd);
    return this;
  }
  to(target, vars, pos) { return this._add(new Tw(target, { ...this.def, ...vars }), pos); }
  from(target, vars, pos) {
    const tw = new Tw(target, { ...this.def, ...vars }, true); tw.capture(); tw.render(0);
    return this._add(tw, pos);
  }
  fromTo(target, from, to, pos) { return this._add(new Tw(target, { ...this.def, ...to, from }), pos); }
  set(target, vars, pos) { return this.to(target, { ...vars, duration: 0.0001 }, pos); }
  call(fn, pos) { this.items.push({ start: this._pos(pos), fn }); return this; }
  label(n, pos) { this.labels[n] = this._pos(pos); return this; }
  duration() { return this.len; }
  render(t) {
    // tween chưa tới lượt vẽ trạng thái đầu (muộn nhất trước), tween đã tới vẽ theo thứ tự thời gian -> giá trị đúng khi tua tới lui
    const future = [], started = [];
    for (const it of this.items) {
      if (!it.tw) { if (t >= it.start && !this.fired.has(it)) { this.fired.add(it); it.fn(); } else if (t < it.start) this.fired.delete(it); continue; }
      (it.start <= t ? started : future).push(it);
    }
    future.sort((a, b) => b.start - a.start).forEach((it) => it.tw.render(0));
    started.sort((a, b) => a.start - b.start).forEach((it) => it.tw.render(clamp(t - it.start, 0, it.tw.total)));
  }
  progress(p) { this._touched = true; if (p == null) return this.t / (this.len || 1); this.t = clamp(p, 0, 1) * this.len; this.render(this.t); return this; }
  tick(dt) {
    this.t += dt * this.speed;
    if (this.t >= this.len) { this.t = this.len; this.render(this.t); this.pause(); this.onComplete?.(); return; }
    this.render(this.t);
  }
  play(from) { this._touched = true; if (from != null) this.t = from; this.playing = true; ticker.add(this._fn); return this; }
  pause() { this.playing = false; ticker.remove(this._fn); return this; }
  restart() { this.fired.clear(); this.t = 0; return this.play(0); }
  kill() { this.pause(); }
  then() { return new Promise((r) => { const o = this.onComplete; this.onComplete = () => { o?.(); r(); }; if (!this.playing && this.t >= this.len) r(); }); }
}

/* ---------- Tách chữ ---------- */
function splitText(root, { chars = true, mask = true } = {}) {
  const label = root.textContent.replace(/\s+/g, ' ').trim();
  root.setAttribute('aria-label', label);
  const out = { chars: [], words: [], masks: [], el: root };
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { frag.append(document.createTextNode(' ')); continue; }
          const w = document.createElement('span'); w.className = 'sp-w'; w.setAttribute('aria-hidden', 'true');
          if (chars) {
            for (const ch of [...p]) { const c = document.createElement('span'); c.className = 'sp-c'; c.textContent = ch; w.append(c); out.chars.push(c); }
          } else w.textContent = p;
          out.words.push(w);
          if (mask) { const m = document.createElement('span'); m.className = 'sp-m'; m.append(w); out.masks.push(m); frag.append(m); } else frag.append(w);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('sp-m')) { n.setAttribute('aria-hidden', 'true'); walk(n); }
    }
  };
  walk(root);
  return out;
}

/* ---------- Animation theo vị trí cuộn ---------- */
const triggers = new Set();
let scrollY = window.scrollY, vh = innerHeight;
function parsePos(s, size, anchorOf) {
  const [a, b] = s.trim().split(/\s+/);
  const part = (v, sz) => (v === 'top' ? 0 : v === 'center' ? sz / 2 : v === 'bottom' ? sz : v.endsWith('%') ? (parseFloat(v) / 100) * sz : parseFloat(v));
  return { el: part(a, size), vp: part(b ?? 'top', vh) };
}
function measure(t) {
  const r = t.el.getBoundingClientRect(); const top = r.top + window.scrollY; const hgt = r.height;
  const s = parsePos(t.start, hgt), e = parsePos(t.end, hgt);
  t.y0 = top + s.el - s.vp; t.y1 = top + e.el - e.vp;
  if (t.y1 <= t.y0) t.y1 = t.y0 + 1;
}
function scrub(el, o) {
  const t = { el: typeof el === 'string' ? document.querySelector(el) : el, start: o.start || 'top bottom', end: o.end || 'bottom top',
    smooth: reduced ? 0 : (o.smooth ?? 0.1), onUpdate: o.onUpdate, tl: o.timeline, p: -1, target: 0, raw: 0, active: false, onEnter: o.onEnter, onLeave: o.onLeave };
  if (!t.el) return null;
  measure(t); t.p = clamp((scrollY - t.y0) / (t.y1 - t.y0), 0, 1); t.target = t.p;
  triggers.add(t); apply(t, true);
  return { kill() { triggers.delete(t); }, refresh() { measure(t); }, trigger: t };
}
function apply(t, force) {
  if (t.tl) t.tl.progress(t.p);
  t.onUpdate?.(t.p, t.raw);
  const inside = t.raw > 0 && t.raw < 1;
  if (inside !== t.active) { t.active = inside; (inside ? t.onEnter : t.onLeave)?.(); }
}
function scrollLoop(dt) {
  scrollY = window.scrollY;
  for (const t of triggers) {
    const raw = (scrollY - t.y0) / (t.y1 - t.y0);
    t.raw = raw; t.target = clamp(raw, 0, 1);
    const prev = t.p;
    t.p = t.smooth ? t.p + (t.target - t.p) * (1 - Math.exp(-dt / Math.max(0.0001, t.smooth * 0.35))) : t.target;
    if (Math.abs(t.p - t.target) < 0.0005) t.p = t.target;
    if (t.p !== prev || t.first !== true) { t.first = true; apply(t); }
  }
}
function refreshAll() { vh = innerHeight; for (const t of triggers) measure(t); }
ticker.add(scrollLoop);
addEventListener('resize', refreshAll, { passive: true });
addEventListener('load', refreshAll);
document.fonts?.ready.then(refreshAll);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => refreshAll()).observe(document.documentElement);

/** Chạy callback khi phần tử vào khung nhìn. */
function enter(el, cb, { once = true, margin = '0px 0px -12% 0px', threshold = 0.01 } = {}) {
  const els = toList(el);
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { cb(e.target); if (once) io.unobserve(e.target); }
  }, { rootMargin: margin, threshold });
  els.forEach((x) => io.observe(x));
  return io;
}

/** Đếm số. */
function counter(el, to, { duration = 1.6, ease = 'expo.out', format = (n) => String(Math.round(n)), delay = 0 } = {}) {
  const o = { v: 0 }; el.textContent = format(0);
  return new Timeline().to(o, { v: to, duration, ease, delay, onUpdate: () => { el.textContent = format(o.v); } });
}

const Motion = {
  reduced, ease: E, ticker,
  timeline: (o) => new Timeline(o),
  to: (t, v) => new Timeline().to(t, v),
  from: (t, v) => new Timeline().from(t, v),
  fromTo: (t, f, v) => new Timeline().fromTo(t, f, v),
  set: (t, v) => { for (const x of toList(t)) for (const [k, val] of Object.entries(v)) setV(x, k, val); },
  splitText, scrub, enter, counter,
  refresh: refreshAll,
};
export default Motion;
