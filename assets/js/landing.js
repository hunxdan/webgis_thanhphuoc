(() => {
const __defs = {}, __cache = {};
function __m(id) { if (__cache[id]) return __cache[id]; const e = __cache[id] = {}; __defs[id](e); return e; }
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/landing.js"] = function (__e) {
// landing.js — trang giới thiệu: dựng nội dung từ config, điều phối cảnh 3D theo vị trí cuộn.
const { CFG, h, clamp, fmt0, loadPack, loadJSON, toast } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const Motion = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/motion.js").default;
const { initChrome, icon } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/common.js");
const { createScene } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/scene.js");
const { createLens } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/lens.js");
const { deedNodes, planItems, paintSwatches } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/deed.js");

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


};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js"] = function (__e) {
// util.js — tiện ích dùng chung. Không dùng innerHTML: mọi nội dung đi qua textContent.

const CFG = window.WEBGIS_CONFIG;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mapRange = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Dựng phần tử DOM an toàn: h('div', {class:'x', onclick:fn}, 'text', child…) */
function h(tag, attrs, ...kids) {
  const svg = tag.startsWith('svg:');
  const el = svg ? document.createElementNS(SVG_NS, tag.slice(4)) : document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const fmt0 = (n) => nf0.format(n);
const fmt1 = (n) => nf1.format(n);
const fmt2 = (n) => nf2.format(n);
const fmtArea = (m2) => (m2 == null ? '—' : `${m2 >= 1e4 ? fmt2(m2) : fmt1(m2)} m²`);

/** Bỏ dấu tiếng Việt, hạ chữ thường — dùng cho tìm kiếm. */
function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

/** Làm sạch ô nhập: giới hạn độ dài, chỉ giữ chữ, số, khoảng trắng và vài dấu câu. */
function cleanText(s, max = 60) {
  return String(s ?? '').normalize('NFC').replace(/[^\p{L}\p{N}\s.,\-/]/gu, '').replace(/\s+/g, ' ').slice(0, max);
}
/** Số nguyên dương hoặc null. */
function posInt(s, maxDigits = 6) {
  const t = String(s ?? '').trim();
  if (!/^\d+$/.test(t) || t.length > maxDigits) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** Che một phần tên người; giữ nguyên tên tổ chức. Idempotent (chạy lại không đổi). */
const ORG = /^(ủy ban|uỷ ban|ubnd|ban |công ty|cty|hợp tác xã|htx|trường|trạm|nhà thờ|chùa|đình|miếu|tổng công ty|doanh nghiệp|bộ |sở |chi nhánh|xí nghiệp|tập đoàn|đảng|đoàn|hội|nhà máy|trung tâm|bệnh viện|quân|công an|nhà nước|tòa|toà|viện|điện lực)/i;
function maskOwner(name) {
  if (!name || ORG.test(name)) return name;
  return name.split(' ').map((w, i) => (i === 0 || w.includes('*') ? w : `${w[0]}***`)).join(' ');
}

/* localStorage chỉ cho thiết lập giao diện — luôn bọc try/catch. */
const store = {
  get(k, d) { try { const v = localStorage.getItem(`wg.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`wg.${k}`, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};

/* ---------- Tải gói dữ liệu nhị phân ---------- */
const TA = { Int32Array, Uint32Array, Uint8Array, Uint16Array, Int16Array, Float32Array };
const OFFLINE = location.protocol === 'file:';
let offlineP = null;
/** Mở trực tiếp bằng file:// thì trình duyệt cấm fetch: nạp dữ liệu từ data/offline.js (thẻ script thường). */
function offline() {
  if (!offlineP) offlineP = new Promise((res, rej) => {
    if (window.__WG_DATA) return res(window.__WG_DATA);
    const sc = document.createElement('script'); sc.src = 'data/offline.js';
    sc.onload = () => (window.__WG_DATA ? res(window.__WG_DATA) : rej(new Error('data'))); sc.onerror = () => rej(new Error('data'));
    document.head.appendChild(sc);
  });
  return offlineP;
}
const b64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u.buffer; };
/** Địa chỉ ảnh (data: URI khi chạy file:// để canvas/WebGL không bị coi là khác nguồn). */
async function imageSrc(name, url) { if (!OFFLINE) return url; const d = await offline(); return d.img[name] || url; }

async function loadPack(name) {
  let meta, buf;
  if (OFFLINE) { const d = (await offline()).pack[name]; if (!d) throw new Error('data'); meta = d.json; buf = b64(d.bin); }
  else {
    [meta, buf] = await Promise.all([
      fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error('data'); return r.json(); }),
      fetch(`data/${name}.bin`).then((r) => { if (!r.ok) throw new Error('data'); return r.arrayBuffer(); }),
    ]);
  }
  const idx = meta.index ?? meta;
  const out = { meta };
  for (const [k, v] of Object.entries(idx)) {
    const T = TA[v.type]; if (!T) throw new Error('data');
    out[k] = new T(buf, v.offset, v.length);
  }
  return out;
}
const loadJSON = async (name) => {
  if (OFFLINE) { const d = (await offline()).json[name]; if (!d) throw new Error('data'); return d; }
  return fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error('data'); return r.json(); });
};

/** Toạ độ mét (Web Mercator) tương đối gốc -> lon/lat. */
const R = 6378137;
function relToLonLat(meta, x, y) {
  const X = meta.origin.mx + x, Y = meta.origin.my + y;
  return { lon: (X / R) * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(Y / R)) - Math.PI / 2) * 180 / Math.PI };
}
function lonLatToRel(meta, lon, lat) {
  const X = (lon * Math.PI / 180) * R;
  const Y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R;
  return { x: X - meta.origin.mx, y: Y - meta.origin.my };
}

function el$(sel, root = document) { return root.querySelector(sel); }
function all$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/** Thông báo ngắn. */
function toast(msg, ms = 3200) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

/** Lỗi chung cho người dùng — không lộ đường dẫn nội bộ. */
function fail(msg = 'Không tải được dữ liệu. Vui lòng thử lại sau.') {
  toast(msg, 6000);
}

/* ---------- bảng màu GỐC theo mã loại đất / mã quy hoạch (config.js) ---------- */
const colTD = (ma) => (CFG.MAU_THUA && CFG.MAU_THUA[ma]) || CFG.MAU_THUA_MAC_DINH;
const colQH = (ma) => (CFG.MAU_QH && CFG.MAU_QH[ma]) || CFG.MAU_QH_MAC_DINH;
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Ô nhiễu hạt giấy 220x220 (lớp đen trong suốt, đã gồm độ mờ chung 0,22): dùng làm nền giấy ở trang (CSS) và ở nền Giấy của bản đồ (canvas). */
function grainTile() {
  const t = document.createElement('canvas'); t.width = t.height = 220;
  const tc = t.getContext('2d'); const id = tc.createImageData(220, 220);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 255 - Math.pow(Math.random(), 2.2) * 120;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = 0; id.data[i + 3] = Math.round((255 - v) * 0.22);
  }
  tc.putImageData(id, 0, 0); return t;
}

/* ---------- Hạt giấy KHÔNG qua canvas ----------
 * Firefox/Zen (và các trình duyệt bật chống fingerprint) chặn hoặc làm nhiễu việc đọc ngược canvas (toBlob / toDataURL / getImageData),
 * nên ô hạt từng được dựng bằng canvas rồi toBlob() sẽ trắng/mất hạt. Ở đây ô hạt được sinh thẳng ra mảng byte và đóng gói thành PNG
 * (xám + alpha, zlib dạng "stored") bằng mã thuần: không đụng tới canvas nên trình duyệt nào cũng hiện hạt. */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const adler32 = (u8) => { let a = 1, b = 0; for (let i = 0; i < u8.length; i++) { a = (a + u8[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; };
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function pngChunk(type, data) {
  const t = [...type].map((c) => c.charCodeAt(0)); const body = new Uint8Array(4 + data.length); body.set(t, 0); body.set(data, 4);
  const out = new Uint8Array(12 + data.length); out.set(be32(data.length), 0); out.set(body, 4); out.set(be32(crc32(body)), 8 + data.length); return out;
}
/** PNG xám + alpha 8 bit từ mảng ga (w*h*2 byte: xám, alpha). */
function encodePngGA(w, h, ga) {
  const stride = 1 + w * 2; const raw = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) raw.set(ga.subarray(y * w * 2, (y + 1) * w * 2), y * stride + 1);
  const parts = [new Uint8Array([0x78, 0x01])];
  for (let o = 0; o < raw.length; o += 65535) {
    const n = Math.min(65535, raw.length - o); const hd = new Uint8Array([o + n >= raw.length ? 1 : 0, n & 255, n >> 8, ~n & 255, (~n >> 8) & 255]);
    parts.push(hd, raw.subarray(o, o + n));
  }
  parts.push(new Uint8Array(be32(adler32(raw))));
  const zl = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let k = 0; for (const p of parts) { zl.set(p, k); k += p.length; }
  const ihdr = new Uint8Array([...be32(w), ...be32(h), 8, 4, 0, 0, 0]);
  const chunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zl), pngChunk('IEND', new Uint8Array(0))];
  const png = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0)); k = 0; for (const c of chunks) { png.set(c, k); k += c.length; } return png;
}
let grainUrl = null;
/** Địa chỉ ảnh hạt giấy (blob:, hoặc data: nếu blob không dùng được). Cùng phân bố với grainTile(). */
function grainURL() {
  if (grainUrl) return grainUrl;
  const N = 220; const ga = new Uint8Array(N * N * 2);
  for (let i = 0; i < N * N; i++) { ga[2 * i] = 0; ga[2 * i + 1] = Math.round(Math.pow(Math.random(), 2.2) * 120 * 0.22); }
  const png = encodePngGA(N, N, ga);
  try { grainUrl = URL.createObjectURL(new Blob([png], { type: 'image/png' })); }
  catch { let b = ''; for (let i = 0; i < png.length; i += 0x8000) b += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000)); grainUrl = `data:image/png;base64,${btoa(b)}`; }
  return grainUrl;
}

__e["CFG"] = CFG;
__e["clamp"] = clamp;
__e["lerp"] = lerp;
__e["mapRange"] = mapRange;
__e["prefersReducedMotion"] = prefersReducedMotion;
__e["h"] = h;
__e["fmt0"] = fmt0;
__e["fmt1"] = fmt1;
__e["fmt2"] = fmt2;
__e["fmtArea"] = fmtArea;
__e["norm"] = norm;
__e["cleanText"] = cleanText;
__e["posInt"] = posInt;
__e["maskOwner"] = maskOwner;
__e["store"] = store;
__e["imageSrc"] = imageSrc;
__e["loadPack"] = loadPack;
__e["loadJSON"] = loadJSON;
__e["relToLonLat"] = relToLonLat;
__e["lonLatToRel"] = lonLatToRel;
__e["el$"] = el$;
__e["all$"] = all$;
__e["toast"] = toast;
__e["fail"] = fail;
__e["colTD"] = colTD;
__e["colQH"] = colQH;
__e["hex2rgb"] = hex2rgb;
__e["grainTile"] = grainTile;
__e["grainURL"] = grainURL;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/motion.js"] = function (__e) {
// motion.js — engine chuyển động nhỏ gọn, tự viết (timeline, stagger, tách chữ, animation theo vị trí cuộn).
// API gần với GSAP để dễ thay thế: Motion.to / from / fromTo / set / timeline / splitText / scrub / enter / counter.
const { clamp, lerp } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");

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


__e["default"] = Motion;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/common.js"] = function (__e) {
// common.js — phần dùng chung của mọi trang: hạt giấy, đổ cấu hình vào HTML, chuyển cảnh, biểu tượng.
const { CFG, h, grainURL } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const { createCurtain, wireLinks } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/curtain.js");

/** Hạt giấy: một ô nhiễu nhỏ (đã gồm độ mờ) làm NỀN của các bề mặt giấy qua biến CSS --grain (nền trang, mục, thẻ, thanh điều hướng, bảng thông tin).
 *  Ô hạt được sinh và đóng gói PNG bằng mã thuần (util.grainURL), KHÔNG đi qua canvas.toBlob — Zen/Firefox chặn đọc ngược canvas nên cách cũ hay mất hạt. */
function paintGrain() {
  const old = document.getElementById('grain'); if (old) old.remove();
  document.documentElement.style.setProperty('--grain', `url("${grainURL()}")`);
}

function fillCfg() {
  document.querySelectorAll('[data-cfg]').forEach((el) => { el.textContent = CFG[el.dataset.cfg] ?? ''; });
  document.title = `${document.body.dataset.title || CFG.TEN_DU_AN} · ${CFG.TEN_XA}`;
}

function initChrome() {
  paintGrain(); fillCfg();
  const c = createCurtain(document.getElementById('curtain')); wireLinks(c);
  return c;
}

const P = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  gps: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  ruler: 'M3.5 16.5 16.5 3.5l4 4-13 13zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2',
  close: 'M6 6l12 12M18 6 6 18',
  layers: 'M12 3 21 8l-9 5-9-5zM3 13l9 5 9-5',
  arrowUR: 'M7 17 17 7M8 7h9v9',
  arrowDown: 'M12 4v16M6 14l6 6 6-6',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  route: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6',
  check: 'M5 12.5l4.5 4.5L19 7',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
  plusS: 'M12 6v12M6 12h12',
};
function icon(name, size) {
  return h('svg:svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', width: size, height: size },
    h('svg:path', { d: P[name] }));
}

__e["paintGrain"] = paintGrain;
__e["fillCfg"] = fillCfg;
__e["initChrome"] = initChrome;
__e["icon"] = icon;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/curtain.js"] = function (__e) {
// curtain.js — chuyển cảnh bằng shader WebGL: mực loang theo nhiễu fbm, viền son – kem – lục.
const Motion = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/motion.js").default;

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

function createCurtain(canvas) {
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
function wireLinks(curtain) {
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

__e["createCurtain"] = createCurtain;
__e["wireLinks"] = wireLinks;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/scene.js"] = function (__e) {
// scene.js — cảnh 3D WebGL2 thuần: bốn tầng bản đồ dựng từ dữ liệu thật + 17.820 khối thửa đất "dựng lên như toà nhà"
// (dựng khối lăng trụ theo đúng hình thửa; chiều cao = log diện tích thửa; có chiều sâu, ánh sáng, đổ bóng góc). Shader gợn sóng theo con trỏ, biến dạng ảnh, tầng tách khi cuộn.
const { clamp, colTD, colQH } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const { bakeCanvas } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/bake.js");

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
async function createScene(canvas, D, cfg, progress = () => {}) {
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

__e["createScene"] = createScene;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/bake.js"] = function (__e) {
// bake.js — "nướng" lớp bản đồ thành ảnh bằng GPU (WebGL2): tô thửa bằng tam giác đã chia sẵn, kẻ ranh giới bằng GL_LINES.
// Nhanh hơn rất nhiều so với tô/kẻ hàng chục nghìn đường bằng Canvas2D (vốn làm trang giới thiệu bị khựng).
const { hex2rgb } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");

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
function bakeCanvas(pack, q, bb, W, H, opt) {
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

__e["bakeCanvas"] = bakeCanvas;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/lens.js"] = function (__e) {
// lens.js — "kính lúp địa bạ": sơ đồ nét mảnh của cả xã; kính lúp (theo con trỏ, tự di chuyển khi không ai chạm)
// phóng to và tô màu hiện trạng đất thật bên trong. Canvas2D thuần, chỉ vẽ khi đang trong màn hình.
const { colTD } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const { bakeCanvas } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/bake.js");
function createLens(canvas, D, cfg) {
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

__e["createLens"] = createLens;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/deed.js"] = function (__e) {
// deed.js — thẻ thông tin thửa đất (dùng chung cho trang tra cứu và trang giới thiệu).
const { h, clamp, fmt1, fmtArea, colTD, colQH } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const { icon } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/common.js");

/** Tô màu ô mẫu theo bảng màu gốc của dữ liệu (data-c = mã màu). */
function paintSwatches(root) {
  root.querySelectorAll('[data-c]').forEach((n) => { n.style.background = n.dataset.c; });
}

/** Biểu đồ tròn: độ dài mỗi cung = trường TyLe_QH của dữ liệu (không tính lại từ diện tích); số giữa vòng = TyLeQH của dữ liệu. */
function donut(items, tyle) {
  const C = 2 * Math.PI * 46; const svg = h('svg:svg', { viewBox: '0 0 120 120', class: 'donut', role: 'img', 'aria-label': `Tỷ lệ quy hoạch ${fmt1(tyle ?? 0)}%` });
  svg.append(h('svg:circle', { cx: 60, cy: 60, r: 46, fill: 'none', stroke: 'var(--paper-3)', 'stroke-width': 15 }));
  let off = 0; const arcs = [];
  for (const it of items) {
    const len = clamp((it.tyle || 0) / 100, 0, 1) * C; if (len < 0.5) continue;
    const c = h('svg:circle', { cx: 60, cy: 60, r: 46, fill: 'none', stroke: colQH(it.ma), 'stroke-width': 15, 'stroke-dasharray': `0 ${C}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 60 60)', class: 'donut__arc' });
    svg.append(c); arcs.push([c, len]); off += len;
  }
  svg.append(h('svg:circle', { cx: 60, cy: 60, r: 38.5, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 0.6, 'stroke-dasharray': '2 3', opacity: 0.5 }));
  const go = () => arcs.forEach(([c, len]) => c.setAttribute('stroke-dasharray', `${Math.max(0, len - 1)} ${C}`));
  requestAnimationFrame(() => requestAnimationFrame(go));
  return h('div', { class: 'donut-wrap' }, svg, h('div', { class: 'donut__c' }, h('b', { class: 'num' }, `${fmt1(tyle ?? 0)}`, h('small', null, '%')), h('span', null, 'trong quy hoạch')));
}

/**
 * r: {to,thua,dt,dtpl,ma,ten,dc,tyle,cqh} — mọi giá trị lấy nguyên từ dữ liệu
 * items: mảng {ma,ten,dt,tyle} (từ QH_CHI_TIET) | null (đang tải)
 */
function deedNodes(r, items, { kyQH, onClose, titleId = 'deed-title' }) {
  const row = (k, v) => h('div', { class: 'row' }, h('dt', null, k), h('dd', null, v));
  return [
    h('header', { class: 'deed__head' },
      h('p', { class: 'tag' }, 'Thửa đất'),
      onClose ? h('button', { type: 'button', class: 'x', 'aria-label': 'Đóng thẻ thông tin', onclick: onClose }, icon('close')) : null,
      h('h2', { class: 'deed__title', id: titleId }, h('span', null, 'Tờ'), h('b', { class: 'num' }, r.to), h('span', null, 'Thửa'), h('b', { class: 'num' }, r.thua))),
    h('dl', { class: 'deed__rows' },
      h('div', { class: 'row2' },
        h('div', null, h('dt', null, 'Diện tích'), h('dd', { class: 'num' }, fmtArea(r.dt))),
        h('div', null, h('dt', null, 'Diện tích pháp lý'), h('dd', { class: 'num' }, fmtArea(r.dtpl)))),
      row('Hiện trạng', h('span', { class: 'chip' }, h('i', { 'data-c': colTD(r.ma) }), r.ten || '—', r.ma ? h('em', null, r.ma) : null)),
      h('div', { class: 'row row--more' }, h('dt', null, 'Địa chỉ'), h('dd', null, r.dc || '—'))),
    h('section', { class: 'deed__plan', 'aria-labelledby': `${titleId}-p` },
      h('h3', { class: 'tag', id: `${titleId}-p` }, `Quy hoạch ${kyQH}`),
      h('div', { class: 'plan__top' },
        donut(items || [], r.tyle),
        h('div', { class: `stamp ${r.cqh ? 'stamp--yes' : 'stamp--no'}`, 'aria-label': r.cqh ? 'Có quy hoạch' : 'Không quy hoạch' }, h('span', null, r.cqh ? 'Có' : 'Không'), h('b', null, 'quy hoạch'))),
      !r.cqh ? h('p', { class: 'muted' }, 'Chưa có dữ liệu quy hoạch chồng lên thửa đất này.')
        : items === null ? h('p', { class: 'muted' }, 'Đang tải chi tiết quy hoạch…')
          : h('ul', { class: 'plan__list' }, items.map((it) => h('li', null,
            h('i', { 'data-c': colQH(it.ma) }),
            h('div', null, h('b', null, it.ten), h('span', null, `Mã ${it.ma}`)),
            h('div', { class: 'num r' }, h('b', null, fmtArea(it.dt)), h('span', null, `${fmt1(it.tyle)}% thửa`)))))),
  ];
}

/** Gộp các mảnh quy hoạch của thửa i theo mã loại đất. */
function planItems(ct, i) {
  if (!ct) return null; const out = new Map();
  for (let k = ct.ctStart[i]; k < ct.ctStart[i + 1]; k++) {
    const c = ct.code[k]; const [ma, ten] = ct.meta.codes[c];
    const cur = out.get(c) || { ma, ten, dt: 0, tyle: 0 }; cur.dt += ct.dt[k]; cur.tyle += ct.tyle[k]; out.set(c, cur);
  }
  return [...out.values()].sort((a, b) => b.dt - a.dt);
}

__e["paintSwatches"] = paintSwatches;
__e["donut"] = donut;
__e["deedNodes"] = deedNodes;
__e["planItems"] = planItems;
};
__m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/landing.js");
})();
