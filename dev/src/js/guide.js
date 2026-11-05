// guide.js — trang Hướng dẫn sử dụng: nội dung chính nằm sẵn trong huongdan.html (đọc được cả khi tắt JavaScript);
// mã này chỉ thêm các biểu tượng nút (dùng chính biểu tượng của trang Tra cứu), chân trang và hiệu ứng chuyển cảnh.
import { CFG, h, fmt0 } from './util.js';
import Motion from './motion.js';
import { initChrome, icon } from './common.js';
import { oldIcon } from './icons.js';

const $ = (id) => document.getElementById(id);
const curtain = initChrome();
const safe = (fn) => { try { fn(); } catch { /* bỏ qua: trang vẫn đọc được */ } };

// Các nút công cụ (đúng thứ tự và tên như trang Tra cứu)
const TOOLS = [
  { name: 'Lớp bản đồ', d: 'Bật hoặc tắt từng lớp: Thửa đất, Địa chính, Quy hoạch. Kéo thanh để chỉnh độ trong suốt.', ic: () => oldIcon('layer', 34) },
  { name: 'Nền bản đồ', d: 'Đổi qua lại giữa nền Giấy và ảnh Vệ tinh.', ic: () => oldIcon('basemap', 28) },
  { name: 'Vị trí của tôi', d: 'Cho biết bạn đang đứng ở đâu trên bản đồ.', ic: () => oldIcon('gps', 28) },
  { name: 'Toàn vùng', d: 'Quay về toàn cảnh xã. Dùng khi bị lạc hoặc muốn bắt đầu lại.', ic: () => oldIcon('home', 28) },
  { name: 'Đo đạc', d: 'Đo chiều dài, chu vi và diện tích bằng cách chấm điểm trên bản đồ.', ic: () => oldIcon('ruler', 28) },
  { name: 'Phóng to', d: 'Xem gần hơn. Có thể lăn con lăn chuột hoặc banh hai ngón tay.', ic: () => icon('plus') },
  { name: 'Thu nhỏ', d: 'Xem xa hơn, thấy được nhiều thửa đất hơn.', ic: () => icon('minus') },
];

safe(() => {
  $('gk-tools').replaceChildren(...TOOLS.map((t) => h('li', null,
    h('span', { class: 'gk-tools__i' }, t.ic()), h('div', null, h('h4', null, t.name), h('p', null, t.d)))));
});
safe(() => {
  $('gk-mock-tools').replaceChildren(...TOOLS.map((t) => h('span', null, t.ic())));
});

safe(() => {
  $('foot-team').textContent = `Thực hiện: ${CFG.NHOM_THUC_HIEN.join(' · ')}`;
  $('foot-copy').textContent = `© ${new Date().getFullYear()} ${CFG.TEN_DU_AN} · ${CFG.BAN_QUYEN}`;
});

/* ---------- màn tải: số nhảy như hai trang kia ---------- */
$('loader-tag').textContent = `${CFG.TEN_XA} · ${CFG.TEN_TINH}`;
const target = CFG.THONG_KE?.[0]?.so || 17820;
let lp = 0, shown = 0;
const loadTick = Motion.ticker.add((dt) => { shown += (lp * target - shown) * Math.min(1, dt * 5); $('loader-n').textContent = fmt0(Math.round(shown)); });
const step = (p) => { lp = Math.max(lp, p); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Phòng hờ: nếu có gì treo, vẫn gỡ màn xanh sau 8 giây để trang đọc được.
setTimeout(() => { safe(() => { const l = $('loader'); if (l && !l.hidden) { l.hidden = true; curtain.reveal({ x: innerWidth * 0.5, y: innerHeight * 0.5 }); startMotion(); } }); }, 8000);

/* ---------- hiệu ứng hiện dần khi vào trang và khi lướt xuống ---------- */
let motionStarted = false;
function startMotion() {
  if (motionStarted) return; motionStarted = true;
  safe(heroIntro); safe(wireReveal);
}
function heroIntro() {
  const t = document.querySelector('.gk-hero__t');
  const sp = Motion.splitText(t, { chars: true });
  Motion.timeline()
    .from('.gk-hero__k', { y: 16, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0.1)
    .from(sp.chars, { yPercent: 112, rotate: 5, duration: 1, stagger: 0.025, ease: 'expo.out' }, 0.15)
    .from('.gk-hero__cta', { y: 22, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0.85)
    .from('.gk-jump', { y: 22, opacity: 0, duration: 0.8, ease: 'power3.out' }, 1.05);
}
function wireReveal() {
  // tiêu đề phần: tách từ, từng từ trồi lên
  document.querySelectorAll('.gk-h2').forEach((el) => {
    const sp = Motion.splitText(el, { chars: false });
    const tl = Motion.timeline({ paused: true }).from(sp.words, { yPercent: 108, rotate: 3, duration: 0.95, stagger: 0.07, ease: 'expo.out' });
    Motion.enter(el, () => tl.play());
  });
  // nhãn "§ 0x" và các khối khác: hiện nhẹ từ dưới lên, các thẻ cùng hàng lệch nhịp nhau một chút
  const up = (sel, cols = 1) => document.querySelectorAll(sel).forEach((el, i) => {
    const tl = Motion.timeline({ paused: true }).from(el, { y: 34, opacity: 0, duration: 0.9, delay: (i % cols) * 0.1, ease: 'power3.out' });
    Motion.enter(el, () => tl.play(), { margin: '0px 0px -8% 0px' });
  });
  up('.gk-sec .tag.red:not(.gk-phone .tag)');
  up('.gk-s3', 3); up('.gk-note'); up('.gk-fig'); up('.gk-legend li'); up('.gk-h3');
  up('.gk-tools li', 2); up('.gk-card', 2); up('.gk-phone'); up('.gk-dl > div');
  up('.gk-trouble li'); up('.gk-helpgrid .btn');
  // dấu quy hoạch đang xoay sẵn bằng CSS: chỉ hiện dần, không đụng tới transform
  document.querySelectorAll('.gk-stamp').forEach((el, i) => {
    const tl = Motion.timeline({ paused: true }).from(el, { opacity: 0, duration: 0.9, delay: 0.15 + i * 0.25, ease: 'power2.out' });
    Motion.enter(el, () => tl.play(), { margin: '0px 0px -8% 0px' });
  });
  // các nút cử chỉ trong khối điện thoại
  document.querySelectorAll('.gk-gest li').forEach((el, i) => {
    const tl = Motion.timeline({ paused: true }).from(el, { y: 24, opacity: 0, duration: 0.8, delay: i * 0.12, ease: 'power3.out' });
    Motion.enter(el, () => tl.play(), { margin: '0px 0px -5% 0px' });
  });
}

/* ---------- mở trang ---------- */
(async () => {
  step(0.2);
  const fontsReady = (document.fonts?.ready || Promise.resolve()).then(() => step(0.65));
  const pageLoaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => addEventListener('load', r, { once: true }));
  await Promise.all([fontsReady.catch(() => {}), pageLoaded, wait(900)]);
  step(1);
  await wait(650); // để số kịp chạy tới cuối
  Motion.ticker.remove(loadTick); $('loader-n').textContent = fmt0(target);
  await wait(150);
  Motion.to($('loader'), { opacity: 0, duration: 0.25 });
  await wait(80);
  $('loader').hidden = true;
  curtain.reveal({ x: innerWidth * 0.7, y: innerHeight * 0.4 }, 0.8);
  startMotion();
})().catch(() => { safe(() => { $('loader').hidden = true; curtain.reveal({ x: 0, y: 0 }); startMotion(); }); });
