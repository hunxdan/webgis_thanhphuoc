// scene.js — cảnh 3D WebGL2 thuần: bốn tầng bản đồ dựng từ dữ liệu thật + 17.820 khối thửa đất "dựng lên như toà nhà"
// (dựng khối lăng trụ theo đúng hình thửa; chiều cao = log diện tích thửa; có chiều sâu, ánh sáng, đổ bóng góc). Shader gợn sóng theo con trỏ, biến dạng ảnh, tầng tách khi cuộn.
import { clamp, colTD, colQH } from './util.js';
import { bakeCanvas } from './bake.js';

/* ---------- toán 4x4 (cột trước) ---------- */
const M = {
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; },
  look(e, c, u) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map((v) => v / l);
    let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
  },
  mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  inv(a) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
      (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
      (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
      (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
  },
  apply(m, v) { const x = v[0], y = v[1], z = v[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]; },
};

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);

/* ---------- shader ---------- */
const VS_PLANE = `#version 300 es
in vec2 aUV; uniform mat4 uVP; uniform vec2 uSize; uniform float uY, uT, uWave; uniform vec3 uPtr; uniform vec2 uShift;
out vec2 vUV; out float vH;
void main(){
  vec3 p = vec3((aUV.x-.5)*uSize.x, uY, (aUV.y-.5)*uSize.y);
  float d = length(p.xz - uPtr.xz);
  float rip = uPtr.y * exp(-d*3.4) * sin(d*30. - uT*5.);
  float sw = .02 * sin(p.x*3.1 + uT*.6) * cos(p.z*2.7 + uT*.5) * uWave;
  p.y += rip*.06 + sw; vH = rip; vUV = aUV;
  gl_Position = uVP * vec4(p,1.); gl_Position.xy += uShift * gl_Position.w;
}`;
const FS_PLANE = `#version 300 es
precision highp float; in vec2 vUV; in float vH; uniform sampler2D uTex; uniform float uAlpha, uT, uDist, uMode;
out vec4 o;
void main(){
  vec2 uv = vUV + uDist*.0022*vec2(sin(vUV.y*60.+uT*1.7), cos(vUV.x*60.+uT*1.3)) + vec2(vH*.003);
  vec4 c = texture(uTex, uv);
  float edge = 1.0 - smoothstep(.0,.04, min(min(vUV.x,1.-vUV.x), min(vUV.y,1.-vUV.y)));
  if(uMode > .5){ c = vec4(0.); float e = smoothstep(.0,.006,min(min(vUV.x,1.-vUV.x),min(vUV.y,1.-vUV.y))); float b = 1.-e; float hatch = step(.5, fract((vUV.x+vUV.y)*46.)); c = vec4(vec3(.01,.35,.30)*(b*.9 + hatch*.12), b*.9 + hatch*.12); }
  if(uMode < .5){ float be = min(min(vUV.x,1.-vUV.x), min(vUV.y,1.-vUV.y)); float bl = (1.-smoothstep(.0,.0035,be))*.5; c = c*(1.-bl) + vec4(vec3(.05,.15,.13)*bl, bl); }
  c.rgb += vec3(.57,.17,.2) * max(vH,0.) * .7 * c.a;
  o = c * uAlpha;
}`;
// Khối thửa: dùng chung công thức chiều cao (mọc lên khi mở đầu, nhô lên quanh con trỏ). aM = (chiều cao, chỉ số màu, hạt giống).
const BLD_COMMON = `
uniform mat4 uVP; uniform float uBaseY, uNeedle, uIntro, uT, uOpa; uniform vec3 uPtr; uniform vec2 uShift; uniform vec3 uCol[64];
float h1(float n){ return fract(sin(n*91.345)*47453.5453); }
float bldH(vec2 c, vec3 m){
  float seed = m.z; float dc = length(c);
  float grow = clamp(uIntro*1.7 - dc*.8 - seed*.25, 0., 1.); grow = grow*grow*(3.-2.*grow);
  float d = length(c - uPtr.xz); float lift = uPtr.y * exp(-d*5.) * (.5+.5*sin(d*24.-uT*5.));
  return m.x * uNeedle * grow * (1.+ lift*1.6) + lift*.05*uNeedle;
}`;
const VS_TOP = `#version 300 es
in vec2 aXZ; in vec2 aC; in vec3 aM; ${BLD_COMMON}
out vec3 vCol; invariant gl_Position;
void main(){
  float H = bldH(aC, aM);
  gl_Position = uVP*vec4(aXZ.x, uBaseY + H, aXZ.y, 1.); gl_Position.xy += uShift*gl_Position.w;
  vec3 c = uCol[int(aM.y)]; vCol = mix(c, vec3(1.), .10) * (.96 + .08*h1(aM.z+5.)); // mặt mái: sáng nhất
}`;
const VS_WALL = `#version 300 es
in vec4 aAB; in vec2 aC; in vec3 aM; in vec2 aK; ${BLD_COMMON}
out vec3 vCol; invariant gl_Position;
void main(){
  float H = bldH(aC, aM); vec2 a = aAB.xy, b = aAB.zw; vec2 xz = mix(a, b, aK.x);
  gl_Position = uVP*vec4(xz.x, uBaseY + H*aK.y, xz.y, 1.); gl_Position.xy += uShift*gl_Position.w;
  vec2 e = b - a; float l = max(length(e), 1e-9); vec2 n = vec2(-e.y, e.x)/l;
  float side = abs(dot(n, normalize(vec2(-.62, -.78)))); // ánh sáng chiếu chéo từ trên-trái: hai hướng tường sáng/tối khác nhau
  float shade = mix(.50, .86, side) * (.72 + .28*aK.y);   // chân tường tối dần (khép góc), đỉnh sáng hơn
  vCol = uCol[int(aM.y)] * shade;
}`;
const FS_BLD = `#version 300 es
precision highp float; in vec3 vCol; uniform float uOpa; out vec4 o; void main(){ o = vec4(vCol*uOpa, uOpa); }`;

