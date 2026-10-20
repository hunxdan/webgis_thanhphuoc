// landing.js — trang giới thiệu: dựng nội dung từ config, điều phối cảnh 3D theo vị trí cuộn.
import { CFG, h, clamp, fmt0, loadPack, loadJSON, toast } from './util.js';
import Motion from './motion.js';
import { initChrome, icon } from './common.js';
import { createScene } from './scene.js';
import { createLens } from './lens.js';
import { deedNodes, planItems, paintSwatches } from './deed.js';

const $ = (id) => document.getElementById(id);
const curtain = initChrome();
// Phòng hờ: nếu tải/khởi tạo treo, vẫn gỡ lớp phủ xanh để trang đọc được.
setTimeout(() => { try { const l = $('loader'); if (l && !l.hidden) { l.hidden = true; curtain.reveal({ x: innerWidth * 0.5, y: innerHeight * 0.5 }); } } catch { /* bỏ qua */ } }, 12000);
const mobile = () => matchMedia('(max-width: 820px)').matches;

/* ---------- tải ---------- */
$('loader-tag').textContent = `${CFG.TEN_XA} · ${CFG.TEN_TINH}`;
let lp = 0, shown = 0; const target = CFG.THONG_KE?.[0]?.so || 17820;
const loadTick = Motion.ticker.add((dt) => { shown += (lp * target - shown) * Math.min(1, dt * 5); $('loader-n').textContent = fmt0(Math.round(shown)); });
const step = (p) => { lp = Math.max(lp, p); };

async function boot() {
  let D;
  try {
    const meta = await loadJSON('meta'); step(0.05);
    const [P, qh, attrs] = await Promise.all([
      loadPack('parcels').then((x) => { step(0.55); return x; }),
      loadPack('qh').then((x) => { step(0.7); return x; }),
      loadJSON('attrs').then((x) => { step(0.9); return x; }),
    ]);
    D = { meta, P, qh, attrs };
  } catch { D = null; }
  buildContent(D);
  let scene = null;
  if (D) { try { scene = await createScene($('stage'), D, CFG, step); } catch { scene = null; } }
  if (!scene) { document.documentElement.classList.add('no-gl'); $('stage').hidden = true; }
  step(1);
  await new Promise((r) => setTimeout(r, 60));
  Motion.to($('loader'), { opacity: 0, duration: 0.2 });
  await new Promise((r) => setTimeout(r, 40));
  $('loader').hidden = true; Motion.ticker.remove(loadTick);
  curtain.reveal({ x: innerWidth * 0.7, y: innerHeight * 0.5 }, 0.7);
  const safe = (fn) => { try { return fn(); } catch { return undefined; } };
  if (scene) {
    const ok = safe(() => { scene.S.intro = 1; scene.start(); return true; });
    if (!ok) { scene = null; document.documentElement.classList.add('no-gl'); $('stage').hidden = true; }
  }
  safe(heroIntro);
  safe(() => wireScroll(scene, D));
  if (D) safe(() => setupSample(D));
  safe(() => setupLens(D));
}

