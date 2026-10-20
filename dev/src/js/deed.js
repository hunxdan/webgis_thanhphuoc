// deed.js — thẻ thông tin thửa đất (dùng chung cho trang tra cứu và trang giới thiệu).
import { h, clamp, fmt1, fmtArea, colTD, colQH } from './util.js';
import { icon } from './common.js';

/** Tô màu ô mẫu theo bảng màu gốc của dữ liệu (data-c = mã màu). */
export function paintSwatches(root) {
  root.querySelectorAll('[data-c]').forEach((n) => { n.style.background = n.dataset.c; });
}

/** Biểu đồ tròn: độ dài mỗi cung = trường TyLe_QH của dữ liệu (không tính lại từ diện tích); số giữa vòng = TyLeQH của dữ liệu. */
export function donut(items, tyle) {
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
export function deedNodes(r, items, { kyQH, onClose, titleId = 'deed-title' }) {
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
export function planItems(ct, i) {
  if (!ct) return null; const out = new Map();
  for (let k = ct.ctStart[i]; k < ct.ctStart[i + 1]; k++) {
    const c = ct.code[k]; const [ma, ten] = ct.meta.codes[c];
    const cur = out.get(c) || { ma, ten, dt: 0, tyle: 0 }; cur.dt += ct.dt[k]; cur.tyle += ct.tyle[k]; out.set(c, cur);
  }
  return [...out.values()].sort((a, b) => b.dt - a.dt);
}