function prog(gl, vs, fs) {
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error('shader'); return x; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

/** Khởi tạo cảnh. D = {meta,P,attrs,qh}; trả về null nếu không có WebGL2. */
const pause = () => new Promise((r) => setTimeout(r, 0));
export async function createScene(canvas, D, cfg, progress = () => {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;
  const { P, qh, attrs, meta } = D; const q = meta.quant; const rows = attrs.rows;
  const bq = meta.bboxQ; const bx0 = bq[0] / q, bx1 = bq[2] / q, by0 = -bq[3] / q, by1 = -bq[1] / q;
  const bw = bx1 - bx0, bh = by1 - by0; const sc = 2 / bh; const PW = bw * sc, PH = 2;
  // bảng màu: các màu gốc khác nhau của hiện trạng đất (mỗi thửa một chỉ số)
  const palIdx = new Map(); const pal = []; const palOf = new Uint8Array(rows.length);
  rows.forEach((r, i) => { const c = colTD(r[4]); let k = palIdx.get(c); if (k === undefined) { k = Math.min(63, pal.length); if (pal.length < 64) { palIdx.set(c, k); pal.push(c); } } palOf[i] = k; });
  const colors = pal.map(hex); while (colors.length < 64) colors.push([0.5, 0.5, 0.5]);

  /* ----- kết cấu từ dữ liệu ----- */
  const TH = 2048, TW = Math.round(TH * (bw / bh));
  const mk = () => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return c; };
  const bb = { x0: bx0, x1: bx1, y0: by0, y1: by1 };
  const N = rows.length;
  const texSat = mk(); texSat.width = texSat.height = 2; await pause(); // nền vệ tinh minh hoạ: xử lý trong shader
  const texHT = bakeCanvas(P, q, bb, TW, TH, { fillColor: (f) => colTD(rows[f][4]), fillAlpha: 0.95, lineAlpha: 0 });
  progress(0.93); await pause();
  const texDC = bakeCanvas(P, q, bb, TW, TH, { fillFlat: [251, 244, 228], fillAlpha: 0.62, lineRGB: [12, 38, 34], lineAlpha: 0.9, lineOffsets: [[0, 0], [1, 0]] });
  progress(0.96); await pause();
  const nz = qh.code.length;
  const texQH = bakeCanvas(qh, q, bb, TW, TH, { fillColor: (z) => colQH(qh.meta.codes[qh.code[z]][0]), fillAlpha: 0.72, lineRGB: [146, 43, 50], lineAlpha: 1, lineOffsets: [[0, 0], [1, 0], [0, 1], [1, 1]] });
  void nz;
  progress(0.98); await pause();
  /* ----- hình học ----- */
  const prP = prog(gl, VS_PLANE, FS_PLANE);
  const prT = prog(gl, VS_TOP, FS_BLD), prW = prog(gl, VS_WALL, FS_BLD);
  const G = 96; const uv = new Float32Array((G + 1) * (G + 1) * 2); const idx = new Uint16Array(G * G * 6);
  for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) { uv[(j * (G + 1) + i) * 2] = i / G; uv[(j * (G + 1) + i) * 2 + 1] = j / G; }
  let k = 0; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const a = j * (G + 1) + i, b = a + 1, c = a + G + 1, d = c + 1; idx.set([a, c, b, b, c, d], k); k += 6; }
  const vaoP = gl.createVertexArray(); gl.bindVertexArray(vaoP);
  const bUV = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bUV); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  const locUV = gl.getAttribLocation(prP.p, 'aUV'); gl.enableVertexAttribArray(locUV); gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 0, 0);
  const bI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const tex = [texSat, texHT, texDC, texQH].map((cv) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  });
  [texSat, texHT, texDC, texQH].forEach((c) => { c.width = c.height = 1; }); // giải phóng bộ nhớ canvas

  // khối thửa: mặt mái dùng luôn phép chia tam giác có sẵn của thửa; tường dựng từ từng cạnh của các vòng (instancing)
  let amin = 1e12, amax = 0; for (const r of rows) { const a = Math.max(1, r[2] || 1); amin = Math.min(amin, a); amax = Math.max(amax, a); }
  const lmin = Math.log(amin), lmax = Math.log(amax);
  const nPts = P.pts.length / 2; const nRing = P.ringStart.length - 1; const mz = (by0 + by1) / 2, mx = (bx0 + bx1) / 2;
  const topV = new Float32Array(nPts * 7); const wallV = new Float32Array(nPts * 9); // mỗi đỉnh vòng ↔ đúng một cạnh (đỉnh → đỉnh kế, khép kín)
  for (let f = 0; f < N; f++) {
    const cx = ((P.bbox[4 * f] + P.bbox[4 * f + 2]) / 2 / q - mx) * sc, cz = (-(P.bbox[4 * f + 1] + P.bbox[4 * f + 3]) / 2 / q - mz) * sc;
    const t = (Math.log(Math.max(1, rows[f][2] || 1)) - lmin) / (lmax - lmin);
    const hh = 0.012 + 0.2 * Math.pow(t, 1.25); // toà thấp (thửa nhỏ) → toà cao (thửa lớn)
    const seed = (f * 0.61803398875) % 1; const ci = palOf[f];
    for (let r = P.featRing[f]; r < P.featRing[f + 1]; r++) {
      const s0 = P.ringStart[r], e0 = P.ringStart[r + 1];
      for (let i = s0; i < e0; i++) {
        const j = i + 1 < e0 ? i + 1 : s0;
        const x = (P.pts[2 * i] / q - mx) * sc, z = (-P.pts[2 * i + 1] / q - mz) * sc, x2 = (P.pts[2 * j] / q - mx) * sc, z2 = (-P.pts[2 * j + 1] / q - mz) * sc;
        topV.set([x, z, cx, cz, hh, ci, seed], i * 7);
        wallV.set([x, z, x2, z2, cx, cz, hh, ci, seed], i * 9);
      }
    }
  }
  void nRing;
  const vaoT = gl.createVertexArray(); gl.bindVertexArray(vaoT);
  { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, topV, gl.STATIC_DRAW);
    const at = (name, n, off) => { const l = gl.getAttribLocation(prT.p, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 28, off * 4); };
    at('aXZ', 2, 0); at('aC', 2, 2); at('aM', 3, 4);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, P.tri, gl.STATIC_DRAW); }
  const vaoW = gl.createVertexArray(); gl.bindVertexArray(vaoW);
  { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, wallV, gl.STATIC_DRAW);
    const at = (name, n, off) => { const l = gl.getAttribLocation(prW.p, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 36, off * 4); gl.vertexAttribDivisor(l, 1); };
    at('aAB', 4, 0); at('aC', 2, 4); at('aM', 3, 6);
    const kb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, kb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(prW.p, 'aK'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(l, 0); }
  gl.bindVertexArray(null);
  const nTopIdx = P.tri.length;
  const colFlat = new Float32Array(colors.flat());

  /* ----- trạng thái điều khiển (do landing.js tween) ----- */
  const S = { intro: 0, yaw: 0.35, pitch: 1.0, dist: 3.4, tx: 0, ty: 0, shiftX: 0.3, shiftY: 0, gap: 0.02, needle: 0.6, wave: 1, distort: 0.6, alpha: 1,
    a0: 1, a1: 1, a2: 1, a3: 1, ptrStrength: 0, visible: true };
  const ptr = { x: 0, z: 0, s: 0, tx: 0, tz: 0, nx: 0, ny: 0, inside: false };
  let W = 1, H = 1, dpr = 1, vp = M.mul(M.persp(0.55, 1, 0.1, 40), M.look([0, 2, 3], [0, 0, 0], [0, 1, 0])), raf = 0, t0 = performance.now(), lastPtrMove = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.75); const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); gl.viewport(0, 0, canvas.width, canvas.height);
  }
  const layerY = (i) => i * S.gap;
  function camera() {
    const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const cy = S.ty + S.gap * 1.45; const eye = [S.tx + Math.sin(S.yaw) * cp * S.dist, cy + sp * S.dist, Math.cos(S.yaw) * cp * S.dist];
    const asp = W / H; const fov = asp < 0.8 ? 0.8 : 0.58;
    vp = M.mul(M.persp(fov, asp, 0.1, 40), M.look(eye, [S.tx, cy, 0], [0, 1, 0]));
  }
  function ptrWorld() { // giao tia với mặt phẳng hiện trạng
    const inv = M.inv(vp); const sx = S.shiftX, sy = S.shiftY;
    const n = M.apply(inv, [ptr.nx - sx, ptr.ny - sy, -1]), f = M.apply(inv, [ptr.nx - sx, ptr.ny - sy, 1]);
    const y = layerY(1); const t = (y - n[1]) / (f[1] - n[1]);
    if (isFinite(t)) { ptr.tx = n[0] + (f[0] - n[0]) * t; ptr.tz = n[2] + (f[2] - n[2]) * t; }
  }
  function draw(now) {
    raf = 0; if (!S.visible) return;
    const T = (now - t0) / 1000;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) S.yaw += 0; // quay do cuộn điều khiển
    camera(); ptrWorld();
    const k = 1 - Math.exp(-0.16 * 60 * 0.016); ptr.x += (ptr.tx - ptr.x) * k; ptr.z += (ptr.tz - ptr.z) * k;
    const target = ptr.inside && now - lastPtrMove < 1800 ? 1 : 0; ptr.s += (target - ptr.s) * 0.06;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(prP.p); gl.bindVertexArray(vaoP);
    const u = prP.u; gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform2f(u.uSize, PW, PH); gl.uniform1f(u.uT, T); gl.uniform1f(u.uWave, S.wave * 0.9);
    gl.uniform3f(u.uPtr, ptr.x, ptr.s, ptr.z); gl.uniform2f(u.uShift, S.shiftX, S.shiftY); gl.uniform1f(u.uDist, S.distort);
    const al = [S.a0, S.a1, S.a2, S.a3];
    for (let i = 0; i < 4; i++) {
      const fade = clamp(S.intro * 2.2 - i * 0.35, 0, 1);
      gl.uniform1f(u.uY, layerY(i)); gl.uniform1f(u.uAlpha, al[i] * S.alpha * fade * (i === 0 ? 0.0 + clamp((S.gap - 0.1) / 0.3, 0, 1) : 1));
      gl.uniform1f(u.uMode, i === 0 ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.uniform1i(u.uTex, 0);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    if (S.needle > 0.002 || S.intro < 1) {
      // khối thửa: có chiều sâu; vẽ trước lượt ghi độ sâu (không màu) để chỉ thấy mặt gần nhất, không bị lẫn khi mờ
      const opa = S.alpha * clamp(S.needle * 5, 0, 1) * clamp(S.intro * 2, 0, 1);
      if (opa > 0.003) {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
        const setU = (pr) => { const v = pr.u; gl.uniformMatrix4fv(v.uVP, false, vp); gl.uniform1f(v.uBaseY, layerY(1)); gl.uniform1f(v.uNeedle, S.needle); gl.uniform1f(v.uIntro, S.intro); gl.uniform1f(v.uOpa, opa);
          gl.uniform1f(v.uT, T); gl.uniform3f(v.uPtr, ptr.x, ptr.s, ptr.z); gl.uniform2f(v.uShift, S.shiftX, S.shiftY); gl.uniform3fv(v.uCol, colFlat); };
        const drawAll = () => {
          gl.useProgram(prW.p); setU(prW); gl.bindVertexArray(vaoW); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nPts);
          gl.useProgram(prT.p); setU(prT); gl.bindVertexArray(vaoT); gl.drawElements(gl.TRIANGLES, nTopIdx, gl.UNSIGNED_INT, 0);
        };
        if (opa < 0.97) { gl.colorMask(false, false, false, false); drawAll(); gl.colorMask(true, true, true, true); } // lượt độ sâu chỉ cần khi đang mờ; khi đặc, depth test là đủ
        drawAll();
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      }
    }
    api.onFrame?.();
    schedule();
  }
  function schedule() { if (!raf && S.visible && !document.hidden) raf = requestAnimationFrame(draw); }
  addEventListener('resize', () => { resize(); schedule(); }, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  resize();

  const api = {
    S, planeSize: [PW, PH], layerY,
    setPointer(cx, cy, inside) { // toạ độ clip từ -1..1
      ptr.nx = cx; ptr.ny = cy; ptr.inside = inside; lastPtrMove = performance.now();
    },
    project(x, y, z) { const p = M.apply(vp, [x, y, z]); return [((p[0] + S.shiftX) * 0.5 + 0.5) * W, (1 - ((p[1] + S.shiftY) * 0.5 + 0.5)) * H]; },
    setVisible(v) { if (S.visible !== v) { S.visible = v; canvas.style.visibility = v ? 'visible' : 'hidden'; if (v) schedule(); } },
    start: schedule, onFrame: null,
  };
  return api;
}
