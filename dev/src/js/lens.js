// lens.js — "kính lúp địa bạ": sơ đồ nét mảnh của cả xã; kính lúp (theo con trỏ, tự di chuyển khi không ai chạm)
// phóng to và tô màu hiện trạng đất thật bên trong. Canvas2D thuần, chỉ vẽ khi đang trong màn hình.
import { colTD } from './util.js';
import { bakeCanvas } from './bake.js';
export function createLens(canvas, D, cfg) {
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const { P, meta, attrs } = D; const rows = attrs.rows; const q = meta.quant; const bq = meta.bboxQ;
  const bx0 = bq[0] / q, bx1 = bq[2] / q, by0 = -bq[3] / q, by1 = -bq[1] / q; const bw = bx1 - bx0, bh = by1 - by0;
  const LW = 1500, LH = Math.round(LW * bh / bw);
  const mk = () => { const c = document.createElement('canvas'); c.width = LW; c.height = LH; return c; };
  const bb = { x0: bx0, x1: bx1, y0: by0, y1: by1 };
  // ba lớp dựng bằng GPU: tô hiện trạng (màu gốc), nét đậm, nét mờ
  const colorL = bakeCanvas(P, q, bb, LW, LH, { fillColor: (f) => colTD(rows[f][4]), fillAlpha: 1, lineAlpha: 0 });
  const lineL = bakeCanvas(P, q, bb, LW, LH, { fillAlpha: 0, lineRGB: [12, 38, 34], lineAlpha: 0.75, lineOffsets: [[0, 0], [1, 0]] });
  const faintL = bakeCanvas(P, q, bb, LW, LH, { fillAlpha: 0, lineRGB: [2, 90, 76], lineAlpha: 0.55, lineOffsets: [[0, 0], [1, 0]] });

  const st = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, idleAt: 0, last: 0, vis: false, raf: 0, W: 0, H: 0, dpr: 1, mag: 2.6, pad: 0, t0: performance.now() };
  // Kính vẽ trên MỘT LỚP PHỦ lớn hơn bản đồ (thêm lề = bán kính kính mỗi phía, không đổi bố cục trang): tâm kính tới được tận mép bản đồ
  // mà vòng kính vẫn tròn đủ, nên soi được cả các rìa. Bản đồ nền mờ vẽ trên canvas gốc, chỉ vẽ lại khi đổi kích thước.
  const lc = document.createElement('canvas'); lc.className = 'about__lens'; lc.setAttribute('aria-hidden', 'true');
  Object.assign(lc.style, { position: 'absolute', pointerEvents: 'none', maxWidth: 'none' });
  canvas.after(lc); const lctx = lc.getContext('2d');
  const drawBase = () => { const { W, H, dpr } = st; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(faintL, 0, 0, W, H); };
  const size = () => {
    const r = canvas.getBoundingClientRect(); if (!r.width) return;
    st.dpr = Math.min(devicePixelRatio || 1, 1.75); st.W = r.width; st.H = r.height;
    canvas.width = Math.round(r.width * st.dpr); canvas.height = Math.round(r.height * st.dpr); drawBase();
    const R = Math.min(st.W, st.H) * 0.25; const pad = st.pad = Math.ceil(R + 14);
    lc.width = Math.round((st.W + 2 * pad) * st.dpr); lc.height = Math.round((st.H + 2 * pad) * st.dpr);
    Object.assign(lc.style, { left: `${canvas.offsetLeft - pad}px`, top: `${canvas.offsetTop - pad}px`, width: `${st.W + 2 * pad}px`, height: `${st.H + 2 * pad}px` });
  };
  size(); if (typeof ResizeObserver !== 'undefined') new ResizeObserver(size).observe(canvas); else addEventListener('resize', size, { passive: true });
  // nhận con trỏ trong cả vùng lề quanh bản đồ (không chỉ trong canvas): đưa chuột ra ngoài rìa thì kính vẫn bám theo, tới sát mép
  let inside = false;
  addEventListener('pointermove', (e) => {
    if (!st.vis) return; const r = canvas.getBoundingClientRect(); const pd = st.pad * 0.6;
    const hit = e.clientX >= r.left - pd && e.clientX <= r.right + pd && e.clientY >= r.top - pd && e.clientY <= r.bottom + pd;
    if (hit) { st.tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); st.ty = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); st.idleAt = performance.now() + 2500; inside = true; }
    else if (inside) { inside = false; st.idleAt = performance.now() + 600; }
  }, { passive: true });
  canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); st.tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); st.ty = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); st.idleAt = performance.now() + 2500; });

  const draw = (now) => {
    st.raf = 0; if (!st.vis || document.hidden) return;
    const { W, H, dpr, pad } = st; const t = (now - st.t0) / 1000; const c = lctx;
    if (now > st.idleAt) { st.tx = 0.5 + Math.sin(t * 0.42) * 0.5; st.ty = 0.5 + Math.sin(t * 0.67 + 1) * 0.5; } // tự quét tới cả bốn rìa bản đồ
    st.x += (st.tx - st.x) * 0.12; st.y += (st.ty - st.y) * 0.12;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, lc.width, lc.height);
    const R = Math.min(W, H) * 0.25; const cx = st.x * W, cy = st.y * H; const m = st.mag; // tâm theo toạ độ bản đồ: có thể ở sát mép
    c.setTransform(dpr, 0, 0, dpr, dpr * pad, dpr * pad); // gốc toạ độ = góc bản đồ; lớp phủ rộng thêm `pad` mỗi phía
    // bóng cứng, đúng ngôn ngữ giao diện
    c.fillStyle = '#025a4c'; c.beginPath(); c.arc(cx + 6, cy + 6, R + 2, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    c.fillStyle = '#fbf4e4'; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    c.setTransform(dpr * m, 0, 0, dpr * m, dpr * (pad + cx - cx * m), dpr * (pad + cy - cy * m));
    c.drawImage(colorL, 0, 0, W, H); c.drawImage(lineL, 0, 0, W, H);
    c.restore(); c.setTransform(dpr, 0, 0, dpr, dpr * pad, dpr * pad);
    c.lineWidth = 2; c.strokeStyle = '#025a4c'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#922b32'; c.beginPath(); c.arc(cx, cy, R - 7, 0, 7); c.stroke();
    c.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; c.moveTo(cx + Math.cos(a) * (R - 7), cy + Math.sin(a) * (R - 7)); c.lineTo(cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18)); } c.stroke();
    c.fillStyle = '#922b32'; c.beginPath(); c.arc(cx, cy, 2.2, 0, 7); c.fill();
    st.raf = requestAnimationFrame(draw);
  };
  return {
    set visible(v) { st.vis = v; if (v && !st.raf) st.raf = requestAnimationFrame(draw); },
    get aspect() { return bw / bh; },
  };
}
