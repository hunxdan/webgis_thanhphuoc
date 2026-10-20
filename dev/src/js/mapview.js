// mapview.js — bộ máy bản đồ tự viết: toàn bộ thửa đất được tam giác hoá sẵn và nạp MỘT LẦN lên GPU (WebGL2).
// Kéo/zoom chỉ đổi vài số của camera; thửa không vẽ lại từng cái. Lớp động (chọn, nhãn, đo, lưới +) vẽ trên canvas 2D mỏng.
import { clamp, relToLonLat, lonLatToRel, colTD, colQH, hex2rgb, fmtArea, grainTile } from './util.js';
import { wgsToVN, vnToWgs } from './vn2000.js';

const HALF = 20037508.342789244;
const TILE_WORLD = HALF * 2;
const RAD = Math.PI / 180;
const R = 6378137;
const INK = '#0c2622', PAPER = '#f3e8d3', RED = '#922b32', GREEN = '#025a4c';

/* ---------- hình học thuần ---------- */
export function haversine(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ---------- shader ---------- */
const VS_FILL = `#version 300 es
in vec2 aPos; in vec4 aCol; uniform vec2 uC; uniform vec2 uS; uniform float uA; out vec4 vC;
void main(){ gl_Position = vec4((aPos-uC)*uS, 0., 1.); vC = vec4(aCol.rgb*uA, uA); }`;
const FS_FILL = `#version 300 es
precision mediump float; in vec4 vC; out vec4 o; void main(){ o = vC; }`;
// nét dày theo pixel, KHỬ RĂNG CƯA trong shader: mỗi đoạn là một instance (4 đỉnh góc); phần rìa 1 điểm ảnh thiết bị mờ dần theo khoảng cách tới trục nét.
// (Trước đây ranh thửa là gl.LINES 1px, màn hình mật độ cao tắt MSAA nên nét bị răng cưa.)
const VS_AA = `#version 300 es
in vec2 aP0; in vec2 aP1; in vec2 aCorner; uniform vec2 uC; uniform float uScale; uniform vec2 uWH; uniform float uW; uniform float uAA; out float vD;
void main(){
  vec2 a = (aP0-uC)*uScale, b = (aP1-uC)*uScale; vec2 d = b-a; float L = length(d); vec2 dir = L > 1e-6 ? d/L : vec2(1.,0.);
  vec2 n = vec2(-dir.y, dir.x); float t = aCorner.x; float hw = uW*.5; float ext = hw + uAA;
  vD = aCorner.y*ext;
  vec2 p = mix(a, b, t) + n*aCorner.y*ext + dir*(t*2.-1.)*hw;
  gl_Position = vec4(p*vec2(2./uWH.x, -2./uWH.y), 0., 1.); }`;
const FS_AA = `#version 300 es
precision highp float; in float vD; uniform vec4 uK; uniform float uW; uniform float uAA; out vec4 o;
void main(){ float cov = clamp((uW*.5 - abs(vD))/uAA + .5, 0., 1.); float a = uK.a*cov; o = vec4(uK.rgb*a, a); }`;

function prog(gl, vs, fs) {
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error('shader'); return x; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  const a = {}; const m = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < m; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}

export class MapView {
  constructor(root, D, cfg, rows) {
    this.root = root; this.D = D; this.cfg = cfg; this.q = D.meta.quant; this.rows = rows;
    this.bg = document.createElement('canvas'); this.glc = document.createElement('canvas'); this.ov = document.createElement('canvas'); this.an = document.createElement('canvas');
    this.glLost = false;
    this.bg.className = 'map__bg'; this.glc.className = 'map__gl'; this.ov.className = 'map__over'; this.an.className = 'map__anim';
    root.append(this.bg, this.glc, this.ov);
    root.insertBefore(this.an, this.ov); // lớp nét chạy nằm dưới lớp bắt chuột
    this.bgx = this.bg.getContext('2d', { alpha: false });
    this.octx = this.ov.getContext('2d'); this.actx = this.an.getContext('2d');
    this.state = { basemap: 'paper', diachinh: true, hientrang: true, quyhoach: false, opacity: 1, opacityQh: 1 };
    this.cx = 0; this.cy = 0; this.z = 13; this.W = 1; this.H = 1; this.dpr = 1;
    this.intro = 0; this.hoverZ = -1; this.sel = -1; this.zone = -1; this.flash = -1; this.hover = -1; this.hl = null; this.hlPath = null;
    this.ct = null; this.ripples = []; this.measure = null; this.gps = null; this.zt = null;
    this.sprites = new Map(); this.gridCache = new Map(); this.tiles = new Map(); this.pathCache = new Map();
    this.dirty = true; this.raf = 0; this.vel = { x: 0, y: 0 }; this.pointers = new Map(); this.listeners = {};
    const bq = D.meta.bboxQ, q = this.q;
    this.bb = { x0: bq[0] / q, x1: bq[2] / q, y0: -bq[3] / q, y1: -bq[1] / q };
    // mất ngữ cảnh WebGL (hết bộ nhớ GPU, đổi tab, trình duyệt thu hồi): không để trang trắng/crash — dựng lại GPU khi được cấp lại
    this.glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.glLost = true; });
    this.glc.addEventListener('webglcontextrestored', () => { this.glLost = false; try { this.initGL(); } catch (_) { return; } this.bc = null; this.invalidate(true); });
    this.initGL();
    this.buildGrid();
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(root);
  }

  /* ---------- sự kiện nội bộ ---------- */
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  /* ---------- GPU: nạp một lần ---------- */
  initGL() {
    // MSAA trên khung rất lớn tốn bộ nhớ GPU nhất: chỉ bật ở màn hình thường; màn hình mật độ cao đã đủ mịn
    const gl = this.gl = this.glc.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: (window.devicePixelRatio || 1) < 1.5, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    const { P, qh } = this.D; const q = this.q;
    this.pF = prog(gl, VS_FILL, FS_FILL); this.pA = prog(gl, VS_AA, FS_AA);
    const buf = (target, data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
    const mkPack = (pack, colorOf, edges) => {
      const n = pack.pts.length / 2; const pos = new Float32Array(n * 2); const col = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) { pos[2 * i] = pack.pts[2 * i] / q; pos[2 * i + 1] = -pack.pts[2 * i + 1] / q; }
      const nf = pack.featRing.length - 1;
      for (let f = 0; f < nf; f++) {
        const rgb = hex2rgb(colorOf(f)); const s = pack.ringStart[pack.featRing[f]], e = pack.ringStart[pack.featRing[f + 1]];
        for (let i = s; i < e; i++) { col[4 * i] = rgb[0]; col[4 * i + 1] = rgb[1]; col[4 * i + 2] = rgb[2]; col[4 * i + 3] = 255; }
      }
      // cạnh: mỗi vòng khép kín
      let ne = 0; for (let r = 0; r < pack.ringStart.length - 1; r++) ne += pack.ringStart[r + 1] - pack.ringStart[r];
      const out = { n, pos: buf(gl.ARRAY_BUFFER, pos), col: buf(gl.ARRAY_BUFFER, col), idx: buf(gl.ELEMENT_ARRAY_BUFFER, pack.tri), nTri: pack.tri.length };
      if (edges === 'lines') {
        const ei = new Uint32Array(ne * 2); let k = 0;
        for (let r = 0; r < pack.ringStart.length - 1; r++) { const s = pack.ringStart[r], e = pack.ringStart[r + 1]; for (let i = s; i < e; i++) { ei[k++] = i; ei[k++] = i + 1 < e ? i + 1 : s; } }
        out.lineIdx = buf(gl.ELEMENT_ARRAY_BUFFER, ei); out.nLine = ei.length;
      } else if (edges === 'thick') {
        // khử trùng lặp: ranh chung của 2 thửa liền kề chỉ vẽ 1 lần (giảm ~một nửa số đoạn), bỏ đoạn suy biến độ dài 0
        const p0 = new Float32Array(ne * 4); let k = 0; const seen = new Set(); const P = pack.pts;
        for (let r = 0; r < pack.ringStart.length - 1; r++) {
          const s = pack.ringStart[r], e = pack.ringStart[r + 1];
          for (let i = s; i < e; i++) {
            const j = i + 1 < e ? i + 1 : s; const x0 = P[2 * i], y0 = P[2 * i + 1], x1 = P[2 * j], y1 = P[2 * j + 1];
            if (x0 === x1 && y0 === y1) continue;
            const key = x0 < x1 || (x0 === x1 && y0 < y1) ? `${x0},${y0},${x1},${y1}` : `${x1},${y1},${x0},${y0}`;
            if (seen.has(key)) continue; seen.add(key);
            p0[k++] = pos[2 * i]; p0[k++] = pos[2 * i + 1]; p0[k++] = pos[2 * j]; p0[k++] = pos[2 * j + 1];
          }
        }
        ne = k / 4;
        // chia ô lưới 14×14 theo vị trí đoạn, sắp các đoạn theo ô → chỉ vẽ những ô nằm trong khung nhìn (zoom gần = vẽ rất ít đoạn)
        const G = 14; let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (let i = 0; i < ne; i++) { const x = p0[4 * i], y = p0[4 * i + 1]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        const cid = new Uint16Array(ne), cnt = new Uint32Array(G * G + 1);
        for (let i = 0; i < ne; i++) { const mx = (p0[4 * i] + p0[4 * i + 2]) / 2, my = (p0[4 * i + 1] + p0[4 * i + 3]) / 2; const gx = Math.min(G - 1, Math.floor(((mx - bx0) / (bx1 - bx0 || 1)) * G)), gy = Math.min(G - 1, Math.floor(((my - by0) / (by1 - by0 || 1)) * G)); cid[i] = gy * G + gx; cnt[cid[i] + 1]++; }
        for (let c = 0; c < G * G; c++) cnt[c + 1] += cnt[c];
        const fill = cnt.slice(0, G * G), sorted = new Float32Array(ne * 4); const cells = [];
        for (let c = 0; c < G * G; c++) if (cnt[c + 1] > cnt[c]) cells.push({ off: cnt[c], n: cnt[c + 1] - cnt[c], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
        const cellIdx = new Int32Array(G * G).fill(-1); { let ci = 0; for (let c = 0; c < G * G; c++) if (cnt[c + 1] > cnt[c]) cellIdx[c] = ci++; }
        for (let i = 0; i < ne; i++) {
          const c = cid[i], o = fill[c]++; sorted.set(p0.subarray(4 * i, 4 * i + 4), 4 * o); const cl = cells[cellIdx[c]];
          for (let t = 0; t < 2; t++) { const x = p0[4 * i + 2 * t], y = p0[4 * i + 2 * t + 1]; if (x < cl.x0) cl.x0 = x; if (x > cl.x1) cl.x1 = x; if (y < cl.y0) cl.y0 = y; if (y > cl.y1) cl.y1 = y; }
        }
        out.cells = cells; out.segData = sorted;
        out.seg = buf(gl.ARRAY_BUFFER, out.segData); out.nSeg = ne; delete out.segData;
      }
      return out;
    };
    const rows = this.rows;
    this.gP = mkPack(P, (f) => colTD(rows[f][4]), 'thick');
    this.zoneCol = Array.from({ length: qh.code.length }, (_, z) => colQH(qh.meta.codes[qh.code[z]][0]));
    this.gQ = mkPack(qh, (z) => this.zoneCol[z], 'thick');
    this.corner = buf(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.vaos = {};
    // VAO tô thửa / tô quy hoạch
    for (const [name, g] of [['fillP', this.gP], ['fillQ', this.gQ]]) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.enableVertexAttribArray(this.pF.a.aPos); gl.vertexAttribPointer(this.pF.a.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.col); gl.enableVertexAttribArray(this.pF.a.aCol); gl.vertexAttribPointer(this.pF.a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idx); this.vaos[name] = vao;
    }
    for (const g of [this.gP, this.gQ]) for (const cell of g.cells) { // mỗi ô lưới một VAO trỏ tới đúng đoạn buffer của ô đó
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const a = this.pA.a;
      gl.bindBuffer(gl.ARRAY_BUFFER, g.seg);
      gl.enableVertexAttribArray(a.aP0); gl.vertexAttribPointer(a.aP0, 2, gl.FLOAT, false, 16, cell.off * 16); gl.vertexAttribDivisor(a.aP0, 1);
      gl.enableVertexAttribArray(a.aP1); gl.vertexAttribPointer(a.aP1, 2, gl.FLOAT, false, 16, cell.off * 16 + 8); gl.vertexAttribDivisor(a.aP1, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.corner); gl.enableVertexAttribArray(a.aCorner); gl.vertexAttribPointer(a.aCorner, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(a.aCorner, 0);
      cell.vao = vao;
    }
    gl.bindVertexArray(null);
  }
  drawGL() {
    const { gl, GW: W, GH: H, state } = this; const s = this.scale; const k = this.intro;
    if (this.glLost || gl.isContextLost()) return;
    gl.viewport(0, 0, this.glc.width, this.glc.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const uS = [(2 * s) / W, (-2 * s) / H], uC = [this.cx, this.cy];
    if (state.hientrang) {
      gl.useProgram(this.pF.p); gl.uniform2f(this.pF.u.uC, uC[0], uC[1]); gl.uniform2f(this.pF.u.uS, uS[0], uS[1]); gl.uniform1f(this.pF.u.uA, state.opacity * k);
      gl.bindVertexArray(this.vaos.fillP); gl.drawElements(gl.TRIANGLES, this.gP.nTri, gl.UNSIGNED_INT, 0);
    }
    const gd = this.gdpr; const aa = 1 / gd; // 1 điểm ảnh thiết bị tính bằng px CSS
    const hx = W / (2 * s) + 4 / s, hy = H / (2 * s) + 4 / s; // nửa khung nhìn (toạ độ bản đồ) + lề 4px
    const drawCells = (g) => { for (const c of g.cells) { if (c.x1 < this.cx - hx || c.x0 > this.cx + hx || c.y1 < this.cy - hy || c.y0 > this.cy + hy) continue; gl.bindVertexArray(c.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, c.n); } };
    const lineU = (w, r, g, b, al) => { const u = this.pA.u; gl.useProgram(this.pA.p); gl.uniform2f(u.uC, uC[0], uC[1]); gl.uniform1f(u.uScale, s); gl.uniform2f(u.uWH, W, H); gl.uniform1f(u.uW, w); gl.uniform1f(u.uAA, aa); gl.uniform4f(u.uK, r, g, b, al); };
    if (state.diachinh) {
      const lowZ = clamp((this.z - 12.5) / 2.2, 0.2, 1);
      lineU(clamp(1 + (this.z - 14) * 0.18, 1, 1.9) * aa, 35 / 255, 35 / 255, 35 / 255, 1.0 * lowZ * k); // (ranh chung vẽ 1 lần nên alpha 1,0 ≈ độ đậm cũ khi vẽ chồng 2 lần) bề rộng 1–1,9 điểm ảnh thiết bị
      drawCells(this.gP);
    }
    if (state.quyhoach) {
      gl.useProgram(this.pF.p); gl.uniform1f(this.pF.u.uA, state.opacityQh * k);
      gl.bindVertexArray(this.vaos.fillQ); gl.drawElements(gl.TRIANGLES, this.gQ.nTri, gl.UNSIGNED_INT, 0);
      lineU(Math.max(clamp(0.6 + (this.z - 12) * 0.12, 0.6, 1.3), 1.1 * aa), 1, 0, 0, 1);
      drawCells(this.gQ);
    }
    gl.bindVertexArray(null);
  }

  /* ---------- tạo đường vẽ (chỉ cho thửa/vùng đang chọn) ---------- */
  ringsPath(pack, k, into) {
    const p = into || new Path2D(); const q = this.q;
    const { pts, ringStart, featRing } = pack;
    for (let r = featRing[k]; r < featRing[k + 1]; r++) {
      const s = ringStart[r], e = ringStart[r + 1];
      p.moveTo(pts[2 * s] / q, -pts[2 * s + 1] / q);
      for (let i = s + 1; i < e; i++) p.lineTo(pts[2 * i] / q, -pts[2 * i + 1] / q);
      p.closePath();
    }
    return p;
  }
  cached(key, make) {
    let v = this.pathCache.get(key);
    if (!v) { v = make(); this.pathCache.set(key, v); if (this.pathCache.size > 120) this.pathCache.delete(this.pathCache.keys().next().value); }
    return v;
  }

  /* ---------- lưới tìm thửa dưới con trỏ ---------- */
  buildGrid() {
    const { P } = this.D; const q = this.q; const N = P.bbox.length / 4;
    const cell = 150; const { x0, x1, y0, y1 } = this.bb;
    const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1;
    const cells = Array.from({ length: nx * ny }, () => []);
    for (let i = 0; i < N; i++) {
      const bx0 = P.bbox[4 * i] / q, by0 = -P.bbox[4 * i + 3] / q, bx1 = P.bbox[4 * i + 2] / q, by1 = -P.bbox[4 * i + 1] / q;
      const gx0 = Math.floor((bx0 - x0) / cell), gx1 = Math.floor((bx1 - x0) / cell);
      const gy0 = Math.floor((by0 - y0) / cell), gy1 = Math.floor((by1 - y0) / cell);
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) cells[gy * nx + gx].push(i);
    }
    this.grid = { cell, nx, ny, cells };
  }
  inside(pack, k, x, y) { // x, y mét (y xuống); even-odd trên mọi vòng
    const q = this.q; const { pts, ringStart, featRing } = pack; let c = false;
    for (let r = featRing[k]; r < featRing[k + 1]; r++) {
      const s = ringStart[r], e = ringStart[r + 1];
      for (let i = s, j = e - 1; i < e; j = i++) {
        const xi = pts[2 * i] / q, yi = -pts[2 * i + 1] / q, xj = pts[2 * j] / q, yj = -pts[2 * j + 1] / q;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
    }
    return c;
  }
  /** Mọi thửa chứa điểm (x, y), nhỏ nhất trước — để chọn được cả những thửa chồng lên nhau. */
  pickAll(x, y) {
    const { P } = this.D; const q = this.q; const g = this.grid; const { x0, y0 } = this.bb;
    const gx = Math.floor((x - x0) / g.cell), gy = Math.floor((y - y0) / g.cell);
    if (gx < 0 || gy < 0 || gx >= g.nx || gy >= g.ny) return [];
    const out = [];
    for (const i of g.cells[gy * g.nx + gx]) {
      if (x < P.bbox[4 * i] / q || x > P.bbox[4 * i + 2] / q || y < -P.bbox[4 * i + 3] / q || y > -P.bbox[4 * i + 1] / q) continue;
      if (this.inside(P, i, x, y)) out.push([i, (P.bbox[4 * i + 2] - P.bbox[4 * i]) * (P.bbox[4 * i + 3] - P.bbox[4 * i + 1])]);
    }
    return out.sort((a, b) => a[1] - b[1]).map((o) => o[0]);
  }
  pick(x, y) { return this.pickAll(x, y)[0] ?? -1; }
  pickZone(x, y) {
    const { qh } = this.D; const q = this.q;
    for (let i = qh.code.length - 1; i >= 0; i--) {
      if (x < qh.bbox[4 * i] / q || x > qh.bbox[4 * i + 2] / q || y < -qh.bbox[4 * i + 3] / q || y > -qh.bbox[4 * i + 1] / q) continue;
      if (this.inside(qh, i, x, y)) return i;
    }
    return -1;
  }
  parcelBounds(i) { const q = this.q; const b = this.D.P.bbox; return { x0: b[4 * i] / q, x1: b[4 * i + 2] / q, y0: -b[4 * i + 3] / q, y1: -b[4 * i + 1] / q }; }
  parcelCenter(i) { const b = this.parcelBounds(i); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }
  /** Điểm đặt nhãn: trọng tâm tam giác lớn nhất trong phép chia tam giác của thửa (luôn nằm trong thửa). */
  labelPoint(i) { const L = this.D.P.lab, q = this.q; return { x: L[2 * i] / q, y: -L[2 * i + 1] / q }; }

  /* ---------- camera ---------- */
  get scale() { return (256 * 2 ** this.z) / TILE_WORLD; }
  toScreen(x, y) { const s = this.scale; return [(x - this.cx) * s + this.W / 2, (y - this.cy) * s + this.H / 2]; }
  toWorld(px, py) { const s = this.scale; return [(px - this.W / 2) / s + this.cx, (py - this.H / 2) / s + this.cy]; }
  lonLatAt(x, y) { return relToLonLat(this.D.meta, x, -y); }
  vnAt(x, y) { const ll = this.lonLatAt(x, y); return wgsToVN(ll.lat, ll.lon); }
  clampView() {
    const b = this.bb; const mx = (b.x1 - b.x0) * 0.25, my = (b.y1 - b.y0) * 0.25;
    this.cx = clamp(this.cx, b.x0 - mx, b.x1 + mx); this.cy = clamp(this.cy, b.y0 - my, b.y1 + my);
    this.z = clamp(this.z, this.cfg.BAN_DO.ZOOM_NHO_NHAT, this.cfg.BAN_DO.ZOOM_LON_NHAT);
  }
  /** Zoom quanh con trỏ, có quán tính (tiến dần về mức zoom đích). */
  zoomAt(px, py, dz, instant = false) {
    const base = this.zt ? this.zt.z : this.z;
    const tz = clamp(base + dz, this.cfg.BAN_DO.ZOOM_NHO_NHAT, this.cfg.BAN_DO.ZOOM_LON_NHAT);
    const [wx, wy] = this.toWorld(px, py);
    this.zt = { z: tz, px, py, wx, wy };
    if (instant) { this.applyZoom(tz); this.zt = null; }
    this.invalidate();
  }
  applyZoom(z) {
    const a = this.zt; this.z = z; if (!a) return;
    const s = this.scale; this.cx = a.wx - (a.px - this.W / 2) / s; this.cy = a.wy - (a.py - this.H / 2) / s; this.clampView();
  }
  panBy(dx, dy) { const s = this.scale; this.cx -= dx / s; this.cy -= dy / s; this.clampView(); this.invalidate(); }
  /** Bay camera tới (cx, cy, z) trong dur ms. */
  flyTo(cx, cy, z, dur = 420) {
    this.zt = null; this.vel.x = this.vel.y = 0;
    this.anim = { t0: performance.now(), dur, a: { cx: this.cx, cy: this.cy, z: this.z }, b: { cx, cy, z } };
    this.invalidate();
  }
  fitBounds(b, { pad = {}, maxZoom = 19.5, minZoom, animate = false } = {}) {
    this.zt = null; this.anim = null; this.a0 = { cx: this.cx, cy: this.cy, z: this.z };
    const p = { l: 0, r: 0, t: 0, b: 0, ...pad };
    const aw = Math.max(80, this.W - p.l - p.r), ah = Math.max(80, this.H - p.t - p.b);
    const s = Math.min(aw / Math.max(1, b.x1 - b.x0), ah / Math.max(1, b.y1 - b.y0));
    this.z = clamp(Math.log2((s * TILE_WORLD) / 256), minZoom ?? this.cfg.BAN_DO.ZOOM_NHO_NHAT, maxZoom);
    const s2 = this.scale;
    this.cx = (b.x0 + b.x1) / 2 - (p.l - p.r) / 2 / s2; this.cy = (b.y0 + b.y1) / 2 - (p.t - p.b) / 2 / s2;
    this.clampView();
    if (animate) { const to = { cx: this.cx, cy: this.cy, z: this.z }; this.cx = this.a0.cx; this.cy = this.a0.cy; this.z = this.a0.z; this.flyTo(to.cx, to.cy, to.z); } else this.invalidate();
  }
  centerOn(x, y, pad = {}, animate = false) {
    this.zt = null; this.anim = null; const s = this.scale; const nx = x - ((pad.l || 0) - (pad.r || 0)) / 2 / s, ny = y - ((pad.t || 0) - (pad.b || 0)) / 2 / s;
    if (animate) { this.flyTo(nx, ny, this.z, 320); return; }
    this.cx = nx; this.cy = ny; this.clampView(); this.invalidate();
  }
  mpp() { const lat = relToLonLat(this.D.meta, this.cx, -this.cy).lat; return Math.cos(lat * RAD) / this.scale; }
  scaleBar() {
    const mpp = this.mpp();
    const max = mpp * 140; const pow = 10 ** Math.floor(Math.log10(max)); const m = [5, 2, 1].map((k) => k * pow).find((v) => v <= max) || pow;
    return { px: m / mpp, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
  }

  /* ---------- trạng thái lớp ---------- */
  set(patch) { Object.assign(this.state, patch); this.invalidate(true); }
  setSelected(i) { this.sel = i; this.selT0 = performance.now(); this.invalidate(false); }
  setZone(i) { this.zone = i; this.invalidate(false); }
  /** Thửa đang "chạy qua" trong chế độ Ngẫu nhiên (tô đỏ + vòng nhắm để thấy cả khi thửa rất nhỏ). */
  setFlash(i) { this.flash = i; this.invalidate(false); }
  setHighlight(set) {
    this.hl = set;
    if (set && set.size) { this.hlPath = new Path2D(); for (const i of set) this.ringsPath(this.D.P, i, this.hlPath); } else this.hlPath = null;
    this.invalidate();
  }
  setCT(ct) { this.ct = ct; this.invalidate(); }
  addRipple(x, y) { this.ripples.push({ x, y, t: performance.now() }); this.invalidate(false); }

  /* ---------- vòng lặp vẽ: chỉ chạy khi cần ---------- */
  invalidate(full = false) {
    this.dirty = true; this.needOver = true; if (full) this.needGL = true;
    // Chỉ MỘT vòng lặp vẽ. Trước đây panBy() (quán tính) gọi invalidate() ngay trong frame() lúc this.raf đã về 0 → đăng ký thêm một vòng, rồi cuối frame() đăng ký tiếp: số vòng lặp nhân đôi mỗi khung → bản đồ vẽ hàng trăm lần/khung và quán tính bị cộng dồn (lỗi lag khi thả lúc đang kéo).
    if (this.inFrame) { this.again = true; return; }
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  frame(now) {
    this.raf = 0; this.inFrame = true; this.again = false;
    try { this.frameBody(now); } finally { this.inFrame = false; }
  }
  frameBody(now) {
    let busy = false; const c0 = this.cx, c1 = this.cy, c2 = this.z;
    if (this.vel.x || this.vel.y) { // quán tính khi kéo
      // quán tính theo thời gian thực (không phụ thuộc số khung hình): vận tốc px/ms, giảm dần theo hàm mũ
      const dt = Math.min(48, Math.max(1, now - (this.lastFrame || now - 16)));
      this.panBy(this.vel.x * dt, this.vel.y * dt); const k = Math.exp(-dt / 360); this.vel.x *= k; this.vel.y *= k;
      if (Math.hypot(this.vel.x, this.vel.y) < 0.015) this.vel.x = this.vel.y = 0; else busy = true;
    }
    if (this.zt) {
      const d = this.zt.z - this.z;
      if (Math.abs(d) < 0.004) { this.applyZoom(this.zt.z); this.zt = null; } else { this.applyZoom(this.z + d * 0.3); busy = true; }
    }
    if (this.anim) {
      const a = this.anim; const t = clamp((now - a.t0) / a.dur, 0, 1); const e = 1 - (1 - t) ** 3;
      this.cx = a.a.cx + (a.b.cx - a.a.cx) * e; this.cy = a.a.cy + (a.b.cy - a.a.cy) * e; this.z = a.a.z + (a.b.z - a.a.z) * e; this.clampView();
      if (t >= 1) this.anim = null; else busy = true;
    }
    const pc = this.pc; const camChanged = !pc || pc[0] !== this.cx || pc[1] !== this.cy || pc[2] !== this.z; this.pc = [this.cx, this.cy, this.z];
    if (camChanged) { this.lastMove = now; this.needOver = true; }
    const moving = now - (this.lastMove || -1e9) < 110;
    // lớp GPU/nền: chỉ vẽ lại khi cần (đổi lớp/độ trong suốt) hoặc khi camera dừng; trong lúc kéo/zoom chỉ dịch + co bằng CSS
    const bc = this.bc; const k = bc ? this.scale / ((256 * 2 ** bc.z) / TILE_WORLD) : 1;
    const tx = bc ? (bc.cx - this.cx) * this.scale : 0, ty = bc ? (bc.cy - this.cy) * this.scale : 0;
    const covX = (this.GW * k - this.W) / 2 * 0.92, covY = (this.GH * k - this.H) / 2 * 0.92;
    const differs = !bc || bc.cx !== this.cx || bc.cy !== this.cy || bc.z !== this.z;
    const bad = differs && (Math.abs(tx) > covX || Math.abs(ty) > covY || k > 1.8 || k < 0.6);
    // chỉ dịch ngang/dọc (cùng mức zoom): ảnh đã vẽ vẫn sắc nét, không cần vẽ lại cho tới khi gần hết lề đệm
    const pure = differs && bc && bc.z === this.z && Math.abs(tx) < covX * 0.5 && Math.abs(ty) < covY * 0.5;
    // ô vệ tinh tải xong: gộp lại, tối đa ~8 lần vẽ lại/giây (3 lần/giây khi đang kéo) thay vì vẽ lại cả khung rộng cho từng ô
    let staleNow = false;
    if (this.bgStale) {
      if (now - (this.lastBgDraw || 0) > (moving ? 300 : 120)) staleNow = true;
      else if (!this.staleTimer) this.staleTimer = setTimeout(() => { this.staleTimer = 0; this.invalidate(); }, 130);
    }
    if (this.fading && now - (this.lastBgDraw || 0) > 30) staleNow = true; // ô vệ tinh đang hiện dần
    if (this.needGL || !this.bgDone || staleNow || (differs && !pure && (!moving || bad))) {
      this.lastBgDraw = now;
      this.renderBg(); this.drawGL(); this.bc = { cx: this.cx, cy: this.cy, z: this.z }; this.needGL = this.bgStale = false;
      this.bg.style.transform = this.glc.style.transform = '';
    } else if (differs || this.glc.style.transform) {
      this.bg.style.transform = this.glc.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${k})`;
    }
    const redraw = this.needOver || camChanged;
    if (redraw || this.ripples.length || this.intro < 1 || this.measure) { this.renderOver(now, moving); this.needOver = false; }
    this.renderAnim(now, redraw);
    this.dirty = false; this.lastFrame = now;
    this.emit('frame');
    if (this.pendingHover && !this.pointers.size && !this.camMoving()) { const ev = this.pendingHover; this.pendingHover = null; this.onHoverMove(ev); } // camera dừng: dò thửa dưới con trỏ đúng một lần
    const live = this.sel >= 0 || this.zone >= 0 || moving || !!this.pendingHover || !!this.fading;
    if ((busy || live || this.ripples.length || this.intro < 1 || this.again) && !this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  resize() {
    const r = this.root.getBoundingClientRect(); const nw = Math.max(1, r.width), nh = Math.max(1, r.height), nd = Math.min(window.devicePixelRatio || 1, 2);
    if (this.W === nw && this.H === nh && this.dpr === nd && this.bg.width) return; // ResizeObserver bắn cả khi không đổi kích thước: tránh cấp phát lại canvas
    this.W = nw; this.H = nh; this.dpr = nd; this.rect = r;
    for (const c of [this.an, this.ov]) { c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr); }
    // nền + GPU vẽ vào khung rộng hơn màn hình (mỗi bên 20%): kéo/zoom chỉ dịch/co ảnh bằng CSS, vẽ lại một lần khi dừng
    const M = this.M = 0; // 0: canvas GPU đúng bằng màn hình, vẽ lại trực tiếp mỗi khung khi camera đổi (rẻ với GPU) — không còn canvas to dịch bằng CSS rồi vẽ lại giật cục
     this.GW = Math.round(this.W * (1 + 2 * M)); this.GH = Math.round(this.H * (1 + 2 * M)); this.mx = (this.GW - this.W) / 2; this.my = (this.GH - this.H) / 2;
    // khung nền/GPU rộng 1,6 lần màn hình: giới hạn tổng số điểm ảnh (~12 triệu) để không tràn bộ nhớ GPU (nguyên nhân crash trên màn hình lớn/mật độ cao)
    this.gdpr = Math.min(this.dpr, Math.sqrt(12e6 / (this.GW * this.GH)));
    for (const c of [this.bg, this.glc]) {
      c.width = Math.round(this.GW * this.gdpr); c.height = Math.round(this.GH * this.gdpr);
      Object.assign(c.style, { inset: 'auto', left: `${-this.mx}px`, top: `${-this.my}px`, width: `${this.GW}px`, height: `${this.GH}px`, maxWidth: 'none', maxHeight: 'none' });
    }
    this.bc = null; this.invalidate(true);
  }

  /* ---------- nền: giấy + ô vệ tinh ---------- */
  renderBg() {
    const { bgx: ctx, GW: W, GH: H, gdpr: dpr, state } = this; this.bgDone = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = state.basemap === 'sat' ? '#27332e' : PAPER; ctx.fillRect(0, 0, W, H); // nền vệ tinh: tối trung tính, ô chưa về không chớp màu giấy sáng
    this.fading = false;
    if (state.basemap === 'sat') this.drawTiles(ctx); // ảnh vệ tinh: giữ nguyên, không phủ hạt
    else { // nền Giấy: hạt giấy nằm DƯỚI lớp thửa (lớp GPU vẽ sau trên canvas khác) nên màu thửa không bị hạt làm bẩn
      this.grainPat ||= ctx.createPattern(grainTile(), 'repeat');
      ctx.fillStyle = this.grainPat; ctx.fillRect(0, 0, W, H);
    }
  }
  src() { return this.cfg.BAN_DO.VE_TINH; }
  tileImg(z, x, y) {
    const key = `${z}/${x}/${y}`; let t = this.tiles.get(key);
    if (t) return t;
    t = { img: new Image(), ok: false, bad: false, t1: 0 }; this.tiles.set(key, t);
    t.img.referrerPolicy = 'no-referrer'; t.img.decoding = 'async';
    // chỉ coi là sẵn sàng sau khi đã GIẢI MÃ xong (decode) — nếu không, lần vẽ đầu phải giải mã ngay trên luồng chính gây khựng/chớp
    const done = () => { if (t.ok || t.bad) return; t.ok = true; t.t1 = performance.now(); this.bgStale = true; this.invalidate(); };
    t.img.onload = () => { if (t.img.decode) t.img.decode().then(done, done); else done(); };
    t.img.onerror = () => { t.bad = true; if (!this._tileWarn) { this._tileWarn = true; this.emit('tile-error'); } };
    t.img.src = this.src().url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    if (this.tiles.size > 420) { const k = this.tiles.keys().next().value; this.tiles.delete(k); }
    return t;
  }
  /** Ô chưa tải: vẽ tạm từ ô cấp thấp hơn (cha, tới 5 cấp) hoặc ghép từ 4 ô con đã có (khi thu nhỏ) — không để lộ nền trống. */
  drawFallback(ctx, Z, txw, ty, X, Y, tm, pad) {
    for (let up = 1; up <= 5 && Z - up >= 3; up++) {
      const f = 2 ** up; const pt = this.tiles.get(`${Z - up}/${Math.floor(txw / f)}/${Math.floor(ty / f)}`);
      if (pt?.ok) { const sw = 256 / f; ctx.drawImage(pt.img, ((txw % f) / f) * 256, ((ty % f) / f) * 256, sw, sw, X, Y, tm + pad, tm + pad); return true; }
    }
    let any = false; const h = tm / 2;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const ct = this.tiles.get(`${Z + 1}/${txw * 2 + dx}/${ty * 2 + dy}`);
      if (ct?.ok) { ctx.drawImage(ct.img, X + dx * h, Y + dy * h, h + pad, h + pad); any = true; }
    }
    return any;
  }
  drawTiles(ctx) {
    const s = this.scale; const maxN = this.src().zoomToiDa; const now = performance.now(); let fading = false;
    const Z = clamp(Math.round(this.z), 3, maxN); const tm = TILE_WORLD / 2 ** Z; const o = this.D.meta.origin;
    const [wx0, wy0] = this.toWorld(-this.mx, -this.my), [wx1, wy1] = this.toWorld(this.W + this.mx, this.H + this.my);
    const tx0 = Math.floor((HALF + o.mx + wx0) / tm), tx1 = Math.floor((HALF + o.mx + wx1) / tm);
    const ty0 = Math.floor((HALF - o.my + wy0) / tm), ty1 = Math.floor((HALF - o.my + wy1) / tm);
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 120) return;
    const gd = this.gdpr; ctx.setTransform(gd * s, 0, 0, gd * s, gd * (this.GW / 2 - this.cx * s), gd * (this.GH / 2 - this.cy * s));
    ctx.imageSmoothingQuality = 'medium'; const pad = 0.6 / s; const n = 2 ** Z;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (ty < 0 || ty >= n) continue; const txw = ((tx % n) + n) % n;
      const X = tx * tm - HALF - o.mx, Y = ty * tm - HALF + o.my;
      const t = this.tileImg(Z, txw, ty);
      const a = t.ok ? Math.min(1, (now - t.t1) / 220) : 0; // ô mới về hiện dần (không bật hẳn lên) trên nền ô cấp khác
      if (a < 1) this.drawFallback(ctx, Z, txw, ty, X, Y, tm, pad);
      if (t.ok) { if (a < 1) { ctx.globalAlpha = a; fading = true; } ctx.drawImage(t.img, X, Y, tm + pad, tm + pad); ctx.globalAlpha = 1; }
    }
    this.fading = fading;
    // tải trước cấp kế bên (thu nhỏ: cả khung; phóng to: 2x2 quanh tâm) để lần zoom đầu tiên không phải chờ ô
    if (Z - 1 >= 3) { for (let ty = Math.max(0, ty0 >> 1); ty <= Math.min(n / 2 - 1, ty1 >> 1); ty++) for (let tx = tx0 >> 1; tx <= tx1 >> 1; tx++) this.tileImg(Z - 1, ((tx % (n / 2)) + n / 2) % (n / 2), ty); }
    if (Z + 1 <= maxN) { const cx = Math.floor((HALF + o.mx + this.cx) / tm * 2), cy = Math.floor((HALF - o.my + this.cy) / tm * 2); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.tileImg(Z + 1, ((cx + dx) % (2 * n) + 2 * n) % (2 * n), cy + dy); }
  }

  /* ---------- lưới VN-2000: dấu + tại giao điểm, nhãn X (Bắc) / Y (Đông) ở mép ---------- */
  vnGrid() {
    const W = this.W, H = this.H; const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([px, py]) => { const [x, y] = this.toWorld(px, py); return this.vnAt(x, y); });
    const xs = corners.map((c) => c.X), ys = corners.map((c) => c.Y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mpp = this.mpp(); const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    const step = steps.find((v) => v / mpp >= 130) || steps[steps.length - 1];
    const pts = []; const meta = this.D.meta;
    const iy0 = Math.floor(y0 / step), iy1 = Math.ceil(y1 / step), ix0 = Math.floor(x0 / step), ix1 = Math.ceil(x1 / step);
    if ((iy1 - iy0 + 1) * (ix1 - ix0 + 1) > 600) return null;
    for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) {
      const X = ix * step, Y = iy * step; const key = `${X},${Y}`; let p = this.gridCache.get(key);
      if (!p) { const ll = vnToWgs(X, Y); const r = lonLatToRel(meta, ll.lon, ll.lat); p = { x: r.x, y: -r.y }; if (this.gridCache.size > 8000) this.gridCache.clear(); this.gridCache.set(key, p); }
      const [sx, sy] = this.toScreen(p.x, p.y); pts.push({ X, Y, sx, sy, ix, iy });
    }
    return { pts, step };
  }

  /* ---------- lớp động ---------- */
  renderOver(now, moving = false) {
    const c = this.octx, { W, H, dpr } = this; const s = this.scale; const sat = this.state.basemap === 'sat';
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    this.drawGridMarks(c, sat);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - this.cx * s), dpr * (H / 2 - this.cy * s));
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (this.hlPath) { c.globalAlpha = 0.34; c.fillStyle = RED; c.fill(this.hlPath, 'evenodd'); c.globalAlpha = 1; c.strokeStyle = RED; c.lineWidth = 1.6 / s; c.stroke(this.hlPath); }
    if (this.hover >= 0 && this.hover !== this.sel) {
      const p = this.cached(`p${this.hover}`, () => this.ringsPath(this.D.P, this.hover));
      c.fillStyle = 'rgba(146,43,50,.18)'; c.fill(p, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 1.8 / s; c.stroke(p);
    }
    if (this.hoverZ >= 0 && this.hoverZ !== this.zone) { const p = this.cached(`z${this.hoverZ}`, () => this.ringsPath(this.D.qh, this.hoverZ)); c.fillStyle = 'rgba(146,43,50,.16)'; c.fill(p, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 1.8 / s; c.stroke(p); }
    if (this.flash >= 0) { const p = this.cached(`p${this.flash}`, () => this.ringsPath(this.D.P, this.flash)); c.fillStyle = 'rgba(146,43,50,.55)'; c.fill(p, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 2.2 / s; c.stroke(p); }
    if (this.sel >= 0) this.drawSelected(c, s, now);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.flash >= 0) { const fc = this.parcelCenter(this.flash); const [fx, fy] = this.toScreen(fc.x, fc.y); c.beginPath(); c.arc(fx, fy, 16, 0, 7); c.lineWidth = 4; c.strokeStyle = PAPER; c.stroke(); c.lineWidth = 2; c.strokeStyle = RED; c.stroke(); }
    if (this.z >= 17 && this.state.diachinh) this.drawLabels(c, sat);
    // gợn sóng khi bấm
    const live = [];
    for (const r of this.ripples) {
      const t = (now - r.t) / 900; if (t >= 1) continue; live.push(r);
      const [sx, sy] = this.toScreen(r.x, r.y);
      for (let k = 0; k < 3; k++) {
        const tt = clamp(t * 1.25 - k * 0.14, 0, 1); if (tt <= 0) continue;
        c.beginPath(); c.arc(sx, sy, 6 + tt * 70, 0, Math.PI * 2);
        c.lineWidth = 2.2 * (1 - tt) + 0.4; c.strokeStyle = RED; c.globalAlpha = (1 - tt) * 0.85; c.stroke();
      }
    }
    c.globalAlpha = 1; this.ripples = live;
    this.drawMeasure(c); this.drawGPS(c); this.drawPin(c);
  }
  drawGridMarks(c, sat) {
    const g = this.vnGrid(); if (!g) return;
    const free = (x, y, w, h) => !(this.avoid || []).some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
    const W = this.W, H = this.H; c.lineCap = 'butt';
    const draw = (col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (const p of g.pts) { if (p.sx < -8 || p.sy < -8 || p.sx > W + 8 || p.sy > H + 8) continue; c.moveTo(p.sx - 5, p.sy); c.lineTo(p.sx + 5, p.sy); c.moveTo(p.sx, p.sy - 5); c.lineTo(p.sx, p.sy + 5); } c.stroke(); };
    draw(sat ? 'rgba(12,38,34,.55)' : 'rgba(243,232,211,.85)', 3.2); draw(sat ? PAPER : GREEN, 1.1);
    // nhãn ở mép: Y (Đông) dọc cạnh dưới, X (Bắc) dọc cạnh trái; chữ be viền tối ở mọi nền
    c.font = '700 10px Inter, system-ui, sans-serif'; c.lineJoin = 'round'; c.lineWidth = 3.4;
    const fg = PAPER, halo = 'rgba(2,40,34,.95)'; // kiểu chữ của nền vệ tinh (chữ be, viền tối) áp cho cả nền Giấy
    const put = (t, x, y) => { c.strokeStyle = halo; c.strokeText(t, x, y); c.fillStyle = fg; c.fillText(t, x, y); };
    const fmtV = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const band = this.band || [70, H - 40]; const cols = new Map(), rowsM = new Map();
    for (const p of g.pts) {
      if (p.sx > 30 && p.sx < W - 30 && p.sy > 0 && p.sy < H) { const o = cols.get(p.iy); if (!o || p.sy > o.sy) cols.set(p.iy, p); }
      if (p.sy > band[0] + 8 && p.sy < band[1] - 8 && p.sx > -400 && p.sx < W + 400) { const o = rowsM.get(p.ix); if (!o || Math.abs(p.sx) < Math.abs(o.sx)) rowsM.set(p.ix, p); }
    }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const p of cols.values()) { const t = `Y ${fmtV(p.Y)}`; const w = c.measureText(t).width; if (free(p.sx - w / 2 - 4, H - 24, w + 8, 14)) put(t, p.sx, H - 11); }
    c.textAlign = 'left';
    let drawn = 0;
    for (const p of rowsM.values()) { const t = `X ${fmtV(p.X)}`; const w = c.measureText(t).width; if (free(8, p.sy - 14, w + 6, 14)) { put(t, 9, p.sy - 4); drawn++; } }
    if (!drawn) { // không có hàng lưới nào trong vùng nhìn thấy (ví dụ điện thoại, thẻ thông tin che phần lớn bản đồ): ghi X tại giữa vùng nhìn thấy
      const my = (band[0] + band[1]) / 2; const [wx, wy] = this.toWorld(W / 2, my); const v = this.vnAt(wx, wy); const t = `X ${fmtV(v.X)}`;
      c.strokeStyle = halo; c.lineWidth = 3.6; c.beginPath(); c.moveTo(0, my); c.lineTo(8, my); c.stroke(); c.strokeStyle = fg; c.lineWidth = 1.2; c.stroke(); c.lineWidth = 3.4;
      put(t, 11, my + 3.5);
    }
  }
  /** Danh sách ứng viên nhãn trong một vùng rộng hơn khung nhìn (tính một lần, dùng lại khi kéo/zoom vào): sắp theo diện tích giảm dần. */
  labelCands() {
    const [wx0, wy0] = this.toWorld(0, 0), [wx1, wy1] = this.toWorld(this.W, this.H);
    const lc = this.lblCache;
    if (lc && wx0 >= lc.x0 && wx1 <= lc.x1 && wy0 >= lc.y0 && wy1 <= lc.y1) return lc.list;
    const mx = wx1 - wx0, my = wy1 - wy0; const x0 = wx0 - mx * 0.6, x1 = wx1 + mx * 0.6, y0 = wy0 - my * 0.6, y1 = wy1 + my * 0.6;
    const { P } = this.D; const q = this.q; const g = this.grid;
    const gx0 = Math.max(0, Math.floor((x0 - this.bb.x0) / g.cell)), gx1 = Math.min(g.nx - 1, Math.floor((x1 - this.bb.x0) / g.cell));
    const gy0 = Math.max(0, Math.floor((y0 - this.bb.y0) / g.cell)), gy1 = Math.min(g.ny - 1, Math.floor((y1 - this.bb.y0) / g.cell));
    const seen = new Set(); const list = [];
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      for (const i of g.cells[gy * g.nx + gx]) {
        if (seen.has(i)) continue; seen.add(i);
        const w = (P.bbox[4 * i + 2] - P.bbox[4 * i]) / q, hh = (P.bbox[4 * i + 3] - P.bbox[4 * i + 1]) / q;
        const lp = this.labelPoint(i); list.push({ i, x: lp.x, y: lp.y, w, hh, a: w * hh });
      }
    }
    list.sort((a, b) => b.a - a.a);
    this.lblCache = { x0, x1, y0, y1, list }; return list;
  }
  /** Nhãn dựng sẵn vào MỘT tấm atlas duy nhất (không tạo nhiều canvas — tránh tràn bộ nhớ GPU); đầy thì xóa và dựng lại dần. */
  sprite(text, font, fg, halo, px) {
    const key = `${text}|${font}|${fg}|${this.dpr}`; let sp = this.sprites.get(key); if (sp) return sp;
    const d = this.dpr; const m = this.sprM ||= document.createElement('canvas').getContext('2d'); m.font = font;
    const w = Math.ceil(m.measureText(text).width + 8), h = Math.ceil(px * 1.5 + 6); const pw = Math.ceil(w * d), ph = Math.ceil(h * d);
    let at = this.atlas; const SZ = 1536;
    if (!at) { const cv = document.createElement('canvas'); cv.width = cv.height = SZ; at = this.atlas = { cv, g: cv.getContext('2d'), x: 0, y: 0, rh: 0 }; }
    if (at.x + pw > SZ) { at.x = 0; at.y += at.rh; at.rh = 0; }
    if (at.y + ph > SZ) { at.g.clearRect(0, 0, SZ, SZ); at.x = at.y = at.rh = 0; this.sprites.clear(); }
    const g = at.g; g.save(); g.setTransform(d, 0, 0, d, at.x, at.y); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 3.2; g.strokeStyle = halo; g.fillStyle = fg; g.strokeText(text, w / 2, h / 2); g.fillText(text, w / 2, h / 2); g.restore();
    sp = { sx: at.x, sy: at.y, pw, ph, w, h }; at.x += pw; at.rh = Math.max(at.rh, ph); this.sprites.set(key, sp); return sp;
  }
  /** Nhãn số thửa luôn hiện (cả khi kéo/zoom): đặt tại điểm nhãn của thửa; chỉ thửa đủ lớn trên màn hình, tối đa 600 nhãn. */
  drawLabels(c, sat) {
    const s = this.scale; const W = this.W, H = this.H; const list = this.labelCands();
    const showArea = this.mpp() * 140 <= 30; // zoom tới mức thước tỉ lệ ~20 m: hiện thêm diện tích
    const px = this.z > 18.6 ? 12 : 10.5; const halo = 'rgba(12,38,34,.85)'; const fg = PAPER; // kiểu chữ của nền vệ tinh cho cả nền Giấy
    const f1 = `700 ${px}px Inter, system-ui, sans-serif`, f2 = `500 ${px - 1.5}px Inter, system-ui, sans-serif`; let n = 0;
    const ox = W / 2 - this.cx * s, oy = H / 2 - this.cy * s;
    // blit 1:1 và căn theo điểm ảnh thiết bị, tắt làm mịn: trước đây vẽ ở toạ độ lẻ/ép co giãn nên nhãn bị nhòe (khác chữ toạ độ vẽ thẳng bằng fillText)
    const d = this.dpr; c.imageSmoothingEnabled = false;
    const blit = (a, cx, cy) => { const w = a.pw / d, hh = a.ph / d; c.drawImage(this.atlas.cv, a.sx, a.sy, a.pw, a.ph, Math.round((cx - w / 2) * d) / d, Math.round((cy - hh / 2) * d) / d, w, hh); };
    for (const o of list) {
      const w = o.w * s, hh = o.hh * s; if (w < 38 || hh < 16) continue;
      const sx = o.x * s + ox, sy = o.y * s + oy; if (sx < -30 || sy < -20 || sx > W + 30 || sy > H + 20) continue;
      if (++n > 600) break;
      const two = showArea && hh >= 28; const y = two ? sy - px * 0.55 : sy;
      const a = this.sprite(String(this.rows[o.i][1]), f1, fg, halo, px); blit(a, sx, y);
      if (two) { const b2 = this.sprite(fmtArea(this.rows[o.i][2]), f2, fg, halo, px); blit(b2, sx, sy + px * 0.75); }
    }
    c.imageSmoothingEnabled = true;
  }
  drawSelected(c, s, now) {
    const P = this.D.P;
    const path = this.cached(`p${this.sel}`, () => this.ringsPath(P, this.sel));
    const ct = this.ct;
    if (ct && ct.ctStart[this.sel + 1] > ct.ctStart[this.sel]) {
      for (let k = ct.ctStart[this.sel]; k < ct.ctStart[this.sel + 1]; k++) {
        const pp = this.cached(`c${k}`, () => this.ringsPath(ct, k));
        c.globalAlpha = 0.85; c.fillStyle = colQH(ct.meta.codes[ct.code[k]][0]); c.fill(pp, 'evenodd');
        c.globalAlpha = 1; c.strokeStyle = PAPER; c.lineWidth = 1.2 / s; c.stroke(pp);
      }
    }
    // nét gạch chéo (như khắc bản đồ) cắt theo thửa
    c.save(); c.clip(path, 'evenodd'); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const b = this.parcelBounds(this.sel); const [ax, ay] = this.toScreen(b.x0, b.y0), [bx, by] = this.toScreen(b.x1, b.y1);
    c.strokeStyle = 'rgba(12,38,34,.5)'; c.lineWidth = 1; c.beginPath();
    for (let x = Math.floor(ax - (by - ay)); x < bx + 10; x += 7) { c.moveTo(x, by + 4); c.lineTo(x + (by - ay) + 8, ay - 4); }
    c.stroke(); c.restore();
    c.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * (this.W / 2 - this.cx * s), this.dpr * (this.H / 2 - this.cy * s));
  }
  /** Lớp nét chạy: viền thửa/vùng đang chọn luôn chuyển động nhẹ (chỉ vẽ một đường nên rất rẻ). */
  renderAnim(now, redraw = false) {
    const c = this.actx, { W, H, dpr } = this; const want = this.sel >= 0 || this.zone >= 0;
    if (!want) { if (this.animOn) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.an.width, this.an.height); this.animOn = false; } return; }
    if (!redraw && this.animOn && now - (this.lastAnim || 0) < 32) return; // ~30 khung/giây khi đứng yên
    this.lastAnim = now; this.animOn = true; const s = this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.an.width, this.an.height);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - this.cx * s), dpr * (H / 2 - this.cy * s));
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (this.zone >= 0) {
      const p = this.cached(`z${this.zone}`, () => this.ringsPath(this.D.qh, this.zone));
      c.strokeStyle = INK; c.lineWidth = 3 / s; c.setLineDash([8 / s, 5 / s]); c.lineDashOffset = -(now / 55) / s; c.stroke(p); c.setLineDash([]);
      c.strokeStyle = RED; c.lineWidth = 1.6 / s; c.stroke(p);
    }
    if (this.sel >= 0) {
      const path = this.cached(`p${this.sel}`, () => this.ringsPath(this.D.P, this.sel));
      const t = Math.min(now - (this.selT0 || 0), 1600) / 1000; const pulse = Math.max(0, 1 - t * 1.4);
      c.strokeStyle = PAPER; c.lineWidth = (5 + pulse * 6) / s; c.stroke(path);
      c.strokeStyle = RED; c.lineWidth = (2.6 + pulse * 2) / s; c.setLineDash([9 / s, 5 / s]); c.lineDashOffset = -(now / 55) / s; c.stroke(path); c.setLineDash([]);
    }
  }

  /* ---------- đo đạc: một bảng duy nhất, hiện cả chiều dài lẫn diện tích; có lùi từng điểm ---------- */
  startMeasure() { this.measure = { pts: [], done: false, cursor: null }; this.invalidate(); this.emit('measure', this.measureInfo()); }
  stopMeasure() { this.measure = null; this.invalidate(); this.emit('measure', null); }
  measureUndo() {
    const m = this.measure; if (!m) return;
    if (m.done) m.done = false; else m.pts.pop();
    this.invalidate(); this.emit('measure', this.measureInfo());
  }
  measureClear() { const m = this.measure; if (!m) return; m.pts = []; m.done = false; this.invalidate(); this.emit('measure', this.measureInfo()); }
  measureInfo() {
    const m = this.measure; if (!m) return null;
    const ll = m.pts.map((p) => this.lonLatAt(p.x, p.y));
    let len = 0; for (let i = 1; i < ll.length; i++) len += haversine(ll[i - 1], ll[i]);
    let area = null, perim = null;
    if (m.pts.length >= 3) {
      let a = 0; for (let i = 0; i < m.pts.length; i++) { const p = m.pts[i], n = m.pts[(i + 1) % m.pts.length]; a += p.x * n.y - n.x * p.y; }
      const cl = Math.cos(ll[0].lat * RAD); area = Math.abs(a / 2) * cl * cl;
      perim = len + haversine(ll[ll.length - 1], ll[0]);
    }
    const last = m.pts.length ? this.vnAt(m.pts.at(-1).x, m.pts.at(-1).y) : null;
    return { n: m.pts.length, length: len, area, perim, last, done: m.done };
  }
  measureClick(x, y) {
    const m = this.measure; if (!m || m.done) return;
    m.pts.push({ x, y }); this.invalidate(); this.emit('measure', this.measureInfo());
  }
  measureFinish() {
    const m = this.measure; if (!m || m.done) return;
    // nhấp đúp tạo thêm một điểm trùng: bỏ đi
    while (m.pts.length > 1 && Math.hypot(m.pts.at(-1).x - m.pts.at(-2).x, m.pts.at(-1).y - m.pts.at(-2).y) < 0.05) m.pts.pop();
    m.done = true; m.cursor = null; this.invalidate(); this.emit('measure', this.measureInfo());
  }
  drawMeasure(c) {
    const m = this.measure; if (!m || !m.pts.length) return;
    const sp = m.pts.map((p) => this.toScreen(p.x, p.y));
    const line = () => { c.beginPath(); sp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (!m.done && m.cursor) c.lineTo(m.cursor[0], m.cursor[1]); };
    if (sp.length >= 3) { c.beginPath(); sp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = 'rgba(146,43,50,.16)'; c.fill(); }
    c.setLineDash([]); line(); c.strokeStyle = PAPER; c.lineWidth = 5; c.stroke();
    c.setLineDash([8, 5]); line(); c.strokeStyle = RED; c.lineWidth = 2.2; c.stroke();
    if (sp.length >= 3) { c.beginPath(); c.moveTo(sp.at(-1)[0], sp.at(-1)[1]); c.lineTo(sp[0][0], sp[0][1]); c.setLineDash([2, 5]); c.lineWidth = 1.6; c.stroke(); }
    c.setLineDash([]);
    for (const [x, y] of sp) { c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fillStyle = PAPER; c.fill(); c.lineWidth = 2; c.strokeStyle = RED; c.stroke(); }
    c.font = '600 11px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i < m.pts.length; i++) {
      const a = this.lonLatAt(m.pts[i - 1].x, m.pts[i - 1].y), b = this.lonLatAt(m.pts[i].x, m.pts[i].y); const d = haversine(a, b);
      const t = d >= 1000 ? `${(d / 1000).toFixed(2).replace('.', ',')} km` : `${d.toFixed(1).replace('.', ',')} m`;
      const mx = (sp[i - 1][0] + sp[i][0]) / 2, my = (sp[i - 1][1] + sp[i][1]) / 2; const w = c.measureText(t).width + 10;
      c.fillStyle = INK; c.fillRect(mx - w / 2, my - 9, w, 18); c.fillStyle = PAPER; c.fillText(t, mx, my + 0.5);
    }
  }
  drawGPS(c) {
    if (!this.gps) return; const [x, y] = this.toScreen(this.gps.x, this.gps.y);
    const r = Math.max(8, this.gps.acc * this.scale);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = 'rgba(2,90,76,.14)'; c.fill(); c.strokeStyle = GREEN; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(x, y, 7, 0, 7); c.fillStyle = RED; c.fill(); c.lineWidth = 3; c.strokeStyle = PAPER; c.stroke();
  }
  drawPin(c) {
    if (!this.pin) return; const [x, y] = this.toScreen(this.pin.x, this.pin.y);
    c.strokeStyle = PAPER; c.lineWidth = 5; c.beginPath(); c.arc(x, y, 9, 0, 7); c.moveTo(x - 17, y); c.lineTo(x + 17, y); c.moveTo(x, y - 17); c.lineTo(x, y + 17); c.stroke();
    c.strokeStyle = RED; c.lineWidth = 2; c.stroke();
  }
  setPin(x, y) { this.pin = x == null ? null : { x, y }; this.invalidate(); }
  setGPS(x, y, acc) { this.gps = x == null ? null : { x, y, acc }; this.invalidate(); }

  /* ---------- nhập liệu ---------- */
  bind() {
    const el = this.ov; el.style.touchAction = 'none';
    let moved = 0, t0 = 0, last = null, lastT = 0, pinch = null;
    el.addEventListener('pointerdown', (e) => {
      this.emit('press'); el.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.vel.x = this.vel.y = 0; this.anim = null; this.pendingHover = null;
      if (this.pointers.size === 1) { moved = 0; t0 = performance.now(); last = { x: e.offsetX, y: e.offsetY }; lastT = t0; this.pv = { x: 0, y: 0 }; this.hist = []; }
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; moved = 99; }
      el.classList.add('grab');
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { this.queueHover(e); return; }
      const nx = e.offsetX, ny = e.offsetY;
      if (this.pointers.size === 2 && pinch) {
        p.x = nx; p.y = ny; const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.panBy(cx - pinch.cx, cy - pinch.cy); this.zoomAt(cx, cy, Math.log2(d / pinch.d), true); pinch = { d, cx, cy }; return;
      }
      const dx = nx - p.x, dy = ny - p.y; p.x = nx; p.y = ny; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 5) {
        this.panBy(dx, dy); const now = performance.now(); const dt = Math.max(1, now - lastT); lastT = now;
        (this.hist ||= []).push({ t: now, x: nx, y: ny }); while (this.hist.length > 2 && now - this.hist[0].t > 120) this.hist.shift();
        if (this.hover !== -1) { this.hover = -1; this.emit('hover', -1); }
      }
    });
    const up = (e) => {
      const had = this.pointers.has(e.pointerId); this.pointers.delete(e.pointerId); if (!had) return;
      if (this.pointers.size < 2) pinch = null;
      if (this.pointers.size === 0) {
        el.classList.remove('grab');
        const dt = performance.now() - t0;
        if (moved <= 5 && dt < 600 && e.type === 'pointerup') this.onClick(e.offsetX, e.offsetY, e);
        else if (e.type === 'pointerup' && moved > 5 && this.hist && this.hist.length > 1) {
          // vận tốc = quãng đường trong ~100 ms cuối; thả chậm hơn 140 ms thì coi như dừng
          const hs = this.hist, a0 = hs[0], b0 = hs.at(-1), span = Math.max(16, b0.t - a0.t);
          if (performance.now() - b0.t < 140) {
            let vx = (b0.x - a0.x) / span, vy = (b0.y - a0.y) / span; const sp = Math.hypot(vx, vy);
            if (sp > 0.12) { const m = Math.min(sp, 3.2) / sp; this.vel.x = vx * m; this.vel.y = vy * m; this.lastFrame = performance.now() - 16; this.invalidate(); }
          }
        }
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { this.hoverEv = this.pendingHover = null; if (this.hover !== -1 || this.hoverZ !== -1) { this.hover = -1; this.hoverZ = -1; this.emit('hover', -1); this.invalidate(false); } });
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.anim = null;
      const dz = clamp(-e.deltaY * (e.ctrlKey ? 0.012 : (e.deltaMode ? 0.05 : 0.0022)), -0.9, 0.9);
      this.zoomAt(e.offsetX, e.offsetY, dz);
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (this.measure && !this.measure.done) { this.measureFinish(); return; }
      this.zoomAt(e.offsetX, e.offsetY, 1);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  /** Rê chuột chỉ xử lý một lần mỗi khung hình (dò thửa + cập nhật DOM), không theo từng sự kiện (chuột 1000 Hz làm đơ). */
  queueHover(e) {
    this.hoverEv = { offsetX: e.offsetX, offsetY: e.offsetY, pointerType: e.pointerType };
    if (this.hoverRaf) return;
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0; const ev = this.hoverEv; this.hoverEv = null; if (!ev || this.pointers.size) return;
      if (this.camMoving()) { this.pendingHover = ev; this.invalidate(); return; } // đang trượt/zoom: bản đồ chạy dưới con trỏ, dò thửa + dựng tooltip mỗi khung là lãng phí (nguyên nhân lag khi thả lúc đang kéo)
      this.onHoverMove(ev);
    });
  }
  camMoving() { return !!(this.vel.x || this.vel.y || this.zt || this.anim || performance.now() - (this.lastMove || -1e9) < 110); }
  onHoverMove(e) {
    const [x, y] = this.toWorld(e.offsetX, e.offsetY);
    this.emit('coords', this.vnAt(x, y));
    if (this.measure && !this.measure.done) { this.measure.cursor = [e.offsetX, e.offsetY]; this.invalidate(false); return; }
    if (e.pointerType === 'touch') return;
    if (this.state.quyhoach) { // chế độ quy hoạch: tô vùng quy hoạch khi rê, nhưng vẫn báo cả thửa nằm bên dưới (để chọn/hiển thị được thửa)
      const z = this.pickZone(x, y); const all = this.pickAll(x, y);
      if (z !== this.hoverZ) { this.hoverZ = z; this.invalidate(false); }
      this.emit('hover', all[0] ?? -1, e.offsetX, e.offsetY, all.length, z); return;
    }
    const all = this.pickAll(x, y); const h = all[0] ?? -1;
    if (h !== this.hover) { this.hover = h; this.invalidate(false); }
    this.emit('hover', h, e.offsetX, e.offsetY, all.length, -1);
  }
  onClick(px, py, e) {
    const [x, y] = this.toWorld(px, py);
    if (this.measure && !this.measure.done) { this.measureClick(x, y); return; }
    this.addRipple(x, y);
    const all = this.pickAll(x, y); // luôn chọn được thửa; bật lớp quy hoạch thì báo thêm vùng quy hoạch tại điểm bấm
    this.emit('click', { x, y, px, py, parcel: all[0] ?? -1, parcels: all, zone: this.state.quyhoach ? this.pickZone(x, y) : -1 });
  }
}
