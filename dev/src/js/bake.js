// bake.js — "nướng" lớp bản đồ thành ảnh bằng GPU (WebGL2): tô thửa bằng tam giác đã chia sẵn, kẻ ranh giới bằng GL_LINES.
// Nhanh hơn rất nhiều so với tô/kẻ hàng chục nghìn đường bằng Canvas2D (vốn làm trang giới thiệu bị khựng).
import { hex2rgb } from './util.js';

const VS = `#version 300 es
in vec2 aP; in vec4 aC; uniform vec4 uB; uniform vec2 uO; uniform vec4 uK; uniform float uUseK; out vec4 vC;
void main(){ gl_Position = vec4((aP.x-uB.x)/uB.z*2.-1.+uO.x, 1.-(aP.y-uB.y)/uB.w*2.+uO.y, 0., 1.); vC = uUseK > .5 ? uK : aC; }`;
const FS = `#version 300 es
precision mediump float; in vec4 vC; uniform float uA; out vec4 o; void main(){ o = vec4(vC.rgb*vC.a*uA, vC.a*uA); }`;

let shared = null;
function ctx() {
  if (shared) return shared;
  const cv = document.createElement('canvas'); const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('webgl2');
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
  const u = (n) => gl.getUniformLocation(p, n);
  shared = { cv, gl, p, uB: u('uB'), uO: u('uO'), uK: u('uK'), uUseK: u('uUseK'), uA: u('uA'), aP: gl.getAttribLocation(p, 'aP'), aC: gl.getAttribLocation(p, 'aC') };
  return shared;
}

/**
 * pack: gói thửa/quy hoạch (pts, ringStart, featRing, tri); q: hệ số lượng tử; bb: {x0,x1,y0,y1} (mét, y hướng xuống).
 * opt: { fillColor(f)->'#rrggbb' | fillFlat:[r,g,b], fillAlpha, lineRGB:[r,g,b] 0..255, lineAlpha, lineOffsets:[[px,py],…] }
 * Trả về canvas 2D W×H (hàng 0 = phía bắc).
 */
export function bakeCanvas(pack, q, bb, W, H, opt) {
  const g = ctx(); const { gl } = g; g.cv.width = W; g.cv.height = H;
  gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(g.p);
  const n = pack.pts.length / 2; const pos = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pos[2 * i] = pack.pts[2 * i] / q; pos[2 * i + 1] = -pack.pts[2 * i + 1] / q; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const bP = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bP); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(g.aP); gl.vertexAttribPointer(g.aP, 2, gl.FLOAT, false, 0, 0);
  gl.uniform4f(g.uB, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0); gl.uniform2f(g.uO, 0, 0);
  const bufs = [bP];
  if (opt.fillAlpha > 0) {
    let bC = null;
    if (opt.fillColor) {
      const col = new Uint8Array(n * 4);
      for (let f = 0; f < pack.featRing.length - 1; f++) {
        const rgb = hex2rgb(opt.fillColor(f)); const s = pack.ringStart[pack.featRing[f]], e = pack.ringStart[pack.featRing[f + 1]];
        for (let i = s; i < e; i++) { col[4 * i] = rgb[0]; col[4 * i + 1] = rgb[1]; col[4 * i + 2] = rgb[2]; col[4 * i + 3] = 255; }
      }
      bC = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bC); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(g.aC); gl.vertexAttribPointer(g.aC, 4, gl.UNSIGNED_BYTE, true, 0, 0); bufs.push(bC);
      gl.uniform1f(g.uUseK, 0);
    } else { gl.disableVertexAttribArray(g.aC); gl.uniform1f(g.uUseK, 1); const c = opt.fillFlat; gl.uniform4f(g.uK, c[0] / 255, c[1] / 255, c[2] / 255, 1); }
    gl.uniform1f(g.uA, opt.fillAlpha);
    const bI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, pack.tri, gl.STATIC_DRAW); bufs.push(bI);
    gl.drawElements(gl.TRIANGLES, pack.tri.length, gl.UNSIGNED_INT, 0);
  }
  if (opt.lineAlpha > 0) {
    gl.disableVertexAttribArray(g.aC); gl.uniform1f(g.uUseK, 1); const c = opt.lineRGB; gl.uniform4f(g.uK, c[0] / 255, c[1] / 255, c[2] / 255, 1); gl.uniform1f(g.uA, opt.lineAlpha);
    const { ringStart } = pack; const ne = ringStart[ringStart.length - 1] - ringStart[0]; const ei = new Uint32Array(ne * 2); let k = 0;
    for (let r = 0; r < ringStart.length - 1; r++) { const s = ringStart[r], e = ringStart[r + 1]; for (let i = s; i < e; i++) { ei[k++] = i; ei[k++] = i + 1 < e ? i + 1 : s; } }
    const bI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ei, gl.STATIC_DRAW); bufs.push(bI);
    for (const [ox, oy] of opt.lineOffsets || [[0, 0]]) { gl.uniform2f(g.uO, (2 * ox) / W, (2 * oy) / H); gl.drawElements(gl.LINES, ei.length, gl.UNSIGNED_INT, 0); }
  }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  out.getContext('2d').drawImage(g.cv, 0, 0);
  for (const b of bufs) gl.deleteBuffer(b); gl.deleteVertexArray(vao);
  return out;
}
