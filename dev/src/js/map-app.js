// map-app.js — trang tra cứu: nạp dữ liệu, tìm kiếm, thẻ thửa đất, lớp bản đồ, đo đạc.
// Quy tắc: mọi nội dung hiển thị đi qua h()/textContent — không dùng innerHTML.
import { CFG, h, clamp, fmt0, fmt1, fmt2, fmtArea, posInt, store, loadPack, loadJSON, lonLatToRel, colQH, toast, fail } from './util.js';
import Motion from './motion.js';
import { initChrome, icon } from './common.js';
import { MapView } from './mapview.js';
import { deedNodes, planItems, paintSwatches } from './deed.js';
import { oldIcon } from './icons.js';
import { vnToWgs } from './vn2000.js';

const $ = (id) => document.getElementById(id);
const curtain = initChrome();
const mobileMQ = matchMedia('(max-width: 820px)');

/* ---------- màn tải ---------- */
$('loader-tag').textContent = `${CFG.TEN_XA} · ${CFG.TEN_TINH}`;
let loadP = 0, shown = 0; const loadTarget = CFG.THONG_KE?.[0]?.so || 17820;
const loadTick = Motion.ticker.add((dt) => { shown += (loadP * loadTarget - shown) * Math.min(1, dt * 5); $('loader-n').textContent = fmt0(Math.round(shown)); });
const step = (p) => { loadP = Math.max(loadP, p); };

async function boot() {
  let meta, P, qh, attrs;
  try {
    meta = await loadJSON('meta'); step(0.06);
    [P, qh, attrs] = await Promise.all([
      loadPack('parcels').then((x) => { step(0.55); return x; }),
      loadPack('qh').then((x) => { step(0.7); return x; }),
      loadJSON('attrs').then((x) => { step(0.92); return x; }),
    ]);
  } catch {
    $('loader').querySelector('.loader__t').textContent = 'Không tải được dữ liệu. Vui lòng thử lại sau.'; return;
  }
  start({ meta, P, qh, attrs });
}