/* ---------- nội dung dựng từ config ---------- */
function buildContent(D) {
  const parts = CFG.TEN_XA.split(' ');
  $('hero-kicker').textContent = `${CFG.TEN_RUT_GON} · ${CFG.TEN_TINH}`;
  $('t1').textContent = parts[0]; $('t2').textContent = parts.slice(1).join(' ');
  $('hero-side').textContent = `Kỳ quy hoạch ${CFG.KY_QUY_HOACH}`;
  if (D) {
    const b = D.meta.bbox; const f = (v, a, c) => `${Math.floor(v)}°${String(Math.round((v % 1) * 60)).padStart(2, '0')}′${v >= 0 ? a : c}`;
    $('hero-coords').textContent = `${f(b.latMin, 'N', 'S')} – ${f(b.latMax, 'N', 'S')} · ${f(b.lonMin, 'E', 'W')} – ${f(b.lonMax, 'E', 'W')} · ${CFG.HE_TOA_DO}`;
  } else $('hero-coords').textContent = CFG.HE_TOA_DO;

  // tuyên ngôn
  const m = $('manifesto-t');
  m.replaceChildren('Mỗi thửa đất là một dòng trong cuốn ', h('em', null, 'địa bạ'), `. Ở đây, ${fmt0(CFG.THONG_KE[0].so)} thửa được số hóa và chồng lớp cùng quy hoạch ${CFG.KY_QUY_HOACH}, để bạn đọc vùng đất bằng mắt.`);

  $('about-p').textContent = CFG.GIOI_THIEU;
  $('about-n').textContent = `Hệ tọa độ ${CFG.HE_TOA_DO}. Phục vụ nghiên cứu học thuật.`;

  // số liệu
  const grid = $('stat-grid');
  CFG.THONG_KE.forEach((s) => grid.append(h('li', null, h('b', { class: 'num', 'data-n': s.so ?? '' }, s.so != null ? '0' : s.chu), h('span', null, s.nhan))));
  if (D) {
    const st = D.meta.stats;
    $('stat-derived').replaceChildren(...[
      [fmt0(st.qhZones), 'vùng quy hoạch'], [fmt0(st.qhTypes), 'loại đất quy hoạch'], [fmt0(st.landUseCodes), 'mã hiện trạng'], [`${fmt0(Math.round(st.areaHa))} ha`, 'tổng diện tích thửa'],
    ].map(([a, b]) => h('li', null, h('b', { class: 'num' }, a), b)), h('li', null, '· tính trực tiếp từ dữ liệu'));
  }

  // chức năng
  const feats = [
    ['Tìm đúng thửa', 'Nhập số tờ và số thửa, tìm theo tọa độ VN-2000 hoặc chọn ngẫu nhiên một thửa. Gợi ý hiện ngay khi bạn gõ.'],
    ['Hiện trạng & quy hoạch', 'Bật lớp quy hoạch viền đỏ, bấm vào vùng để xem tên, mã loại đất và thông tin thêm.'],
    ['Chồng lớp, chỉnh độ mờ', 'Chuyển nền giấy hoặc vệ tinh, kéo thanh độ mờ để đối chiếu màu đất với ảnh thật.'],
    ['Đo khoảng cách & diện tích', 'Chấm các điểm trên bản đồ để đo chiều dài, chu vi và diện tích ngay trong trình duyệt.'],
    ['Định vị GPS', 'Xem bạn đang ở đâu trên bản đồ. Vị trí chỉ xử lý tại trình duyệt, không gửi đi đâu.'],
    ['Mọi thiết bị', 'Giao diện co giãn theo màn hình: chạm để chọn, vuốt để kéo, chụm hai ngón để thu phóng.'],
  ];
  $('feat-track').replaceChildren(...feats.map(([t, d], i) => h('article', { class: 'fcard' }, h('div', { class: 'fcard__n num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')), h('div', null, h('h3', null, t), h('p', null, d)))));

  // FAQ
  $('faq-list').replaceChildren(...CFG.FAQ.map((q, i) => {
    const btn = h('button', { type: 'button', 'aria-expanded': 'false', 'aria-controls': `qa-${i}`, id: `qb-${i}` }, h('span', null, q.h), h('i'));
    const item = h('div', { class: 'qa' }, h('h3', { class: 'qa__h' }, btn), h('div', { class: 'qa__p', id: `qa-${i}`, role: 'region', 'aria-labelledby': `qb-${i}` }, h('div', null, h('p', null, q.d))));
    btn.addEventListener('click', () => { const o = !item.classList.contains('open'); item.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); });
    return item;
  }));
  document.querySelectorAll('.qa__h').forEach((x) => { x.style.margin = '0'; });

  // đối tác (lặp hai lần để vòng lặp liền mạch)
  const set = () => CFG.DOI_TAC.map((p) => h('div', { class: 'marquee__item' }, h('img', { src: p.anh, alt: p.ten, decoding: 'async' })));
  $('marquee-row').replaceChildren(...set(), ...set().map((n) => { n.setAttribute('aria-hidden', 'true'); n.firstChild.alt = ''; return n; }));

  // lời cảm ơn
  const T = CFG.LOI_CAM_ON; const rw = (k, v) => h('div', { class: 'th-row' }, h('dt', null, k), h('dd', null, v));
  $('thanks-body').replaceChildren(
    h('div', { class: 'th-logos' }, h('img', { src: T.truong.anh, alt: `Logo ${T.truong.ten}` }), h('img', { src: T.khoa.anh, alt: `Logo ${T.khoa.ten}` })),
    h('dl', { class: 'th-dl' }, rw('Trường', T.truong.ten), rw('Khoa', T.khoa.ten), rw(T.giangVien.vai, T.giangVien.ten), rw(T.coQuan.vai, T.coQuan.ten)));
  document.querySelectorAll('.th-dl').forEach((x) => { x.style.margin = '0'; });

  // chân trang
  $('foot-team').textContent = `Thực hiện: ${CFG.NHOM_THUC_HIEN.join(' · ')}`;
  $('foot-copy').textContent = `© ${new Date().getFullYear()} ${CFG.TEN_DU_AN} · ${CFG.BAN_QUYEN}`;
}

