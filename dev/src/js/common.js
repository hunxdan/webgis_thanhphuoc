// common.js — phần dùng chung của mọi trang: hạt giấy, đổ cấu hình vào HTML, chuyển cảnh, biểu tượng.
import { CFG, h, grainURL } from './util.js';
import { createCurtain, wireLinks } from './curtain.js';

/** Hạt giấy: một ô nhiễu nhỏ (đã gồm độ mờ) làm NỀN của các bề mặt giấy qua biến CSS --grain (nền trang, mục, thẻ, thanh điều hướng, bảng thông tin).
 *  Ô hạt được sinh và đóng gói PNG bằng mã thuần (util.grainURL), KHÔNG đi qua canvas.toBlob — Zen/Firefox chặn đọc ngược canvas nên cách cũ hay mất hạt. */
export function paintGrain() {
  const old = document.getElementById('grain'); if (old) old.remove();
  document.documentElement.style.setProperty('--grain', `url("${grainURL()}")`);
}

export function fillCfg() {
  document.querySelectorAll('[data-cfg]').forEach((el) => { el.textContent = CFG[el.dataset.cfg] ?? ''; });
  document.title = `${document.body.dataset.title || CFG.TEN_DU_AN} · ${CFG.TEN_XA}`;
}

export function initChrome() {
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
export function icon(name, size) {
  return h('svg:svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', width: size, height: size },
    h('svg:path', { d: P[name] }));
}