function start(D) {
  const { meta, attrs } = D; const R = attrs.rows;
  const mapEl = $('map');
  const view = new MapView(mapEl, D, CFG, R);

  /* ---------- chỉ mục tìm kiếm ---------- */
  const bySheet = new Map(), byThua = new Map();
  const push = (m, k, v) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };
  R.forEach((r, i) => { push(bySheet, r[0], i); push(byThua, r[1], i); });
  for (const a of bySheet.values()) a.sort((x, y) => R[x][1] - R[y][1]);
  // danh sách tờ để chọn nhanh: bỏ tờ 0 (các thửa vẽ thêm) và những tờ không có thửa nào (ví dụ tờ 30)
  const sheets = [...bySheet.keys()].filter((k) => k > 0 && bySheet.get(k).length).sort((a, b) => a - b);
  const valid = []; R.forEach((r, i) => { if (r[0] > 0) valid.push(i); }); // thửa của các tờ thật (bỏ tờ 0) — dùng cho chọn ngẫu nhiên

  const rowOf = (i) => { const r = R[i]; return { to: r[0], thua: r[1], dt: r[2], dtpl: r[3], ma: r[4], ten: r[5] >= 0 ? attrs.ten[r[5]] : null, dc: r[6] >= 0 ? attrs.dc[r[6]] : null, dtqh: r[7], tyle: r[8], cqh: r[9], g: r[10] }; };
  const spaced = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  /* ---------- tiện ích bố cục ---------- */
  const viewPad = () => {
    const open = !$('deed').hidden || !$('ticket').hidden;
    if (mobileMQ.matches) return { l: 10, r: 10, t: $('tools').offsetTop + $('tools').offsetHeight + 12, b: open ? ($('rail').getBoundingClientRect().height || innerHeight * 0.4) + 14 : 70 };
    const w = $('rail').getBoundingClientRect().width || 392;
    return { l: open ? w + 44 : 30, r: 84, t: 140, b: 80 };
  };
  let finderOpen = false; // người dùng tự mở lại thanh tìm kiếm khi đang xem thẻ thông tin (điện thoại)
  const updateAvoid = () => {
    const mr = mapEl.getBoundingClientRect();
    { const open = !$('deed').hidden || !$('ticket').hidden; const mini = mobileMQ.matches && open && !finderOpen;
      $('finder').classList.toggle('is-min', mini); $('finder-min').hidden = !mini;
      if (mini) $('finder-min-text').textContent = !$('deed').hidden && sel >= 0 ? `Tờ ${R[sel][0]} · Thửa ${R[sel][1]} — Tìm kiếm khác` : 'Tìm kiếm';
      $('tools').style.top = mobileMQ.matches ? `${$('finder').offsetTop + $('finder').offsetHeight + 8}px` : ''; }
    $('rail').classList.toggle('is-both', !$('deed').hidden && !$('ticket').hidden);
    if (!mobileMQ.matches) $('rail').style.top = `${$('finder').offsetTop + $('finder').offsetHeight + 14}px`; else $('rail').style.top = '';
    { // vùng bản đồ còn nhìn thấy (để đặt nhãn tọa độ X)
      const top = mobileMQ.matches ? $('tools').getBoundingClientRect().bottom - mr.top + 6 : 70;
      const railTop = !$('rail').hidden && ($('deed').hidden === false || $('ticket').hidden === false) && mobileMQ.matches ? $('rail').getBoundingClientRect().top - mr.top : view.H;
      view.band = [top, Math.min(view.H - 40, railTop - 8)]; if (view.band[1] - view.band[0] < 30) view.band = [top, top + 30];
    }
    view.avoid = ['finder', 'tools', 'rail', 'layers', 'measure'].map((id) => $(id)).filter((e) => e && !e.hidden && e.getBoundingClientRect().width)
      .map((e) => { const r = e.getBoundingClientRect(); return { x: r.left - mr.left, y: r.top - mr.top, w: r.width, h: r.height }; });
    view.invalidate();
  };
  const home = (animate = false) => view.fitBounds(view.bb, { pad: viewPad(), maxZoom: 15, animate });

  /* ---------- chọn thửa ---------- */
  let sel = -1, ct = null, ctP = null;
  const loadCT = () => (ctP ||= loadPack('ct').then((p) => { ct = p; view.setCT(p); return p; }).catch(() => { fail(); }));
  function fitParcel(i) {
    const b = view.parcelBounds(i); const px = Math.max(12, (b.x1 - b.x0) * 0.35), py = Math.max(12, (b.y1 - b.y0) * 0.35);
    view.fitBounds({ x0: b.x0 - px, x1: b.x1 + px, y0: b.y0 - py, y1: b.y1 + py }, { pad: viewPad(), maxZoom: 19.3, minZoom: 13, animate: true });
  }
  function ensureVisible(i) {
    const c = view.parcelCenter(i); const [sx, sy] = view.toScreen(c.x, c.y); const p = viewPad();
    if (sx > view.W - p.r || sx < p.l || sy < p.t * 0.6 || sy > view.H - p.b * 0.9) view.centerOn(c.x, c.y, p);
  }
  function selectParcel(i, { fit = false } = {}) {
    sel = i; finderOpen = false; view.setSelected(i); renderDeed(i); updateAvoid();
    if (fit) fitParcel(i); else ensureVisible(i);
    try { history.replaceState(null, '', `#to=${R[i][0]}&thua=${R[i][1]}`); } catch { /* bỏ qua */ }
    if (!ct) loadCT().then(() => { if (sel === i) renderDeed(i); });
    updateAvoid();
  }
  function clearSelection() {
    sel = -1; view.setSelected(-1); $('deed').hidden = true; hideTicket(); hideStack();
    try { history.replaceState(null, '', location.pathname); } catch { /* bỏ qua */ }
    updateAvoid();
  }

  /* ---------- thẻ thửa đất: phần cuộn + hai nút ghim cố định ở đáy ---------- */
  let peek = false; // mặc định hiện đủ; điện thoại có nút Thu gọn để nhường chỗ cho bản đồ
  function renderDeed(i) {
    const r = rowOf(i); const el = $('deed'); const keep = el.querySelector('.deed__scroll')?.scrollTop || 0;
    const nodes = deedNodes(r, planItems(ct, i), { kyQH: CFG.KY_QUY_HOACH, onClose: clearSelection });
    const items = planItems(ct, i);
    const lines = [`Tờ bản đồ số ${r.to}, thửa ${r.thua} — ${CFG.TEN_XA}, ${CFG.TEN_TINH}`, `Diện tích: ${fmtArea(r.dt)}`, `Hiện trạng: ${r.ten || '—'}`, `Địa chỉ: ${r.dc || '—'}`];
    for (const it of items || []) lines.push(`Quy hoạch: ${it.ten || it.ma} (${it.ma}) — ${fmtArea(it.dt)} · ${fmt1(it.tyle)}% thửa`);
    const copyBtn = h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => {
      try { await navigator.clipboard.writeText(lines.join('\n')); toast('Đã sao chép thông tin thửa.'); } catch { toast('Không sao chép được. Hãy thử lại.'); }
    } }, icon('copy', 16), 'Sao chép');
    const routeBtn = h('button', { type: 'button', class: 'btn btn--sm', onclick: () => {
      const c = view.parcelCenter(i); const ll = view.lonLatAt(c.x, c.y);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${ll.lat.toFixed(6)},${ll.lon.toFixed(6)}`, '_blank', 'noopener,noreferrer');
    } }, icon('route', 16), 'Chỉ đường');
    const more = h('button', { type: 'button', class: 'deed__more', 'aria-expanded': String(!peek), onclick: () => { peek = !peek; el.classList.toggle('is-peek', peek); more.setAttribute('aria-expanded', String(!peek)); more.textContent = peek ? 'Chi tiết ▾' : 'Thu gọn ▴'; setTimeout(updateAvoid, 60); } }, peek ? 'Chi tiết ▾' : 'Thu gọn ▴');
    nodes[0].append(more); el.classList.toggle('is-peek', peek);
    el.replaceChildren(nodes[0], h('div', { class: 'deed__scroll' }, ...nodes.slice(1)), h('footer', { class: 'deed__acts' }, copyBtn, routeBtn));
    paintSwatches(el); el.hidden = false; el.setAttribute('aria-labelledby', 'deed-title');
    el.querySelector('.deed__scroll').scrollTop = keep;
  }

  /* ---------- thẻ vùng quy hoạch ---------- */
  function hideTicket() { $('ticket').hidden = true; view.setZone(-1); }
  function showTicket(z) {
    const qh = D.qh; const [ma, ten] = qh.meta.codes[qh.code[z]]; const tt = qh.tt[z] >= 0 ? qh.meta.tt[qh.tt[z]] : null;
    const el = $('ticket'); view.setZone(z); finderOpen = false;
    el.replaceChildren(
      h('header', { class: 'deed__head' }, h('p', { class: 'tag' }, 'Vùng quy hoạch'),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Đóng', onclick: () => { hideTicket(); updateAvoid(); } }, icon('close')),
        h('h2', { class: 'ticket__title' }, h('i', { 'data-c': colQH(ma) }), ten)),
      h('div', { class: 'deed__scroll' }, h('dl', { class: 'deed__rows' }, h('div', { class: 'row' }, h('dt', null, 'Mã loại đất'), h('dd', null, h('span', { class: 'chip' }, h('em', null, ma)))),
        h('div', { class: 'row' }, h('dt', null, 'Diện tích quy hoạch'), h('dd', { class: 'num' }, qh.dtqh && qh.dtqh[z] > 0 ? fmtArea(qh.dtqh[z]) : '—')),
        h('div', { class: 'row' }, h('dt', null, 'Thông tin thêm'), h('dd', null, tt || '—')))));
    paintSwatches(el); el.hidden = false; updateAvoid();
  }

  /* ---------- sự kiện bản đồ ---------- */
  /* ---------- thửa chồng nhau: hộp chọn nhanh ---------- */
  const stack = h('div', { class: 'stack', id: 'stack', hidden: '' }); document.body.append(stack);
  const hideStack = () => { stack.hidden = true; };
  function showStack(list, px, py, current) {
    const mr = mapEl.getBoundingClientRect();
    stack.replaceChildren(h('p', { class: 'tag' }, `${list.length} thửa chồng nhau`),
      ...list.map((i) => h('button', { type: 'button', class: i === current ? 'on' : null, onclick: () => { selectParcel(i, { fit: false }); showStack(list, px, py, i); } },
        h('b', null, `Tờ ${R[i][0]} · Thửa ${R[i][1]}`), h('span', null, fmtArea(R[i][2])))));
    stack.hidden = false; const w = 210;
    stack.style.transform = `translate(${clamp(mr.left + px + 14, 8, innerWidth - w - 8)}px,${clamp(mr.top + py + 14, 8, innerHeight - 40 - list.length * 44)}px)`;
  }
  view.on('click', ({ parcel, parcels, zone, px, py }) => {
    if (rolling) return;
    closePops(); hideStack();
    // thửa đất luôn chọn được, kể cả khi bật lớp quy hoạch (lớp quy hoạch phủ lên không còn chặn việc chọn thửa)
    if (parcel >= 0) { selectParcel(parcel, { fit: !settings.qh }); if (parcels.length > 1) showStack(parcels, px, py, parcel); }
    else if (!settings.qh) clearSelection();
    if (settings.qh) { if (zone >= 0) showTicket(zone); else hideTicket(); } // bật lớp quy hoạch: hiện thêm thẻ vùng quy hoạch tại điểm bấm
    updateAvoid();
  });
  const tip = $('tip');
  let tipKey = '';
  view.on('hover', (i, px, py, n, z) => {
    const mr = view.rect || mapEl.getBoundingClientRect(); // dùng khung đã lưu: gọi getBoundingClientRect sau khi sửa DOM buộc tính lại layout cả trang ở mỗi lần rê
    const key = `${z}|${i}|${n}`;
    if (key === tipKey && !tip.hidden && (z >= 0 || i >= 0)) { tip.style.transform = `translate(${clamp(mr.left + px + 16, 8, innerWidth - 240)}px,${clamp(mr.top + py + 18, 8, innerHeight - 60)}px)`; return; }
    tipKey = key;
    if (z >= 0) {
      const qh = D.qh; const nm = qh.meta.codes[qh.code[z]];
      tip.replaceChildren(h('b', null, nm[1]), h('span', null, `Mã ${nm[0]}${i >= 0 ? ` · Tờ ${R[i][0]} · Thửa ${R[i][1]}` : ''}`));
    } else if (i >= 0) {
      const r = R[i]; const ten = r[5] >= 0 ? attrs.ten[r[5]] : '';
      tip.replaceChildren(h('b', null, `Tờ ${r[0]} · Thửa ${r[1]}`), h('span', null, `${ten || fmtArea(r[2])}${n > 1 ? ` · ${n} thửa chồng nhau` : ''}`));
    } else { tip.hidden = true; return; }
    tip.hidden = false; const x = clamp(mr.left + px + 16, 8, innerWidth - 240), y = clamp(mr.top + py + 18, 8, innerHeight - 60);
    tip.style.transform = `translate(${x}px,${y}px)`;
  });
  const sbBar = $('scale-bar'), sbLab = $('scale-label'); let lastSb = '';
  view.on('frame', () => { const s = view.scaleBar(); const k = `${s.px | 0}${s.label}`; if (k !== lastSb) { lastSb = k; sbBar.style.width = `${s.px}px`; sbLab.textContent = s.label; } });
  const coordEl = $('coords');
  view.on('coords', (c) => { coordEl.textContent = `VN-2000 · X ${spaced(c.X)} · Y ${spaced(c.Y)}`; });
  view.on('press', cancelRoll); // chạm/kéo bản đồ khi đang chạy ngẫu nhiên = dừng
  view.on('tile-error', () => toast('Không tải được ảnh vệ tinh. Kiểm tra kết nối mạng hoặc chuyển về nền Giấy.'));

  /* ---------- công cụ bên phải & bảng lớp ---------- */
  for (const [id, name] of [['t-layers', 'layer'], ['t-base', 'basemap'], ['t-gps', 'gps'], ['t-home', 'home'], ['t-measure', 'ruler']]) $(id).append(oldIcon(name, name === 'layer' ? 30 : 26));
  $('t-in').append(icon('plus')); $('t-out').append(icon('minus'));
  $('ic-thua').append(oldIcon('thua', 40)); $('ic-qh').append(oldIcon('qh', 40)); $('ic-dc').append(icon('grid', 26));

  const settings = { basemap: store.get('basemap', 'paper') === 'sat' ? 'sat' : 'paper', opThua: clamp(Number(store.get('opThua', 1)) || 1, 0, 1), opQh: clamp(Number(store.get('opQh', 0.7)), 0, 1), thua: true, dc: true, qh: false };
  if (!CFG.BAN_DO?.VE_TINH) { settings.basemap = 'paper'; $('t-base').hidden = true; }
  const setSlider = (inp, out, v) => { inp.value = String(Math.round(v * 100)); inp.style.setProperty('--v', `${Math.round(v * 100)}%`); out.textContent = `${Math.round(v * 100)}%`; };
  const applyState = () => {
    view.set({ basemap: settings.basemap, opacity: settings.opThua, opacityQh: settings.opQh, diachinh: settings.dc, hientrang: settings.thua, quyhoach: settings.qh });
    const sat = settings.basemap === 'sat';
    mapEl.classList.toggle('is-sat', sat); $('t-base').setAttribute('aria-pressed', String(sat));
    $('attrib').hidden = !sat; $('attrib').textContent = sat ? CFG.BAN_DO.VE_TINH.ghiCong : '';
    for (const k of ['thua', 'dc', 'qh']) { $(`sw-${k}`).setAttribute('aria-checked', String(settings[k])); $(`sw-${k}`).closest('.lyr').classList.toggle('is-off', !settings[k]); }
  };
  setSlider($('op-thua'), $('v-thua'), settings.opThua); setSlider($('op-qh'), $('v-qh'), settings.opQh);
  for (const k of ['thua', 'dc', 'qh']) $(`sw-${k}`).addEventListener('click', () => {
    settings[k] = !settings[k];
    if (k === 'qh') { hideStack(); tip.hidden = true; if (settings.qh) loadCT(); else hideTicket(); }
    applyState(); updateAvoid();
  });
  $('op-thua').addEventListener('input', (e) => { settings.opThua = Number(e.target.value) / 100; setSlider($('op-thua'), $('v-thua'), settings.opThua); store.set('opThua', settings.opThua); view.set({ opacity: settings.opThua }); });
  $('op-qh').addEventListener('input', (e) => { settings.opQh = Number(e.target.value) / 100; setSlider($('op-qh'), $('v-qh'), settings.opQh); store.set('opQh', settings.opQh); view.set({ opacityQh: settings.opQh }); });
  $('t-base').addEventListener('click', () => { settings.basemap = settings.basemap === 'sat' ? 'paper' : 'sat'; store.set('basemap', settings.basemap); applyState(); });
  const closePops = () => { if (!$('layers').hidden) { $('layers').hidden = true; $('t-layers').setAttribute('aria-expanded', 'false'); updateAvoid(); } };
  $('t-layers').addEventListener('click', () => {
    const open = $('layers').hidden; if (open && !$('measure').hidden) mOn(false);
    $('layers').hidden = !open; $('t-layers').setAttribute('aria-expanded', String(open)); updateAvoid();
  });

  /* ---------- tìm kiếm ---------- */
  const qTo = $('q-to'), qThua = $('q-thua'), qX = $('q-x'), qY = $('q-y'), list = $('finder-list'), goBtn = $('finder-go');
  let mode = 'thua', items = [], active = -1, grid = false, rolling = false;
  const GO_TEXT = { thua: 'Tìm', vn: 'Tìm', ran: 'Random thửa' };
  const applyFilter = (set, label) => {
    view.setHighlight(set); $('finder-chip-text').textContent = label; $('finder-chip').hidden = false;
    let x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
    for (const i of set) { const b = view.parcelBounds(i); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    if (set.size) view.fitBounds({ x0, y0, x1, y1 }, { pad: viewPad(), maxZoom: 18, animate: true });
    updateAvoid();
  };
  const clearFilter = () => { view.setHighlight(null); $('finder-chip').hidden = true; updateAvoid(); };
  $('finder-chip-x').addEventListener('click', clearFilter);

  const setMode = (m) => {
    mode = m; items = []; active = -1;
    for (const b of document.querySelectorAll('.finder__tabs button')) b.setAttribute('aria-selected', String(b.dataset.mode === m));
    for (const f of document.querySelectorAll('.finder__fields')) f.hidden = f.dataset.for !== m;
    cancelRoll(); goBtn.textContent = GO_TEXT[m];
    renderList(); ({ thua: qTo, vn: qX })[m]?.focus();
  };
  document.querySelectorAll('.finder__tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /** Gợi ý số tờ: xổ ra lưới các tờ (không có tờ 0 và tờ rỗng). */
  function suggestSheets() {
    qTo.value = qTo.value.replace(/\D/g, ''); const q = qTo.value;
    grid = true; active = -1;
    items = sheets.filter((n) => !q || String(n).startsWith(q)).map((n) => ({ title: `Tờ ${n}`, sub: `${fmt0(bySheet.get(n).length)} thửa`, keep: true, run: () => { qTo.value = String(n); qThua.value = ''; clearSelection(); const a = bySheet.get(n); applyFilter(new Set(a), `Tờ ${n} · ${fmt0(a.length)} thửa`); $('finder-list').hidden = true; qThua.focus({ preventScroll: true }); suggestParcels(); } }));
    renderList();
  }
  /** Gợi ý số thửa trong tờ đã nhập. */
  function suggestParcels() {
    qThua.value = qThua.value.replace(/\D/g, ''); const to = posInt(qTo.value), th = qThua.value;
    grid = true; active = -1; items = [];
    const a = to ? bySheet.get(to) : null;
    if (a && to > 0) items = a.filter((i) => !th || String(R[i][1]).startsWith(th)).slice(0, 400).map((i) => ({ title: `Thửa ${R[i][1]}`, sub: fmtArea(R[i][2]), run: () => { qThua.value = String(R[i][1]); selectParcel(i, { fit: true }); } }));
    else if (th && posInt(th)) { grid = false; items = (byThua.get(posInt(th)) || []).slice(0, 8).map((i) => ({ title: `Tờ ${R[i][0]} · Thửa ${R[i][1]}`, sub: fmtArea(R[i][2]), run: () => { qTo.value = String(R[i][0]); selectParcel(i, { fit: true }); } })); }
    renderList();
  }
  function renderList() {
    list.classList.toggle('is-grid', grid && items.length > 0);
    list.replaceChildren(...items.map((it, k) => h('li', { role: 'option', id: `opt-${k}`, 'aria-selected': String(k === active), class: [k === active ? 'on' : '', it.hint ? 'hint' : ''].join(' ').trim() || null,
      onmousedown: (e) => { e.preventDefault(); choose(k); } }, h('b', null, it.title), h('span', null, it.sub))));
    list.hidden = !items.length;
    for (const i of [qTo, qThua]) i.setAttribute('aria-expanded', String(!list.hidden));
  }
  function choose(k) { const it = items[k]; if (!it) return; it.run(); if (!it.keep) { items = []; renderList(); document.activeElement?.blur?.(); } }
  const fromSheet = () => suggestSheets(), fromThua = () => suggestParcels();
  qTo.addEventListener('input', fromSheet); qTo.addEventListener('focus', fromSheet);
  qThua.addEventListener('input', fromThua); qThua.addEventListener('focus', fromThua);
  for (const inp of [qTo, qThua, qX, qY]) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!items.length) return; e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; renderList(); list.children[active]?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Escape') { items = []; renderList(); }
    });
    inp.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== qTo && document.activeElement !== qThua ) { items = []; renderList(); } }, 120));
  }
  const num = (v) => { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  function goVN() {
    let X = num(qX.value), Y = num(qY.value);
    if (!Number.isFinite(X) || !Number.isFinite(Y)) { toast('Nhập X (Bắc) và Y (Đông) bằng số, đơn vị mét.'); return; }
    if (X < Y) [X, Y] = [Y, X]; // X (Bắc) luôn lớn hơn Y (Đông) ở khu vực này
    const ll = vnToWgs(X, Y); const p = lonLatToRel(meta, ll.lon, ll.lat); const x = p.x, y = -p.y; const b = view.bb;
    if (!(x > b.x0 - 300 && x < b.x1 + 300 && y > b.y0 - 300 && y < b.y1 + 300)) { toast('Tọa độ nằm ngoài vùng dữ liệu.'); return; }
    view.setPin(x, y); const i = view.pick(x, y);
    if (i >= 0) selectParcel(i, { fit: true });
    else { clearSelection(); view.fitBounds({ x0: x - 40, x1: x + 40, y0: y - 40, y1: y + 40 }, { pad: viewPad(), maxZoom: 19, animate: true }); toast('Điểm này không nằm trong thửa đất nào.'); }
  }
  $('finder-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (mode === 'vn') { goVN(); return; }
    if (mode === 'ran') { runRandom(); return; }
    if (active >= 0 && items.length) { choose(active); return; }
    if (mode === 'thua') {
      const to = posInt(qTo.value), th = posInt(qThua.value);
      if (!to && !th) { toast('Nhập số tờ và số thửa (số nguyên dương).'); return; }
      if (to && th) { const i = (bySheet.get(to) || []).find((k) => R[k][1] === th); if (i === undefined) { toast('Không tìm thấy thửa này trong tờ đã nhập.'); return; } selectParcel(i, { fit: true }); items = []; renderList(); return; }
      if (to) { const a = bySheet.get(to); if (!a || to < 1) { toast('Tờ này không có thửa nào.'); return; } clearSelection(); applyFilter(new Set(a), `Tờ ${to} · ${fmt0(a.length)} thửa`); items = []; renderList(); return; }
      suggestParcels(); if (items.length) choose(0); else toast('Không tìm thấy kết quả phù hợp.');
      return;
    }
  });

  /* ---------- ngẫu nhiên: chạy qua các thửa trên bản đồ, chậm dần rồi dừng ở thửa được chọn ---------- */
  let roll = 0; // mã lượt chạy; đổi số = hủy lượt đang chạy
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  function setRolling(on) { rolling = on; goBtn.disabled = on; goBtn.textContent = on ? 'Đang chạy…' : GO_TEXT[mode]; }
  function cancelRoll() { if (!rolling) return; roll++; view.setFlash(-1); setRolling(false); }
  async function runRandom() {
    if (rolling || !valid.length) return;
    const my = ++roll; setRolling(true);
    clearSelection(); clearFilter(); view.setPin(null); closePops(); hideStack(); tip.hidden = true;
    const target = valid[rnd(valid.length)]; const tc = view.parcelCenter(target);
    home(true); await sleep(480); if (my !== roll) return;
    const c0 = { x: view.cx, y: view.cy, z: view.z }; const zEnd = 16.2;
    const bb = view.bb; const diag = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0);
    const N = 28; const seq = [];
    for (let k = 0; k < N - 1; k++) { // các thửa "ứng viên" co dần về quanh thửa đích
      const rad = diag * 0.5 * (1 - k / (N - 1)) ** 2.2 + 6; let pick = -1;
      for (let a = 0; a < 14 && pick < 0; a++) {
        const i = view.pick(tc.x + (Math.random() * 2 - 1) * rad, tc.y + (Math.random() * 2 - 1) * rad);
        if (i >= 0 && R[i][0] > 0 && i !== seq[seq.length - 1]) pick = i;
      }
      seq.push(pick >= 0 ? pick : valid[rnd(valid.length)]);
    }
    seq.push(target);
    for (let k = 0; k < N; k++) {
      if (my !== roll) return;
      const t = k / (N - 1); const delay = 55 + 520 * t ** 3; // nhanh → chậm dần
      const e = t * t; const z = c0.z + (zEnd - c0.z) * e;
      view.setFlash(seq[k]);
      view.flyTo(c0.x + (tc.x - c0.x) * e, c0.y + (tc.y - c0.y) * e, z, Math.max(140, delay * 1.3));
      await sleep(delay);
    }
    if (my !== roll) return;
    view.setFlash(-1); setRolling(false); selectParcel(target, { fit: true });
  }

  /* ---------- công cụ ---------- */
  $('t-in').addEventListener('click', () => view.zoomAt(view.W / 2, view.H / 2, 1));
  $('t-out').addEventListener('click', () => view.zoomAt(view.W / 2, view.H / 2, -1));
  $('t-home').addEventListener('click', () => { cancelRoll(); clearSelection(); clearFilter(); view.setPin(null); home(true); });
  $('t-gps').addEventListener('click', () => {
    if (!('geolocation' in navigator)) { toast('Thiết bị không hỗ trợ định vị.'); return; }
    toast('Đang xác định vị trí…');
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = lonLatToRel(meta, pos.coords.longitude, pos.coords.latitude); const x = p.x, y = -p.y; const b = view.bb;
      if (x < b.x0 - 500 || x > b.x1 + 500 || y < b.y0 - 500 || y > b.y1 + 500) { toast('Vị trí của bạn nằm ngoài vùng dữ liệu.'); return; }
      view.setGPS(x, y, pos.coords.accuracy || 20); view.z = Math.max(view.z, 16.5); view.centerOn(x, y, viewPad()); toast('Đã xác định vị trí của bạn.');
    }, () => toast('Không lấy được vị trí. Hãy cho phép truy cập vị trí trong trình duyệt.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
  // đo đạc: một bảng duy nhất
  const mBox = $('measure'); const lenTxt = (m) => (m >= 1000 ? `${fmt2(m / 1000)} km` : `${fmt1(m)} m`);
  function mOn(on) {
    $('t-measure').setAttribute('aria-pressed', String(on)); mBox.hidden = !on; mapEl.classList.toggle('is-measuring', on);
    if (on) { closePops(); view.startMeasure(); hideTicket(); } else view.stopMeasure();
    updateAvoid();
  }
  view.on('measure', (info) => {
    if (!info) return;
    $('m-last').textContent = info.last ? `X ${spaced(info.last.X)} · Y ${spaced(info.last.Y)}` : '—';
    $('m-len').textContent = lenTxt(info.length);
    $('m-arow').hidden = $('m-prow').hidden = info.area == null;
    if (info.area != null) { $('m-area').textContent = `${fmtArea(info.area)}${info.area >= 1e4 ? ` (${fmt2(info.area / 1e4)} ha)` : ''}`; $('m-per').textContent = lenTxt(info.perim); }
    $('m-hint').textContent = info.done ? 'Đã hoàn tất. Bấm Lùi để sửa tiếp, hoặc Xóa nét đo để đo lại.' : info.n < 1 ? 'Bấm lên bản đồ để chấm điểm đầu tiên.' : info.n < 3 ? 'Tiếp tục chấm điểm. Từ 3 điểm sẽ có diện tích. Nhấp đúp hoặc nhấn Enter để kết thúc.' : 'Nhấp đúp hoặc nhấn Enter để kết thúc.';
    $('m-undo').disabled = info.n === 0; $('m-done').disabled = info.done || info.n < 2; $('m-clear').disabled = info.n === 0;
  });
  $('t-measure').addEventListener('click', () => mOn(mBox.hidden));
  $('m-undo').addEventListener('click', () => view.measureUndo());
  $('m-done').addEventListener('click', () => view.measureFinish());
  $('m-clear').addEventListener('click', () => view.measureClear());
  mapEl.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Escape') { if (!mBox.hidden) mOn(false); else if (sel >= 0) clearSelection(); }
    else if (k === 'Enter' && !mBox.hidden) view.measureFinish();
    else if ((k === 'Backspace' || ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z')) && !mBox.hidden) { e.preventDefault(); view.measureUndo(); }
    else if (k === '+' || k === '=') view.zoomAt(view.W / 2, view.H / 2, 0.5);
    else if (k === '-' || k === '_') view.zoomAt(view.W / 2, view.H / 2, -0.5);
    else if (k.startsWith('Arrow')) { e.preventDefault(); const d = 90; view.panBy(k === 'ArrowLeft' ? d : k === 'ArrowRight' ? -d : 0, k === 'ArrowUp' ? d : k === 'ArrowDown' ? -d : 0); }
  });
  $('finder-min').addEventListener('click', () => { finderOpen = true; updateAvoid(); });
  addEventListener('resize', () => setTimeout(updateAvoid, 100));
  { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateAvoid); }).observe($('finder')); } // thẻ thông tin luôn bám sát dưới ô tìm kiếm

  /* ---------- khởi động ---------- */
  applyState();
  home(); setSlider($('op-thua'), $('v-thua'), settings.opThua);
  const q = new URLSearchParams(location.hash.slice(1)); const hTo = posInt(q.get('to')), hTh = posInt(q.get('thua'));
  const hi = hTo && hTh ? (bySheet.get(hTo) || []).find((i) => R[i][1] === hTh) : undefined;
  step(1);
  setTimeout(async () => {
    Motion.to($('loader'), { opacity: 0, duration: 0.35 });
    await new Promise((r) => setTimeout(r, 250));
    $('loader').hidden = true; Motion.ticker.remove(loadTick);
    curtain.reveal({ x: innerWidth / 2, y: innerHeight / 2 });
    Motion.timeline().to(view, { intro: 1, duration: 1.2, ease: 'power2.out', delay: 0.3, onUpdate: () => view.invalidate(true) });
    Motion.from('.finder', { y: -24, opacity: 0, duration: 0.9, delay: 0.7, ease: 'expo.out' });
    Motion.from('.tools .tool', { x: 24, opacity: 0, duration: 0.7, delay: 0.9, stagger: 0.07, ease: 'expo.out' });
      updateAvoid();
    if (hi !== undefined) selectParcel(hi, { fit: true });
    setTimeout(() => loadCT(), 2500);
  }, 400);
}

boot();