/* ---------- mở đầu ---------- */
function heroIntro() {
  const a = Motion.splitText($('t1'), { chars: true }), b = Motion.splitText($('t2'), { chars: true });
  const tl = Motion.timeline({ paused: true });
  tl.from(a.chars, { yPercent: 112, rotate: 7, duration: 1.1, stagger: 0.05, ease: 'expo.out' }, 0.15)
    .from(b.chars, { yPercent: 112, rotate: -7, duration: 1.1, stagger: 0.05, ease: 'expo.out' }, 0.3)
    .from('.hero__kicker', { y: 16, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0.1)
    .from('.hero__lede', { y: 22, opacity: 0, duration: 0.9, ease: 'power3.out' }, 0.8)
    .from('.hero__cta .btn', { y: 22, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' }, 1)
    .from('.hero__side, .hero__coords, .hero__scroll', { opacity: 0, duration: 1, stagger: 0.1 }, 1.3);
  tl.play();
}

/* ---------- cuộn ---------- */
let scrubs = [];
function wireScroll(scene, D) {
  // tiêu đề phần: tách từ, hiện khi vào khung nhìn
  document.querySelectorAll('[data-split]').forEach((el) => {
    const sp = Motion.splitText(el, { chars: false });
    const tl = Motion.timeline({ paused: true }).from(sp.words, { yPercent: 108, rotate: 3, duration: 0.95, stagger: 0.07, ease: 'expo.out' });
    Motion.enter(el, () => tl.play());
  });
  // số liệu đếm lên
  Motion.enter($('stat-grid'), () => {
    $('stat-grid').querySelectorAll('b[data-n]').forEach((b, i) => { const n = Number(b.dataset.n); if (n) Motion.counter(b, n, { duration: 2.2, delay: i * 0.12, format: (v) => fmt0(Math.round(v)) }); });
  }, { margin: '0px 0px -20% 0px' });
  document.querySelectorAll('#stat-grid li').forEach((li, i) => { const tl = Motion.timeline({ paused: true }).from(li, { y: 40, opacity: 0, duration: 0.9, delay: i * 0.1, ease: 'power3.out' }); Motion.enter(li, () => tl.play()); });
  // sơ đồ cây
  setupTree();
  // thẻ mẫu và các khối khác: hiện nhẹ
  document.querySelectorAll('.about__txt .lead, .about__note, .about__txt .btn, .fcard, .lk-cols > div, .qa, .th-row').forEach((el) => {
    const tl = Motion.timeline({ paused: true }).from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out' });
    Motion.enter(el, () => tl.play(), { margin: '0px 0px -8% 0px' });
  });
  layout(scene, D);
  let to; addEventListener('resize', () => { clearTimeout(to); to = setTimeout(() => layout(scene, D), 180); }, { passive: true });
  if (scene) {
    addEventListener('pointermove', (e) => { scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1), true); }, { passive: true });
  }
}

/** Nội suy Hermite đơn điệu (Fritsch–Carlson): đi qua mọi keyframe, liên tục cả đạo hàm, không vọt quá giá trị hai đầu. */
function monotoneCurve(t, v) {
  const n = t.length; const d = [], mm = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / (t[i + 1] - t[i]));
  mm[0] = d[0]; mm[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) mm[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (x) => {
    if (x <= t[0]) return v[0]; if (x >= t[n - 1]) return v[n - 1];
    let i = 0; while (x > t[i + 1]) i++;
    const h = t[i + 1] - t[i], u = (x - t[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h * mm[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h * mm[i + 1];
  };
}

function layout(scene, D) {
  scrubs.forEach((s) => s?.kill()); scrubs = []; const vh = innerHeight;
  const hero = $('hero'), man = $('manifesto'), lay = $('layers'), zone = $('zone');
  const h1 = hero.offsetHeight, h2 = man.offsetHeight, h3 = lay.offsetHeight; const total = h1 + h2 + h3 - vh;

  /* thời gian chạy theo px cuộn của #zone */
  const heroEnd = h1 - vh, manStart = h1, layStart = h1 + h2, layEnd = h1 + h2 + h3 - vh;
  if (scene) {
    const S = scene.S;
    const m = mobile(); const sx = m ? 0 : 0.46; S.shiftX = sx;
    // MỘT bộ keyframe duy nhất cho camera + bản đồ, nội suy cong đơn điệu (không vọt quá, không có điểm gãy): mọi thông số là hàm liên tục của vị trí cuộn
    // nên chuyển cảnh mục 01 → 02 không còn nhảy vị trí/màu như khi chồng nhiều tween lên nhau.
    const ld = layEnd - layStart; const manMid = manStart + vh * 0.5;
    const tPin = Math.max(manMid + 1, layStart - vh); // hết đoạn ghim của tuyên ngôn
    const gEnd = m ? 0.34 : 0.42, f = 0.25; // f: mức tiến ~25% của đoạn mở tầng khi kim/khối đã thu hết
    const K = [
      [0,                       { yaw: 0.35, pitch: 1.0,  dist: m ? 4.4 : 3.8,  needle: 0.55, alpha: 1,                gap: 0.02, shiftX: sx, shiftY: m ? -0.28 : 0 }],
      [Math.max(1, heroEnd),    { yaw: 0.9,  pitch: 0.8,  dist: m ? 4.2 : 3.5,  needle: 1,    alpha: 1,                gap: 0.02, shiftX: sx, shiftY: m ? -0.28 : 0 }],
      // mục 01: bản đồ 3D ĐẶC hoàn toàn (alpha 1) ở mọi màn hình. Desktop: dời sang nửa phải; điện thoại: hạ xuống nửa dưới để không đè lên chữ (chữ ở nửa trên)
      [manMid,                  { yaw: 1.05, pitch: 0.8,  dist: m ? 4.3 : 3.9,  needle: 0.85, alpha: 1, gap: 0.02, shiftX: m ? sx : 0.62, shiftY: m ? -0.46 : 0 }],
      [tPin,                    { yaw: 1.12, pitch: 0.79, dist: m ? 4.3 : 3.85, needle: 0.85, alpha: 1, gap: 0.02, shiftX: m ? sx : 0.62, shiftY: m ? -0.46 : 0 }],
      [layStart,                { yaw: 1.0,  pitch: 0.78, dist: m ? 4.2 : 3.2,  needle: 0.9,  alpha: 1,                gap: 0.02, shiftX: sx, shiftY: m ? -0.28 : 0 }],
      [layStart + ld * 0.12,    { yaw: 1.0 + (0.55 - 1.0) * f, pitch: 0.78 + (0.5 - 0.78) * f, dist: (m ? 4.2 : 3.2) + ((m ? 4.9 : 4.4) - (m ? 4.2 : 3.2)) * f, needle: 0, alpha: 1,
        gap: 0.02 + (gEnd - 0.02) * f, shiftX: sx + ((m ? 0 : 0.42) - sx) * f, shiftY: (m ? -0.28 : 0) + ((m ? 0.22 : 0) - (m ? -0.28 : 0)) * f }],
      [layStart + ld * 0.34,    { yaw: 0.55, pitch: 0.5,  dist: m ? 4.9 : 4.4,  needle: 0,    alpha: 1,                gap: gEnd, shiftX: m ? 0 : 0.42, shiftY: m ? 0.22 : 0 }],
      [Math.max(layStart + ld * 0.34 + 1, total), { yaw: 0.05, pitch: 0.5, dist: m ? 4.9 : 4.4, needle: 0, alpha: 1, gap: gEnd, shiftX: m ? 0 : 0.42, shiftY: m ? 0.22 : 0 }],
    ];
    for (let i = 1; i < K.length; i++) K[i][0] = Math.max(K[i][0], K[i - 1][0] + 1); // thời điểm luôn tăng dần
    const props = Object.keys(K[0][1]); const ts = K.map((k) => k[0]);
    const curves = Object.fromEntries(props.map((pr) => [pr, monotoneCurve(ts, K.map((k) => k[1][pr]))]));
    const applyAt = (px) => { for (const pr of props) S[pr] = curves[pr](px); };
    scrubs.push(Motion.scrub(zone, { start: 'top top', end: 'bottom bottom', smooth: 0.09, timeline: { progress: (p) => applyAt(p * Math.max(1, total)) },
      onUpdate: () => { const y = scrollY; scene.setVisible(y < zone.offsetTop + zone.offsetHeight - 10); } }));
  }

  // chữ mở đầu thoát lên khi cuộn
  const tlh = Motion.timeline({ paused: true })
    .fromTo('.hero__title', { y: 0, opacity: 1 }, { y: -90, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.5)
    .fromTo('.hero__lede, .hero__cta, .hero__kicker', { y: 0, opacity: 1 }, { y: -50, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.35);
  scrubs.push(Motion.scrub(hero, { start: 'top top', end: 'bottom bottom', smooth: 0.05, timeline: tlh }));

  // tuyên ngôn: từng từ sáng dần
  const words = [...$('manifesto-t').querySelectorAll('.sp-w')];
  if (!words.length) Motion.splitText($('manifesto-t'), { chars: false, mask: false });
  const W = [...$('manifesto-t').querySelectorAll('.sp-w')];
  scrubs.push(Motion.scrub(man, { start: 'top top', end: 'bottom bottom', smooth: 0.06, onUpdate: (p) => {
    const t = clamp((p - 0.04) / 0.62, 0, 1) * (W.length + 5);
    W.forEach((w, i) => { w.style.opacity = String(clamp((t - i) / 5, 0, 1) * 0.86 + 0.14); });
    $('manifesto').querySelector('.manifesto__stick').style.opacity = String(1 - clamp((p - 0.88) / 0.12, 0, 1) * 0.9);
  } }));

  // bốn tầng: làm nổi từng tầng theo bước
  const steps = [...document.querySelectorAll('.step')]; const lbls = [...document.querySelectorAll('.lbl')];
  const tgt = [1, 1, 1, 1];
  scrubs.push(Motion.scrub(lay, { start: 'top top', end: 'bottom bottom', smooth: 0.05, onUpdate: (p) => {
    let cur = -1; if (p >= 0.3 && p < 0.5) cur = 1; else if (p >= 0.5 && p < 0.7) cur = 2; else if (p >= 0.7 && p < 0.88) cur = 3; else if (p >= 0.88) cur = 0; else if (p >= 0.14) cur = 1;
    steps.forEach((s) => s.classList.toggle('on', Number(s.dataset.i) === cur));
    for (let i = 0; i < 4; i++) tgt[i] = p < 0.3 || cur < 0 ? 1 : i === cur ? 1 : 0.16;
    lay.dataset.cur = String(cur);
  } }));
  if (scene) {
    const S = scene.S; const [PW] = scene.planeSize;
    scene.onFrame = () => {
      for (let i = 0; i < 4; i++) { const k = `a${i}`; S[k] += (tgt[i] - S[k]) * 0.12; }
      const show = clamp((S.gap - 0.14) / 0.3, 0, 1) * (scene.S.visible ? 1 : 0);
      const cur = Number(lay.dataset.cur ?? -1);
      lbls.forEach((l) => {
        const i = Number(l.dataset.i); const [x, y] = scene.project(PW * 0.5, scene.layerY(i), 0.98);
        l.style.transform = `translate(${Math.min(x + 10, innerWidth - 170)}px, ${y - 10}px)`;
        l.style.opacity = String(show * (cur < 0 || i === cur ? 1 : 0.35));
      });
    };
  }

  // chức năng cuộn ngang
  const feat = $('feat'), track = $('feat-track');
  if (!mobile()) {
    const dist = Math.max(0, track.scrollWidth - innerWidth + 40);
    feat.style.height = `${vh + dist}px`;
    scrubs.push(Motion.scrub(feat, { start: 'top top', end: 'bottom bottom', smooth: 0.06, onUpdate: (p) => Motion.set(track, { x: -dist * p }) }));
  } else { feat.style.height = ''; Motion.set(track, { x: 0 }); }
  Motion.refresh();
}

/* ---------- sơ đồ cây ---------- */
function setupTree() {
  const tree = $('tree'); const paths = [...tree.querySelectorAll('.tr-lines path')]; const nodes = [...tree.querySelectorAll('.tr-node, .tr-cap, .tr-note')];
  paths.forEach((p) => { const l = p.getTotalLength(); p.style.strokeDasharray = `${l}`; p.style.strokeDashoffset = `${l}`; p.dataset.l = String(l); });
  const tl = Motion.timeline({ paused: true });
  const o = paths.map(() => ({ v: 1 }));
  paths.forEach((p, i) => tl.to(o[i], { v: 0, duration: 0.9, ease: 'power2.inOut', onUpdate: () => { p.style.strokeDashoffset = String(o[i].v * Number(p.dataset.l)); } }, 0.15 + i * 0.12));
  tl.from(nodes, { opacity: 0, y: 14, duration: 0.7, stagger: 0.07, ease: 'power3.out' }, 0);
  Motion.enter(tree, () => tl.play(), { margin: '0px 0px -25% 0px' });
}

/* ---------- kính lúp địa bạ (mục 04) ---------- */
function setupLens(D) {
  const cv = $('sil'); if (!D) { cv.hidden = true; return; }
  let lens = null, building = false;
  { const bq = D.meta.bboxQ; cv.style.aspectRatio = String((bq[2] - bq[0]) / (bq[3] - bq[1])); }
  // chỉ dựng (việc nặng) khi người dùng cuộn gần tới mục này
  new IntersectionObserver((es) => {
    const e = es[0];
    if (!lens && !building && (e.isIntersecting || e.boundingClientRect.top < innerHeight * 2)) {
      building = true;
      setTimeout(() => {
        try { lens = createLens(cv, D, CFG); if (!lens) { cv.hidden = true; return; } cv.style.aspectRatio = String(lens.aspect); lens.visible = e.isIntersecting; } catch { cv.hidden = true; }
      }, 0);
    }
    if (lens) lens.visible = e.isIntersecting;
  }, { rootMargin: '160% 0px 160% 0px' }).observe(cv);
}

/* ---------- thẻ mẫu từ dữ liệu thật ---------- */
function setupSample(D) {
  const R = D.attrs.rows; const card = $('lk-card'); let done = false;
  const rowOf = (i) => { const r = R[i]; return { to: r[0], thua: r[1], dt: r[2], dtpl: r[3], ma: r[4], ten: r[5] >= 0 ? D.attrs.ten[r[5]] : null, dc: r[6] >= 0 ? D.attrs.dc[r[6]] : null, tyle: r[8], cqh: r[9] }; };
  const show = (pick, items) => {
    const art = h('article', { class: 'deed' }); card.replaceChildren(art);
    art.replaceChildren(...deedNodes(rowOf(pick), items, { kyQH: CFG.KY_QUY_HOACH, titleId: 'sample-title' })); paintSwatches(art);
  };
  Motion.enter(card, async () => {
    if (done) return; done = true;
    try {
      const ct = await loadPack('ct'); // mẫu cố định: tờ 1 thửa 14
      const pick = R.findIndex((r) => r[0] === 1 && r[1] === 14);
      if (pick >= 0) show(pick, planItems(ct, pick));
    } catch { /* không dựng được thẻ mẫu thì bỏ trống */ }
  }, { margin: '0px 0px 10% 0px' });
}

boot().catch(() => { try { $('loader').hidden = true; curtain.reveal({ x: 0, y: 0 }); } catch { /* bỏ qua */ } });
