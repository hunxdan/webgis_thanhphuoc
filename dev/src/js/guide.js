// guide.js — trang Hướng dẫn sử dụng: nội dung chính nằm sẵn trong huongdan.html (đọc được cả khi tắt JavaScript);
// mã này chỉ thêm các biểu tượng nút (dùng chính biểu tượng của trang Tra cứu), chân trang và hiệu ứng chuyển cảnh.
import { CFG, h } from './util.js';
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

// Mở trang: kéo màn chuyển cảnh ra (không đợi tải dữ liệu vì trang này không dùng dữ liệu bản đồ)
requestAnimationFrame(() => { try { curtain.reveal({ x: innerWidth * 0.7, y: innerHeight * 0.4 }, 0.8); } catch { /* bỏ qua */ } });
