// curtain.js — chuyển cảnh bằng shader WebGL: mực loang theo nhiễu fbm, viền son – kem – lục.
import Motion from './motion.js';

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uP; uniform vec2 uO; uniform float uT;
out vec4 o;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 asp = vec2(uRes.x/uRes.y,1.);
  float d = distance(uv*asp, uO*asp)/length(asp);
  float n = fbm(uv*asp*3.4 + uT*.12);
  float t = uP*1.45 - (d*.8 + n*.5);
  vec3 green=vec3(.008,.353,.298), red=vec3(.573,.169,.196), cream=vec3(.953,.91,.827);
  vec3 col = red;
  col = mix(col, cream, smoothstep(.052,.058,t));
  col = mix(col, green, smoothstep(.066,.072,t));
  col += (hash(gl_FragCoord.xy+uT)-.5)*.05;
  float a = smoothstep(0.,.012,t);
  o = vec4(col*a, a);
}`;

function sh(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader');
  return s;
}

export function createCurtain(canvas) {
  const root = document.documentElement;
  let gl = null, prog, u = {}, p = 1, origin = [0.5, 0.5], t0 = performance.now();
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error('gl');
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    for (const n of ['uRes', 'uP', 'uO', 'uT']) u[n] = gl.getUniformLocation(prog, n);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  } catch { gl = null; }

  function size() {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * d); canvas.height = Math.round(innerHeight * d);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function draw() {
    if (!gl) { canvas.style.opacity = String(p > 0.01 ? 1 : 0); canvas.style.background = 'var(--green)'; canvas.style.visibility = p > 0.001 ? 'visible' : 'hidden'; return; }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (p > 0.0005) {
      gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform1f(u.uP, p);
      gl.uniform2f(u.uO, origin[0], origin[1]); gl.uniform1f(u.uT, (performance.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    canvas.style.visibility = p > 0.0005 ? 'visible' : 'hidden';
  }
  size(); addEventListener('resize', size, { passive: true });
  draw(); root.classList.add('curtain-ready');

  const go = (to, dur, ease, o) => {
    if (o) origin = [o.x / innerWidth, 1 - o.y / innerHeight];
    const tw = { p };
    return new Promise((res) => {
      Motion.timeline().to(tw, { p: to, duration: Motion.reduced ? 0.0001 : dur, ease, onUpdate: () => { p = tw.p; draw(); }, onComplete: () => { p = to; draw(); res(); } });
    });
  };
  return {
    cover: (o, dur = 0.95) => go(1, dur, 'power2.inOut', o),
    reveal: (o, dur = 1.1) => go(0, dur, 'power2.inOut', o),
    hasGL: !!gl,
  };
}

/** Gắn chuyển cảnh vào các liên kết nội bộ có data-curtain. */
export function wireLinks(curtain) {
  addEventListener('pageshow', (e) => { if (e.persisted) curtain.reveal(); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-curtain]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    // Đi tiếp khi hiệu ứng xong, hoặc sau 1,4 giây nếu hiệu ứng bị treo (máy yếu / tab nền).
    let went = false; const go = () => { if (!went) { went = true; location.assign(a.href); } };
    setTimeout(go, 1400);
    try { curtain.cover({ x: e.clientX, y: e.clientY }).then(go, go); } catch { go(); }
  });
}
