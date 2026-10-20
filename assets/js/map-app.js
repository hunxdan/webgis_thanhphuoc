(() => {
const __defs = {}, __cache = {};
function __m(id) { if (__cache[id]) return __cache[id]; const e = __cache[id] = {}; __defs[id](e); return e; }
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/map-app.js"] = function (__e) {
// map-app.js — trang tra cứu: nạp dữ liệu, tìm kiếm, thẻ thửa đất, lớp bản đồ, đo đạc.
// Quy tắc: mọi nội dung hiển thị đi qua h()/textContent — không dùng innerHTML.
const { CFG, h, clamp, fmt0, fmt1, fmt2, fmtArea, posInt, store, loadPack, loadJSON, lonLatToRel, colQH, toast, fail } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const Motion = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/motion.js").default;
const { initChrome, icon } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/common.js");
const { MapView } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/mapview.js");
const { deedNodes, planItems, paintSwatches } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/deed.js");
const { oldIcon } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/icons.js");
const { vnToWgs } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/vn2000.js");

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
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/mapview.js"] = function (__e) {
// mapview.js — bộ máy bản đồ tự viết: toàn bộ thửa đất được tam giác hoá sẵn và nạp MỘT LẦN lên GPU (WebGL2).
// Kéo/zoom chỉ đổi vài số của camera; thửa không vẽ lại từng cái. Lớp động (chọn, nhãn, đo, lưới +) vẽ trên canvas 2D mỏng.
const { clamp, relToLonLat, lonLatToRel, colTD, colQH, hex2rgb, fmtArea, grainTile } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/util.js");
const { wgsToVN, vnToWgs } = __m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/vn2000.js");

const HALF = 20037508.342789244;
const TILE_WORLD = HALF * 2;
const RAD = Math.PI / 180;
const R = 6378137;
const INK = '#0c2622', PAPER = '#f3e8d3', RED = '#922b32', GREEN = '#025a4c';

/* ---------- hình học thuần ---------- */
function haversine(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ---------- shader ---------- */
const VS_FILL = `#version 300 es
in vec2 aPos; in vec4 aCol; uniform vec2 uC; uniform vec2 uS; uniform float uA; out vec4 vC;
void main(){ gl_Position = vec4((aPos-uC)*uS, 0., 1.); vC = vec4(aCol.rgb*uA, uA); }`;
const FS_FILL = `#version 300 es
precision mediump float; in vec4 vC; out vec4 o; void main(){ o = vC; }`;
// nét dày theo pixel, KHỬ RĂNG CƯA trong shader: mỗi đoạn là một instance (4 đỉnh góc); phần rìa 1 điểm ảnh thiết bị mờ dần theo khoảng cách tới trục nét.
// (Trước đây ranh thửa là gl.LINES 1px, màn hình mật độ cao tắt MSAA nên nét bị răng cưa.)
const VS_AA = `#version 300 es
in vec2 aP0; in vec2 aP1; in vec2 aCorner; uniform vec2 uC; uniform float uScale; uniform vec2 uWH; uniform float uW; uniform float uAA; out float vD;
void main(){
  vec2 a = (aP0-uC)*uScale, b = (aP1-uC)*uScale; vec2 d = b-a; float L = length(d); vec2 dir = L > 1e-6 ? d/L : vec2(1.,0.);
  vec2 n = vec2(-dir.y, dir.x); float t = aCorner.x; float hw = uW*.5; float ext = hw + uAA;
  vD = aCorner.y*ext;
  vec2 p = mix(a, b, t) + n*aCorner.y*ext + dir*(t*2.-1.)*hw;
  gl_Position = vec4(p*vec2(2./uWH.x, -2./uWH.y), 0., 1.); }`;
const FS_AA = `#version 300 es
precision highp float; in float vD; uniform vec4 uK; uniform float uW; uniform float uAA; out vec4 o;
void main(){ float cov = clamp((uW*.5 - abs(vD))/uAA + .5, 0., 1.); float a = uK.a*cov; o = vec4(uK.rgb*a, a); }`;

function prog(gl, vs, fs) {
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error('shader'); return x; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  const a = {}; const m = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < m; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}

class MapView {
  constructor(root, D, cfg, rows) {
    this.root = root; this.D = D; this.cfg = cfg; this.q = D.meta.quant; this.rows = rows;
    this.bg = document.createElement('canvas'); this.glc = document.createElement('canvas'); this.ov = document.createElement('canvas'); this.an = document.createElement('canvas');
    this.glLost = false;
    this.bg.className = 'map__bg'; this.glc.className = 'map__gl'; this.ov.className = 'map__over'; this.an.className = 'map__anim';
    root.append(this.bg, this.glc, this.ov);
    root.insertBefore(this.an, this.ov); // lớp nét chạy nằm dưới lớp bắt chuột
    this.bgx = this.bg.getContext('2d', { alpha: false });
    this.octx = this.ov.getContext('2d'); this.actx = this.an.getContext('2d');
    this.state = { basemap: 'paper', diachinh: true, hientrang: true, quyhoach: false, opacity: 1, opacityQh: 1 };
    this.cx = 0; this.cy = 0; this.z = 13; this.W = 1; this.H = 1; this.dpr = 1;
    this.intro = 0; this.hoverZ = -1; this.sel = -1; this.zone = -1; this.flash = -1; this.hover = -1; this.hl = null; this.hlPath = null;
    this.ct = null; this.ripples = []; this.measure = null; this.gps = null; this.zt = null;
    this.sprites = new Map(); this.gridCache = new Map(); this.tiles = new Map(); this.pathCache = new Map();
    this.dirty = true; this.raf = 0; this.vel = { x: 0, y: 0 }; this.pointers = new Map(); this.listeners = {};
    const bq = D.meta.bboxQ, q = this.q;
    this.bb = { x0: bq[0] / q, x1: bq[2] / q, y0: -bq[3] / q, y1: -bq[1] / q };
    // mất ngữ cảnh WebGL (hết bộ nhớ GPU, đổi tab, trình duyệt thu hồi): không để trang trắng/crash — dựng lại GPU khi được cấp lại
    this.glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.glLost = true; });
    this.glc.addEventListener('webglcontextrestored', () => { this.glLost = false; try { this.initGL(); } catch (_) { return; } this.bc = null; this.invalidate(true); });
    this.initGL();
    this.buildGrid();
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(root);
  }

  /* ---------- sự kiện nội bộ ---------- */
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  /* ---------- GPU: nạp một lần ---------- */
  initGL() {
    // MSAA trên khung rất lớn tốn bộ nhớ GPU nhất: chỉ bật ở màn hình thường; màn hình mật độ cao đã đủ mịn
    const gl = this.gl = this.glc.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: (window.devicePixelRatio || 1) < 1.5, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    const { P, qh } = this.D; const q = this.q;
    this.pF = prog(gl, VS_FILL, FS_FILL); this.pA = prog(gl, VS_AA, FS_AA);
    const buf = (target, data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
    const mkPack = (pack, colorOf, edges) => {
      const n = pack.pts.length / 2; const pos = new Float32Array(n * 2); const col = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) { pos[2 * i] = pack.pts[2 * i] / q; pos[2 * i + 1] = -pack.pts[2 * i + 1] / q; }
      const nf = pack.featRing.length - 1;
      for (let f = 0; f < nf; f++) {
        const rgb = hex2rgb(colorOf(f)); const s = pack.ringStart[pack.featRing[f]], e = pack.ringStart[pack.featRing[f + 1]];
        for (let i = s; i < e; i++) { col[4 * i] = rgb[0]; col[4 * i + 1] = rgb[1]; col[4 * i + 2] = rgb[2]; col[4 * i + 3] = 255; }
      }
      // cạnh: mỗi vòng khép kín
      let ne = 0; for (let r = 0; r < pack.ringStart.length - 1; r++) ne += pack.ringStart[r + 1] - pack.ringStart[r];
      const out = { n, pos: buf(gl.ARRAY_BUFFER, pos), col: buf(gl.ARRAY_BUFFER, col), idx: buf(gl.ELEMENT_ARRAY_BUFFER, pack.tri), nTri: pack.tri.length };
      if (edges === 'lines') {
        const ei = new Uint32Array(ne * 2); let k = 0;
        for (let r = 0; r < pack.ringStart.length - 1; r++) { const s = pack.ringStart[r], e = pack.ringStart[r + 1]; for (let i = s; i < e; i++) { ei[k++] = i; ei[k++] = i + 1 < e ? i + 1 : s; } }
        out.lineIdx = buf(gl.ELEMENT_ARRAY_BUFFER, ei); out.nLine = ei.length;
      } else if (edges === 'thick') {
        // khử trùng lặp: ranh chung của 2 thửa liền kề chỉ vẽ 1 lần (giảm ~một nửa số đoạn), bỏ đoạn suy biến độ dài 0
        const p0 = new Float32Array(ne * 4); let k = 0; const seen = new Set(); const P = pack.pts;
        for (let r = 0; r < pack.ringStart.length - 1; r++) {
          const s = pack.ringStart[r], e = pack.ringStart[r + 1];
          for (let i = s; i < e; i++) {
            const j = i + 1 < e ? i + 1 : s; const x0 = P[2 * i], y0 = P[2 * i + 1], x1 = P[2 * j], y1 = P[2 * j + 1];
            if (x0 === x1 && y0 === y1) continue;
            const key = x0 < x1 || (x0 === x1 && y0 < y1) ? `${x0},${y0},${x1},${y1}` : `${x1},${y1},${x0},${y0}`;
            if (seen.has(key)) continue; seen.add(key);
            p0[k++] = pos[2 * i]; p0[k++] = pos[2 * i + 1]; p0[k++] = pos[2 * j]; p0[k++] = pos[2 * j + 1];
          }
        }
        ne = k / 4;
        // chia ô lưới 14×14 theo vị trí đoạn, sắp các đoạn theo ô → chỉ vẽ những ô nằm trong khung nhìn (zoom gần = vẽ rất ít đoạn)
        const G = 14; let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (let i = 0; i < ne; i++) { const x = p0[4 * i], y = p0[4 * i + 1]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        const cid = new Uint16Array(ne), cnt = new Uint32Array(G * G + 1);
        for (let i = 0; i < ne; i++) { const mx = (p0[4 * i] + p0[4 * i + 2]) / 2, my = (p0[4 * i + 1] + p0[4 * i + 3]) / 2; const gx = Math.min(G - 1, Math.floor(((mx - bx0) / (bx1 - bx0 || 1)) * G)), gy = Math.min(G - 1, Math.floor(((my - by0) / (by1 - by0 || 1)) * G)); cid[i] = gy * G + gx; cnt[cid[i] + 1]++; }
        for (let c = 0; c < G * G; c++) cnt[c + 1] += cnt[c];
        const fill = cnt.slice(0, G * G), sorted = new Float32Array(ne * 4); const cells = [];
        for (let c = 0; c < G * G; c++) if (cnt[c + 1] > cnt[c]) cells.push({ off: cnt[c], n: cnt[c + 1] - cnt[c], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
        const cellIdx = new Int32Array(G * G).fill(-1); { let ci = 0; for (let c = 0; c < G * G; c++) if (cnt[c + 1] > cnt[c]) cellIdx[c] = ci++; }
        for (let i = 0; i < ne; i++) {
          const c = cid[i], o = fill[c]++; sorted.set(p0.subarray(4 * i, 4 * i + 4), 4 * o); const cl = cells[cellIdx[c]];
          for (let t = 0; t < 2; t++) { const x = p0[4 * i + 2 * t], y = p0[4 * i + 2 * t + 1]; if (x < cl.x0) cl.x0 = x; if (x > cl.x1) cl.x1 = x; if (y < cl.y0) cl.y0 = y; if (y > cl.y1) cl.y1 = y; }
        }
        out.cells = cells; out.segData = sorted;
        out.seg = buf(gl.ARRAY_BUFFER, out.segData); out.nSeg = ne; delete out.segData;
      }
      return out;
    };
    const rows = this.rows;
    this.gP = mkPack(P, (f) => colTD(rows[f][4]), 'thick');
    this.zoneCol = Array.from({ length: qh.code.length }, (_, z) => colQH(qh.meta.codes[qh.code[z]][0]));
    this.gQ = mkPack(qh, (z) => this.zoneCol[z], 'thick');
    this.corner = buf(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.vaos = {};
    // VAO tô thửa / tô quy hoạch
    for (const [name, g] of [['fillP', this.gP], ['fillQ', this.gQ]]) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.enableVertexAttribArray(this.pF.a.aPos); gl.vertexAttribPointer(this.pF.a.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.col); gl.enableVertexAttribArray(this.pF.a.aCol); gl.vertexAttribPointer(this.pF.a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idx); this.vaos[name] = vao;
    }
    for (const g of [this.gP, this.gQ]) for (const cell of g.cells) { // mỗi ô lưới một VAO trỏ tới đúng đoạn buffer của ô đó
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const a = this.pA.a;
      gl.bindBuffer(gl.ARRAY_BUFFER, g.seg);
      gl.enableVertexAttribArray(a.aP0); gl.vertexAttribPointer(a.aP0, 2, gl.FLOAT, false, 16, cell.off * 16); gl.vertexAttribDivisor(a.aP0, 1);
      gl.enableVertexAttribArray(a.aP1); gl.vertexAttribPointer(a.aP1, 2, gl.FLOAT, false, 16, cell.off * 16 + 8); gl.vertexAttribDivisor(a.aP1, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.corner); gl.enableVertexAttribArray(a.aCorner); gl.vertexAttribPointer(a.aCorner, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(a.aCorner, 0);
      cell.vao = vao;
    }
    gl.bindVertexArray(null);
  }
  drawGL() {
    const { gl, GW: W, GH: H, state } = this; const s = this.scale; const k = this.intro;
    if (this.glLost || gl.isContextLost()) return;
    gl.viewport(0, 0, this.glc.width, this.glc.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const uS = [(2 * s) / W, (-2 * s) / H], uC = [this.cx, this.cy];
    if (state.hientrang) {
      gl.useProgram(this.pF.p); gl.uniform2f(this.pF.u.uC, uC[0], uC[1]); gl.uniform2f(this.pF.u.uS, uS[0], uS[1]); gl.uniform1f(this.pF.u.uA, state.opacity * k);
      gl.bindVertexArray(this.vaos.fillP); gl.drawElements(gl.TRIANGLES, this.gP.nTri, gl.UNSIGNED_INT, 0);
    }
    const gd = this.gdpr; const aa = 1 / gd; // 1 điểm ảnh thiết bị tính bằng px CSS
    const hx = W / (2 * s) + 4 / s, hy = H / (2 * s) + 4 / s; // nửa khung nhìn (toạ độ bản đồ) + lề 4px
    const drawCells = (g) => { for (const c of g.cells) { if (c.x1 < this.cx - hx || c.x0 > this.cx + hx || c.y1 < this.cy - hy || c.y0 > this.cy + hy) continue; gl.bindVertexArray(c.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, c.n); } };
    const lineU = (w, r, g, b, al) => { const u = this.pA.u; gl.useProgram(this.pA.p); gl.uniform2f(u.uC, uC[0], uC[1]); gl.uniform1f(u.uScale, s); gl.uniform2f(u.uWH, W, H); gl.uniform1f(u.uW, w); gl.uniform1f(u.uAA, aa); gl.uniform4f(u.uK, r, g, b, al); };
    if (state.diachinh) {
      const lowZ = clamp((this.z - 12.5) / 2.2, 0.2, 1);
      lineU(clamp(1 + (this.z - 14) * 0.18, 1, 1.9) * aa, 35 / 255, 35 / 255, 35 / 255, 1.0 * lowZ * k); // (ranh chung vẽ 1 lần nên alpha 1,0 ≈ độ đậm cũ khi vẽ chồng 2 lần) bề rộng 1–1,9 điểm ảnh thiết bị
      drawCells(this.gP);
    }
    if (state.quyhoach) {
      gl.useProgram(this.pF.p); gl.uniform1f(this.pF.u.uA, state.opacityQh * k);
      gl.bindVertexArray(this.vaos.fillQ); gl.drawElements(gl.TRIANGLES, this.gQ.nTri, gl.UNSIGNED_INT, 0);
      lineU(Math.max(clamp(0.6 + (this.z - 12) * 0.12, 0.6, 1.3), 1.1 * aa), 1, 0, 0, 1);
      drawCells(this.gQ);
    }
    gl.bindVertexArray(null);
  }

  /* ---------- tạo đường vẽ (chỉ cho thửa/vùng đang chọn) ---------- */
  ringsPath(pack, k, into) {
    const p = into || new Path2D(); const q = this.q;
    const { pts, ringStart, featRing } = pack;
    for (let r = featRing[k]; r < featRing[k + 1]; r++) {
      const s = ringStart[r], e = ringStart[r + 1];
      p.moveTo(pts[2 * s] / q, -pts[2 * s + 1] / q);
      for (let i = s + 1; i < e; i++) p.lineTo(pts[2 * i] / q, -pts[2 * i + 1] / q);
      p.closePath();
    }
    return p;
  }
  cached(key, make) {
    let v = this.pathCache.get(key);
    if (!v) { v = make(); this.pathCache.set(key, v); if (this.pathCache.size > 120) this.pathCache.delete(this.pathCache.keys().next().value); }
    return v;
  }

  /* ---------- lưới tìm thửa dưới con trỏ ---------- */
  buildGrid() {
    const { P } = this.D; const q = this.q; const N = P.bbox.length / 4;
    const cell = 150; const { x0, x1, y0, y1 } = this.bb;
    const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1;
    const cells = Array.from({ length: nx * ny }, () => []);
    for (let i = 0; i < N; i++) {
      const bx0 = P.bbox[4 * i] / q, by0 = -P.bbox[4 * i + 3] / q, bx1 = P.bbox[4 * i + 2] / q, by1 = -P.bbox[4 * i + 1] / q;
      const gx0 = Math.floor((bx0 - x0) / cell), gx1 = Math.floor((bx1 - x0) / cell);
      const gy0 = Math.floor((by0 - y0) / cell), gy1 = Math.floor((by1 - y0) / cell);
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) cells[gy * nx + gx].push(i);
    }
    this.grid = { cell, nx, ny, cells };
  }
  inside(pack, k, x, y) { // x, y mét (y xuống); even-odd trên mọi vòng
    const q = this.q; const { pts, ringStart, featRing } = pack; let c = false;
    for (let r = featRing[k]; r < featRing[k + 1]; r++) {
      const s = ringStart[r], e = ringStart[r + 1];
      for (let i = s, j = e - 1; i < e; j = i++) {
        const xi = pts[2 * i] / q, yi = -pts[2 * i + 1] / q, xj = pts[2 * j] / q, yj = -pts[2 * j + 1] / q;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
    }
    return c;
  }
  /** Mọi thửa chứa điểm (x, y), nhỏ nhất trước — để chọn được cả những thửa chồng lên nhau. */
  pickAll(x, y) {
    const { P } = this.D; const q = this.q; const g = this.grid; const { x0, y0 } = this.bb;
    const gx = Math.floor((x - x0) / g.cell), gy = Math.floor((y - y0) / g.cell);
    if (gx < 0 || gy < 0 || gx >= g.nx || gy >= g.ny) return [];
    const out = [];
    for (const i of g.cells[gy * g.nx + gx]) {
      if (x < P.bbox[4 * i] / q || x > P.bbox[4 * i + 2] / q || y < -P.bbox[4 * i + 3] / q || y > -P.bbox[4 * i + 1] / q) continue;
      if (this.inside(P, i, x, y)) out.push([i, (P.bbox[4 * i + 2] - P.bbox[4 * i]) * (P.bbox[4 * i + 3] - P.bbox[4 * i + 1])]);
    }
    return out.sort((a, b) => a[1] - b[1]).map((o) => o[0]);
  }
  pick(x, y) { return this.pickAll(x, y)[0] ?? -1; }
  pickZone(x, y) {
    const { qh } = this.D; const q = this.q;
    for (let i = qh.code.length - 1; i >= 0; i--) {
      if (x < qh.bbox[4 * i] / q || x > qh.bbox[4 * i + 2] / q || y < -qh.bbox[4 * i + 3] / q || y > -qh.bbox[4 * i + 1] / q) continue;
      if (this.inside(qh, i, x, y)) return i;
    }
    return -1;
  }
  parcelBounds(i) { const q = this.q; const b = this.D.P.bbox; return { x0: b[4 * i] / q, x1: b[4 * i + 2] / q, y0: -b[4 * i + 3] / q, y1: -b[4 * i + 1] / q }; }
  parcelCenter(i) { const b = this.parcelBounds(i); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }
  /** Điểm đặt nhãn: trọng tâm tam giác lớn nhất trong phép chia tam giác của thửa (luôn nằm trong thửa). */
  labelPoint(i) { const L = this.D.P.lab, q = this.q; return { x: L[2 * i] / q, y: -L[2 * i + 1] / q }; }

  /* ---------- camera ---------- */
  get scale() { return (256 * 2 ** this.z) / TILE_WORLD; }
  toScreen(x, y) { const s = this.scale; return [(x - this.cx) * s + this.W / 2, (y - this.cy) * s + this.H / 2]; }
  toWorld(px, py) { const s = this.scale; return [(px - this.W / 2) / s + this.cx, (py - this.H / 2) / s + this.cy]; }
  lonLatAt(x, y) { return relToLonLat(this.D.meta, x, -y); }
  vnAt(x, y) { const ll = this.lonLatAt(x, y); return wgsToVN(ll.lat, ll.lon); }
  clampView() {
    const b = this.bb; const mx = (b.x1 - b.x0) * 0.25, my = (b.y1 - b.y0) * 0.25;
    this.cx = clamp(this.cx, b.x0 - mx, b.x1 + mx); this.cy = clamp(this.cy, b.y0 - my, b.y1 + my);
    this.z = clamp(this.z, this.cfg.BAN_DO.ZOOM_NHO_NHAT, this.cfg.BAN_DO.ZOOM_LON_NHAT);
  }
  /** Zoom quanh con trỏ, có quán tính (tiến dần về mức zoom đích). */
  zoomAt(px, py, dz, instant = false) {
    const base = this.zt ? this.zt.z : this.z;
    const tz = clamp(base + dz, this.cfg.BAN_DO.ZOOM_NHO_NHAT, this.cfg.BAN_DO.ZOOM_LON_NHAT);
    const [wx, wy] = this.toWorld(px, py);
    this.zt = { z: tz, px, py, wx, wy };
    if (instant) { this.applyZoom(tz); this.zt = null; }
    this.invalidate();
  }
  applyZoom(z) {
    const a = this.zt; this.z = z; if (!a) return;
    const s = this.scale; this.cx = a.wx - (a.px - this.W / 2) / s; this.cy = a.wy - (a.py - this.H / 2) / s; this.clampView();
  }
  panBy(dx, dy) { const s = this.scale; this.cx -= dx / s; this.cy -= dy / s; this.clampView(); this.invalidate(); }
  /** Bay camera tới (cx, cy, z) trong dur ms. */
  flyTo(cx, cy, z, dur = 420) {
    this.zt = null; this.vel.x = this.vel.y = 0;
    this.anim = { t0: performance.now(), dur, a: { cx: this.cx, cy: this.cy, z: this.z }, b: { cx, cy, z } };
    this.invalidate();
  }
  fitBounds(b, { pad = {}, maxZoom = 19.5, minZoom, animate = false } = {}) {
    this.zt = null; this.anim = null; this.a0 = { cx: this.cx, cy: this.cy, z: this.z };
    const p = { l: 0, r: 0, t: 0, b: 0, ...pad };
    const aw = Math.max(80, this.W - p.l - p.r), ah = Math.max(80, this.H - p.t - p.b);
    const s = Math.min(aw / Math.max(1, b.x1 - b.x0), ah / Math.max(1, b.y1 - b.y0));
    this.z = clamp(Math.log2((s * TILE_WORLD) / 256), minZoom ?? this.cfg.BAN_DO.ZOOM_NHO_NHAT, maxZoom);
    const s2 = this.scale;
    this.cx = (b.x0 + b.x1) / 2 - (p.l - p.r) / 2 / s2; this.cy = (b.y0 + b.y1) / 2 - (p.t - p.b) / 2 / s2;
    this.clampView();
    if (animate) { const to = { cx: this.cx, cy: this.cy, z: this.z }; this.cx = this.a0.cx; this.cy = this.a0.cy; this.z = this.a0.z; this.flyTo(to.cx, to.cy, to.z); } else this.invalidate();
  }
  centerOn(x, y, pad = {}, animate = false) {
    this.zt = null; this.anim = null; const s = this.scale; const nx = x - ((pad.l || 0) - (pad.r || 0)) / 2 / s, ny = y - ((pad.t || 0) - (pad.b || 0)) / 2 / s;
    if (animate) { this.flyTo(nx, ny, this.z, 320); return; }
    this.cx = nx; this.cy = ny; this.clampView(); this.invalidate();
  }
  mpp() { const lat = relToLonLat(this.D.meta, this.cx, -this.cy).lat; return Math.cos(lat * RAD) / this.scale; }
  scaleBar() {
    const mpp = this.mpp();
    const max = mpp * 140; const pow = 10 ** Math.floor(Math.log10(max)); const m = [5, 2, 1].map((k) => k * pow).find((v) => v <= max) || pow;
    return { px: m / mpp, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
  }

  /* ---------- trạng thái lớp ---------- */
  set(patch) { Object.assign(this.state, patch); this.invalidate(true); }
  setSelected(i) { this.sel = i; this.selT0 = performance.now(); this.invalidate(false); }
  setZone(i) { this.zone = i; this.invalidate(false); }
  /** Thửa đang "chạy qua" trong chế độ Ngẫu nhiên (tô đỏ + vòng nhắm để thấy cả khi thửa rất nhỏ). */
  setFlash(i) { this.flash = i; this.invalidate(false); }
  setHighlight(set) {
    this.hl = set;
    if (set && set.size) { this.hlPath = new Path2D(); for (const i of set) this.ringsPath(this.D.P, i, this.hlPath); } else this.hlPath = null;
    this.invalidate();
  }
  setCT(ct) { this.ct = ct; this.invalidate(); }
  addRipple(x, y) { this.ripples.push({ x, y, t: performance.now() }); this.invalidate(false); }

  /* ---------- vòng lặp vẽ: chỉ chạy khi cần ---------- */
  invalidate(full = false) {
    this.dirty = true; this.needOver = true; if (full) this.needGL = true;
    // Chỉ MỘT vòng lặp vẽ. Trước đây panBy() (quán tính) gọi invalidate() ngay trong frame() lúc this.raf đã về 0 → đăng ký thêm một vòng, rồi cuối frame() đăng ký tiếp: số vòng lặp nhân đôi mỗi khung → bản đồ vẽ hàng trăm lần/khung và quán tính bị cộng dồn (lỗi lag khi thả lúc đang kéo).
    if (this.inFrame) { this.again = true; return; }
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  frame(now) {
    this.raf = 0; this.inFrame = true; this.again = false;
    try { this.frameBody(now); } finally { this.inFrame = false; }
  }
  frameBody(now) {
    let busy = false; const c0 = this.cx, c1 = this.cy, c2 = this.z;
    if (this.vel.x || this.vel.y) { // quán tính khi kéo
      // quán tính theo thời gian thực (không phụ thuộc số khung hình): vận tốc px/ms, giảm dần theo hàm mũ
      const dt = Math.min(48, Math.max(1, now - (this.lastFrame || now - 16)));
      this.panBy(this.vel.x * dt, this.vel.y * dt); const k = Math.exp(-dt / 360); this.vel.x *= k; this.vel.y *= k;
      if (Math.hypot(this.vel.x, this.vel.y) < 0.015) this.vel.x = this.vel.y = 0; else busy = true;
    }
    if (this.zt) {
      const d = this.zt.z - this.z;
      if (Math.abs(d) < 0.004) { this.applyZoom(this.zt.z); this.zt = null; } else { this.applyZoom(this.z + d * 0.3); busy = true; }
    }
    if (this.anim) {
      const a = this.anim; const t = clamp((now - a.t0) / a.dur, 0, 1); const e = 1 - (1 - t) ** 3;
      this.cx = a.a.cx + (a.b.cx - a.a.cx) * e; this.cy = a.a.cy + (a.b.cy - a.a.cy) * e; this.z = a.a.z + (a.b.z - a.a.z) * e; this.clampView();
      if (t >= 1) this.anim = null; else busy = true;
    }
    const pc = this.pc; const camChanged = !pc || pc[0] !== this.cx || pc[1] !== this.cy || pc[2] !== this.z; this.pc = [this.cx, this.cy, this.z];
    if (camChanged) { this.lastMove = now; this.needOver = true; }
    const moving = now - (this.lastMove || -1e9) < 110;
    // lớp GPU/nền: chỉ vẽ lại khi cần (đổi lớp/độ trong suốt) hoặc khi camera dừng; trong lúc kéo/zoom chỉ dịch + co bằng CSS
    const bc = this.bc; const k = bc ? this.scale / ((256 * 2 ** bc.z) / TILE_WORLD) : 1;
    const tx = bc ? (bc.cx - this.cx) * this.scale : 0, ty = bc ? (bc.cy - this.cy) * this.scale : 0;
    const covX = (this.GW * k - this.W) / 2 * 0.92, covY = (this.GH * k - this.H) / 2 * 0.92;
    const differs = !bc || bc.cx !== this.cx || bc.cy !== this.cy || bc.z !== this.z;
    const bad = differs && (Math.abs(tx) > covX || Math.abs(ty) > covY || k > 1.8 || k < 0.6);
    // chỉ dịch ngang/dọc (cùng mức zoom): ảnh đã vẽ vẫn sắc nét, không cần vẽ lại cho tới khi gần hết lề đệm
    const pure = differs && bc && bc.z === this.z && Math.abs(tx) < covX * 0.5 && Math.abs(ty) < covY * 0.5;
    // ô vệ tinh tải xong: gộp lại, tối đa ~8 lần vẽ lại/giây (3 lần/giây khi đang kéo) thay vì vẽ lại cả khung rộng cho từng ô
    let staleNow = false;
    if (this.bgStale) {
      if (now - (this.lastBgDraw || 0) > (moving ? 300 : 120)) staleNow = true;
      else if (!this.staleTimer) this.staleTimer = setTimeout(() => { this.staleTimer = 0; this.invalidate(); }, 130);
    }
    if (this.fading && now - (this.lastBgDraw || 0) > 30) staleNow = true; // ô vệ tinh đang hiện dần
    if (this.needGL || !this.bgDone || staleNow || (differs && !pure && (!moving || bad))) {
      this.lastBgDraw = now;
      this.renderBg(); this.drawGL(); this.bc = { cx: this.cx, cy: this.cy, z: this.z }; this.needGL = this.bgStale = false;
      this.bg.style.transform = this.glc.style.transform = '';
    } else if (differs || this.glc.style.transform) {
      this.bg.style.transform = this.glc.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${k})`;
    }
    const redraw = this.needOver || camChanged;
    if (redraw || this.ripples.length || this.intro < 1 || this.measure) { this.renderOver(now, moving); this.needOver = false; }
    this.renderAnim(now, redraw);
    this.dirty = false; this.lastFrame = now;
    this.emit('frame');
    if (this.pendingHover && !this.pointers.size && !this.camMoving()) { const ev = this.pendingHover; this.pendingHover = null; this.onHoverMove(ev); } // camera dừng: dò thửa dưới con trỏ đúng một lần
    const live = this.sel >= 0 || this.zone >= 0 || moving || !!this.pendingHover || !!this.fading;
    if ((busy || live || this.ripples.length || this.intro < 1 || this.again) && !this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  resize() {
    const r = this.root.getBoundingClientRect(); const nw = Math.max(1, r.width), nh = Math.max(1, r.height), nd = Math.min(window.devicePixelRatio || 1, 2);
    if (this.W === nw && this.H === nh && this.dpr === nd && this.bg.width) return; // ResizeObserver bắn cả khi không đổi kích thước: tránh cấp phát lại canvas
    this.W = nw; this.H = nh; this.dpr = nd; this.rect = r;
    for (const c of [this.an, this.ov]) { c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr); }
    // nền + GPU vẽ vào khung rộng hơn màn hình (mỗi bên 20%): kéo/zoom chỉ dịch/co ảnh bằng CSS, vẽ lại một lần khi dừng
    const M = this.M = 0; // 0: canvas GPU đúng bằng màn hình, vẽ lại trực tiếp mỗi khung khi camera đổi (rẻ với GPU) — không còn canvas to dịch bằng CSS rồi vẽ lại giật cục
     this.GW = Math.round(this.W * (1 + 2 * M)); this.GH = Math.round(this.H * (1 + 2 * M)); this.mx = (this.GW - this.W) / 2; this.my = (this.GH - this.H) / 2;
    // khung nền/GPU rộng 1,6 lần màn hình: giới hạn tổng số điểm ảnh (~12 triệu) để không tràn bộ nhớ GPU (nguyên nhân crash trên màn hình lớn/mật độ cao)
    this.gdpr = Math.min(this.dpr, Math.sqrt(12e6 / (this.GW * this.GH)));
    for (const c of [this.bg, this.glc]) {
      c.width = Math.round(this.GW * this.gdpr); c.height = Math.round(this.GH * this.gdpr);
      Object.assign(c.style, { inset: 'auto', left: `${-this.mx}px`, top: `${-this.my}px`, width: `${this.GW}px`, height: `${this.GH}px`, maxWidth: 'none', maxHeight: 'none' });
    }
    this.bc = null; this.invalidate(true);
  }

  /* ---------- nền: giấy + ô vệ tinh ---------- */
  renderBg() {
    const { bgx: ctx, GW: W, GH: H, gdpr: dpr, state } = this; this.bgDone = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = state.basemap === 'sat' ? '#27332e' : PAPER; ctx.fillRect(0, 0, W, H); // nền vệ tinh: tối trung tính, ô chưa về không chớp màu giấy sáng
    this.fading = false;
    if (state.basemap === 'sat') this.drawTiles(ctx); // ảnh vệ tinh: giữ nguyên, không phủ hạt
    else { // nền Giấy: hạt giấy nằm DƯỚI lớp thửa (lớp GPU vẽ sau trên canvas khác) nên màu thửa không bị hạt làm bẩn
      this.grainPat ||= ctx.createPattern(grainTile(), 'repeat');
      ctx.fillStyle = this.grainPat; ctx.fillRect(0, 0, W, H);
    }
  }
  src() { return this.cfg.BAN_DO.VE_TINH; }
  tileImg(z, x, y) {
    const key = `${z}/${x}/${y}`; let t = this.tiles.get(key);
    if (t) return t;
    t = { img: new Image(), ok: false, bad: false, t1: 0 }; this.tiles.set(key, t);
    t.img.referrerPolicy = 'no-referrer'; t.img.decoding = 'async';
    // chỉ coi là sẵn sàng sau khi đã GIẢI MÃ xong (decode) — nếu không, lần vẽ đầu phải giải mã ngay trên luồng chính gây khựng/chớp
    const done = () => { if (t.ok || t.bad) return; t.ok = true; t.t1 = performance.now(); this.bgStale = true; this.invalidate(); };
    t.img.onload = () => { if (t.img.decode) t.img.decode().then(done, done); else done(); };
    t.img.onerror = () => { t.bad = true; if (!this._tileWarn) { this._tileWarn = true; this.emit('tile-error'); } };
    t.img.src = this.src().url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    if (this.tiles.size > 420) { const k = this.tiles.keys().next().value; this.tiles.delete(k); }
    return t;
  }
  /** Ô chưa tải: vẽ tạm từ ô cấp thấp hơn (cha, tới 5 cấp) hoặc ghép từ 4 ô con đã có (khi thu nhỏ) — không để lộ nền trống. */
  drawFallback(ctx, Z, txw, ty, X, Y, tm, pad) {
    for (let up = 1; up <= 5 && Z - up >= 3; up++) {
      const f = 2 ** up; const pt = this.tiles.get(`${Z - up}/${Math.floor(txw / f)}/${Math.floor(ty / f)}`);
      if (pt?.ok) { const sw = 256 / f; ctx.drawImage(pt.img, ((txw % f) / f) * 256, ((ty % f) / f) * 256, sw, sw, X, Y, tm + pad, tm + pad); return true; }
    }
    let any = false; const h = tm / 2;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const ct = this.tiles.get(`${Z + 1}/${txw * 2 + dx}/${ty * 2 + dy}`);
      if (ct?.ok) { ctx.drawImage(ct.img, X + dx * h, Y + dy * h, h + pad, h + pad); any = true; }
    }
    return any;
  }
  drawTiles(ctx) {
    const s = this.scale; const maxN = this.src().zoomToiDa; const now = performance.now(); let fading = false;
    const Z = clamp(Math.round(this.z), 3, maxN); const tm = TILE_WORLD / 2 ** Z; const o = this.D.meta.origin;
    const [wx0, wy0] = this.toWorld(-this.mx, -this.my), [wx1, wy1] = this.toWorld(this.W + this.mx, this.H + this.my);
    const tx0 = Math.floor((HALF + o.mx + wx0) / tm), tx1 = Math.floor((HALF + o.mx + wx1) / tm);
    const ty0 = Math.floor((HALF - o.my + wy0) / tm), ty1 = Math.floor((HALF - o.my + wy1) / tm);
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 120) return;
    const gd = this.gdpr; ctx.setTransform(gd * s, 0, 0, gd * s, gd * (this.GW / 2 - this.cx * s), gd * (this.GH / 2 - this.cy * s));
    ctx.imageSmoothingQuality = 'medium'; const pad = 0.6 / s; const n = 2 ** Z;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (ty < 0 || ty >= n) continue; const txw = ((tx % n) + n) % n;
      const X = tx * tm - HALF - o.mx, Y = ty * tm - HALF + o.my;
      const t = this.tileImg(Z, txw, ty);
      const a = t.ok ? Math.min(1, (now - t.t1) / 220) : 0; // ô mới về hiện dần (không bật hẳn lên) trên nền ô cấp khác
      if (a < 1) this.drawFallback(ctx, Z, txw, ty, X, Y, tm, pad);
      if (t.ok) { if (a < 1) { ctx.globalAlpha = a; fading = true; } ctx.drawImage(t.img, X, Y, tm + pad, tm + pad); ctx.globalAlpha = 1; }
    }
    this.fading = fading;
    // tải trước cấp kế bên (thu nhỏ: cả khung; phóng to: 2x2 quanh tâm) để lần zoom đầu tiên không phải chờ ô
    if (Z - 1 >= 3) { for (let ty = Math.max(0, ty0 >> 1); ty <= Math.min(n / 2 - 1, ty1 >> 1); ty++) for (let tx = tx0 >> 1; tx <= tx1 >> 1; tx++) this.tileImg(Z - 1, ((tx % (n / 2)) + n / 2) % (n / 2), ty); }
    if (Z + 1 <= maxN) { const cx = Math.floor((HALF + o.mx + this.cx) / tm * 2), cy = Math.floor((HALF - o.my + this.cy) / tm * 2); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.tileImg(Z + 1, ((cx + dx) % (2 * n) + 2 * n) % (2 * n), cy + dy); }
  }

  /* ---------- lưới VN-2000: dấu + tại giao điểm, nhãn X (Bắc) / Y (Đông) ở mép ---------- */
  vnGrid() {
    const W = this.W, H = this.H; const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([px, py]) => { const [x, y] = this.toWorld(px, py); return this.vnAt(x, y); });
    const xs = corners.map((c) => c.X), ys = corners.map((c) => c.Y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mpp = this.mpp(); const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    const step = steps.find((v) => v / mpp >= 130) || steps[steps.length - 1];
    const pts = []; const meta = this.D.meta;
    const iy0 = Math.floor(y0 / step), iy1 = Math.ceil(y1 / step), ix0 = Math.floor(x0 / step), ix1 = Math.ceil(x1 / step);
    if ((iy1 - iy0 + 1) * (ix1 - ix0 + 1) > 600) return null;
    for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) {
      const X = ix * step, Y = iy * step; const key = `${X},${Y}`; let p = this.gridCache.get(key);
      if (!p) { const ll = vnToWgs(X, Y); const r = lonLatToRel(meta, ll.lon, ll.lat); p = { x: r.x, y: -r.y }; if (this.gridCache.size > 8000) this.gridCache.clear(); this.gridCache.set(key, p); }
      const [sx, sy] = this.toScreen(p.x, p.y); pts.push({ X, Y, sx, sy, ix, iy });
    }
    return { pts, step };
  }

  /* ---------- lớp động ---------- */
  renderOver(now, moving = false) {
    const c = this.octx, { W, H, dpr } = this; const s = this.scale; const sat = this.state.basemap === 'sat';
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    this.drawGridMarks(c, sat);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - this.cx * s), dpr * (H / 2 - this.cy * s));
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (this.hlPath) { c.globalAlpha = 0.34; c.fillStyle = RED; c.fill(this.hlPath, 'evenodd'); c.globalAlpha = 1; c.strokeStyle = RED; c.lineWidth = 1.6 / s; c.stroke(this.hlPath); }
    if (this.hover >= 0 && this.hover !== this.sel) {
      const p = this.cached(`p${this.hover}`, () => this.ringsPath(this.D.P, this.hover));
      c.fillStyle = 'rgba(146,43,50,.18)'; c.fill(p, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 1.8 / s; c.stroke(p);
    }
    if (this.hoverZ >= 0 && this.hoverZ !== this.zone) { const p = this.cached(`z${this.hoverZ}`, () => this.ringsPath(this.D.qh, this.hoverZ)); c.fillStyle = 'rgba(146,43,50,.16)'; c.fill(p, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 1.8 / s; c.stroke(p); }
    if (this.flash >= 0) { const p = this.cached(`p${this.flash}`, () => this.ringsPath(this.D.P, this.flash)); c.fillStyle = 'rgba(146,43,50,.55)'; c.fill(p, 'evenodd'); c.strokeStyle = INK; c.lineWidth = 2.2 / s; c.stroke(p); }
    if (this.sel >= 0) this.drawSelected(c, s, now);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.flash >= 0) { const fc = this.parcelCenter(this.flash); const [fx, fy] = this.toScreen(fc.x, fc.y); c.beginPath(); c.arc(fx, fy, 16, 0, 7); c.lineWidth = 4; c.strokeStyle = PAPER; c.stroke(); c.lineWidth = 2; c.strokeStyle = RED; c.stroke(); }
    if (this.z >= 17 && this.state.diachinh) this.drawLabels(c, sat);
    // gợn sóng khi bấm
    const live = [];
    for (const r of this.ripples) {
      const t = (now - r.t) / 900; if (t >= 1) continue; live.push(r);
      const [sx, sy] = this.toScreen(r.x, r.y);
      for (let k = 0; k < 3; k++) {
        const tt = clamp(t * 1.25 - k * 0.14, 0, 1); if (tt <= 0) continue;
        c.beginPath(); c.arc(sx, sy, 6 + tt * 70, 0, Math.PI * 2);
        c.lineWidth = 2.2 * (1 - tt) + 0.4; c.strokeStyle = RED; c.globalAlpha = (1 - tt) * 0.85; c.stroke();
      }
    }
    c.globalAlpha = 1; this.ripples = live;
    this.drawMeasure(c); this.drawGPS(c); this.drawPin(c);
  }
  drawGridMarks(c, sat) {
    const g = this.vnGrid(); if (!g) return;
    const free = (x, y, w, h) => !(this.avoid || []).some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
    const W = this.W, H = this.H; c.lineCap = 'butt';
    const draw = (col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (const p of g.pts) { if (p.sx < -8 || p.sy < -8 || p.sx > W + 8 || p.sy > H + 8) continue; c.moveTo(p.sx - 5, p.sy); c.lineTo(p.sx + 5, p.sy); c.moveTo(p.sx, p.sy - 5); c.lineTo(p.sx, p.sy + 5); } c.stroke(); };
    draw(sat ? 'rgba(12,38,34,.55)' : 'rgba(243,232,211,.85)', 3.2); draw(sat ? PAPER : GREEN, 1.1);
    // nhãn ở mép: Y (Đông) dọc cạnh dưới, X (Bắc) dọc cạnh trái; chữ be viền tối ở mọi nền
    c.font = '700 10px Inter, system-ui, sans-serif'; c.lineJoin = 'round'; c.lineWidth = 3.4;
    const fg = PAPER, halo = 'rgba(2,40,34,.95)'; // kiểu chữ của nền vệ tinh (chữ be, viền tối) áp cho cả nền Giấy
    const put = (t, x, y) => { c.strokeStyle = halo; c.strokeText(t, x, y); c.fillStyle = fg; c.fillText(t, x, y); };
    const fmtV = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const band = this.band || [70, H - 40]; const cols = new Map(), rowsM = new Map();
    for (const p of g.pts) {
      if (p.sx > 30 && p.sx < W - 30 && p.sy > 0 && p.sy < H) { const o = cols.get(p.iy); if (!o || p.sy > o.sy) cols.set(p.iy, p); }
      if (p.sy > band[0] + 8 && p.sy < band[1] - 8 && p.sx > -400 && p.sx < W + 400) { const o = rowsM.get(p.ix); if (!o || Math.abs(p.sx) < Math.abs(o.sx)) rowsM.set(p.ix, p); }
    }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const p of cols.values()) { const t = `Y ${fmtV(p.Y)}`; const w = c.measureText(t).width; if (free(p.sx - w / 2 - 4, H - 24, w + 8, 14)) put(t, p.sx, H - 11); }
    c.textAlign = 'left';
    let drawn = 0;
    for (const p of rowsM.values()) { const t = `X ${fmtV(p.X)}`; const w = c.measureText(t).width; if (free(8, p.sy - 14, w + 6, 14)) { put(t, 9, p.sy - 4); drawn++; } }
    if (!drawn) { // không có hàng lưới nào trong vùng nhìn thấy (ví dụ điện thoại, thẻ thông tin che phần lớn bản đồ): ghi X tại giữa vùng nhìn thấy
      const my = (band[0] + band[1]) / 2; const [wx, wy] = this.toWorld(W / 2, my); const v = this.vnAt(wx, wy); const t = `X ${fmtV(v.X)}`;
      c.strokeStyle = halo; c.lineWidth = 3.6; c.beginPath(); c.moveTo(0, my); c.lineTo(8, my); c.stroke(); c.strokeStyle = fg; c.lineWidth = 1.2; c.stroke(); c.lineWidth = 3.4;
      put(t, 11, my + 3.5);
    }
  }
  /** Danh sách ứng viên nhãn trong một vùng rộng hơn khung nhìn (tính một lần, dùng lại khi kéo/zoom vào): sắp theo diện tích giảm dần. */
  labelCands() {
    const [wx0, wy0] = this.toWorld(0, 0), [wx1, wy1] = this.toWorld(this.W, this.H);
    const lc = this.lblCache;
    if (lc && wx0 >= lc.x0 && wx1 <= lc.x1 && wy0 >= lc.y0 && wy1 <= lc.y1) return lc.list;
    const mx = wx1 - wx0, my = wy1 - wy0; const x0 = wx0 - mx * 0.6, x1 = wx1 + mx * 0.6, y0 = wy0 - my * 0.6, y1 = wy1 + my * 0.6;
    const { P } = this.D; const q = this.q; const g = this.grid;
    const gx0 = Math.max(0, Math.floor((x0 - this.bb.x0) / g.cell)), gx1 = Math.min(g.nx - 1, Math.floor((x1 - this.bb.x0) / g.cell));
    const gy0 = Math.max(0, Math.floor((y0 - this.bb.y0) / g.cell)), gy1 = Math.min(g.ny - 1, Math.floor((y1 - this.bb.y0) / g.cell));
    const seen = new Set(); const list = [];
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      for (const i of g.cells[gy * g.nx + gx]) {
        if (seen.has(i)) continue; seen.add(i);
        const w = (P.bbox[4 * i + 2] - P.bbox[4 * i]) / q, hh = (P.bbox[4 * i + 3] - P.bbox[4 * i + 1]) / q;
        const lp = this.labelPoint(i); list.push({ i, x: lp.x, y: lp.y, w, hh, a: w * hh });
      }
    }
    list.sort((a, b) => b.a - a.a);
    this.lblCache = { x0, x1, y0, y1, list }; return list;
  }
  /** Nhãn dựng sẵn vào MỘT tấm atlas duy nhất (không tạo nhiều canvas — tránh tràn bộ nhớ GPU); đầy thì xóa và dựng lại dần. */
  sprite(text, font, fg, halo, px) {
    const key = `${text}|${font}|${fg}|${this.dpr}`; let sp = this.sprites.get(key); if (sp) return sp;
    const d = this.dpr; const m = this.sprM ||= document.createElement('canvas').getContext('2d'); m.font = font;
    const w = Math.ceil(m.measureText(text).width + 8), h = Math.ceil(px * 1.5 + 6); const pw = Math.ceil(w * d), ph = Math.ceil(h * d);
    let at = this.atlas; const SZ = 1536;
    if (!at) { const cv = document.createElement('canvas'); cv.width = cv.height = SZ; at = this.atlas = { cv, g: cv.getContext('2d'), x: 0, y: 0, rh: 0 }; }
    if (at.x + pw > SZ) { at.x = 0; at.y += at.rh; at.rh = 0; }
    if (at.y + ph > SZ) { at.g.clearRect(0, 0, SZ, SZ); at.x = at.y = at.rh = 0; this.sprites.clear(); }
    const g = at.g; g.save(); g.setTransform(d, 0, 0, d, at.x, at.y); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 3.2; g.strokeStyle = halo; g.fillStyle = fg; g.strokeText(text, w / 2, h / 2); g.fillText(text, w / 2, h / 2); g.restore();
    sp = { sx: at.x, sy: at.y, pw, ph, w, h }; at.x += pw; at.rh = Math.max(at.rh, ph); this.sprites.set(key, sp); return sp;
  }
  /** Nhãn số thửa luôn hiện (cả khi kéo/zoom): đặt tại điểm nhãn của thửa; chỉ thửa đủ lớn trên màn hình, tối đa 600 nhãn. */
  drawLabels(c, sat) {
    const s = this.scale; const W = this.W, H = this.H; const list = this.labelCands();
    const showArea = this.mpp() * 140 <= 30; // zoom tới mức thước tỉ lệ ~20 m: hiện thêm diện tích
    const px = this.z > 18.6 ? 12 : 10.5; const halo = 'rgba(12,38,34,.85)'; const fg = PAPER; // kiểu chữ của nền vệ tinh cho cả nền Giấy
    const f1 = `700 ${px}px Inter, system-ui, sans-serif`, f2 = `500 ${px - 1.5}px Inter, system-ui, sans-serif`; let n = 0;
    const ox = W / 2 - this.cx * s, oy = H / 2 - this.cy * s;
    // blit 1:1 và căn theo điểm ảnh thiết bị, tắt làm mịn: trước đây vẽ ở toạ độ lẻ/ép co giãn nên nhãn bị nhòe (khác chữ toạ độ vẽ thẳng bằng fillText)
    const d = this.dpr; c.imageSmoothingEnabled = false;
    const blit = (a, cx, cy) => { const w = a.pw / d, hh = a.ph / d; c.drawImage(this.atlas.cv, a.sx, a.sy, a.pw, a.ph, Math.round((cx - w / 2) * d) / d, Math.round((cy - hh / 2) * d) / d, w, hh); };
    for (const o of list) {
      const w = o.w * s, hh = o.hh * s; if (w < 38 || hh < 16) continue;
      const sx = o.x * s + ox, sy = o.y * s + oy; if (sx < -30 || sy < -20 || sx > W + 30 || sy > H + 20) continue;
      if (++n > 600) break;
      const two = showArea && hh >= 28; const y = two ? sy - px * 0.55 : sy;
      const a = this.sprite(String(this.rows[o.i][1]), f1, fg, halo, px); blit(a, sx, y);
      if (two) { const b2 = this.sprite(fmtArea(this.rows[o.i][2]), f2, fg, halo, px); blit(b2, sx, sy + px * 0.75); }
    }
    c.imageSmoothingEnabled = true;
  }
  drawSelected(c, s, now) {
    const P = this.D.P;
    const path = this.cached(`p${this.sel}`, () => this.ringsPath(P, this.sel));
    const ct = this.ct;
    if (ct && ct.ctStart[this.sel + 1] > ct.ctStart[this.sel]) {
      for (let k = ct.ctStart[this.sel]; k < ct.ctStart[this.sel + 1]; k++) {
        const pp = this.cached(`c${k}`, () => this.ringsPath(ct, k));
        c.globalAlpha = 0.85; c.fillStyle = colQH(ct.meta.codes[ct.code[k]][0]); c.fill(pp, 'evenodd');
        c.globalAlpha = 1; c.strokeStyle = PAPER; c.lineWidth = 1.2 / s; c.stroke(pp);
      }
    }
    // nét gạch chéo (như khắc bản đồ) cắt theo thửa
    c.save(); c.clip(path, 'evenodd'); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const b = this.parcelBounds(this.sel); const [ax, ay] = this.toScreen(b.x0, b.y0), [bx, by] = this.toScreen(b.x1, b.y1);
    c.strokeStyle = 'rgba(12,38,34,.5)'; c.lineWidth = 1; c.beginPath();
    for (let x = Math.floor(ax - (by - ay)); x < bx + 10; x += 7) { c.moveTo(x, by + 4); c.lineTo(x + (by - ay) + 8, ay - 4); }
    c.stroke(); c.restore();
    c.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * (this.W / 2 - this.cx * s), this.dpr * (this.H / 2 - this.cy * s));
  }
  /** Lớp nét chạy: viền thửa/vùng đang chọn luôn chuyển động nhẹ (chỉ vẽ một đường nên rất rẻ). */
  renderAnim(now, redraw = false) {
    const c = this.actx, { W, H, dpr } = this; const want = this.sel >= 0 || this.zone >= 0;
    if (!want) { if (this.animOn) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.an.width, this.an.height); this.animOn = false; } return; }
    if (!redraw && this.animOn && now - (this.lastAnim || 0) < 32) return; // ~30 khung/giây khi đứng yên
    this.lastAnim = now; this.animOn = true; const s = this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.an.width, this.an.height);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - this.cx * s), dpr * (H / 2 - this.cy * s));
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (this.zone >= 0) {
      const p = this.cached(`z${this.zone}`, () => this.ringsPath(this.D.qh, this.zone));
      c.strokeStyle = INK; c.lineWidth = 3 / s; c.setLineDash([8 / s, 5 / s]); c.lineDashOffset = -(now / 55) / s; c.stroke(p); c.setLineDash([]);
      c.strokeStyle = RED; c.lineWidth = 1.6 / s; c.stroke(p);
    }
    if (this.sel >= 0) {
      const path = this.cached(`p${this.sel}`, () => this.ringsPath(this.D.P, this.sel));
      const t = Math.min(now - (this.selT0 || 0), 1600) / 1000; const pulse = Math.max(0, 1 - t * 1.4);
      c.strokeStyle = PAPER; c.lineWidth = (5 + pulse * 6) / s; c.stroke(path);
      c.strokeStyle = RED; c.lineWidth = (2.6 + pulse * 2) / s; c.setLineDash([9 / s, 5 / s]); c.lineDashOffset = -(now / 55) / s; c.stroke(path); c.setLineDash([]);
    }
  }

  /* ---------- đo đạc: một bảng duy nhất, hiện cả chiều dài lẫn diện tích; có lùi từng điểm ---------- */
  startMeasure() { this.measure = { pts: [], done: false, cursor: null }; this.invalidate(); this.emit('measure', this.measureInfo()); }
  stopMeasure() { this.measure = null; this.invalidate(); this.emit('measure', null); }
  measureUndo() {
    const m = this.measure; if (!m) return;
    if (m.done) m.done = false; else m.pts.pop();
    this.invalidate(); this.emit('measure', this.measureInfo());
  }
  measureClear() { const m = this.measure; if (!m) return; m.pts = []; m.done = false; this.invalidate(); this.emit('measure', this.measureInfo()); }
  measureInfo() {
    const m = this.measure; if (!m) return null;
    const ll = m.pts.map((p) => this.lonLatAt(p.x, p.y));
    let len = 0; for (let i = 1; i < ll.length; i++) len += haversine(ll[i - 1], ll[i]);
    let area = null, perim = null;
    if (m.pts.length >= 3) {
      let a = 0; for (let i = 0; i < m.pts.length; i++) { const p = m.pts[i], n = m.pts[(i + 1) % m.pts.length]; a += p.x * n.y - n.x * p.y; }
      const cl = Math.cos(ll[0].lat * RAD); area = Math.abs(a / 2) * cl * cl;
      perim = len + haversine(ll[ll.length - 1], ll[0]);
    }
    const last = m.pts.length ? this.vnAt(m.pts.at(-1).x, m.pts.at(-1).y) : null;
    return { n: m.pts.length, length: len, area, perim, last, done: m.done };
  }
  measureClick(x, y) {
    const m = this.measure; if (!m || m.done) return;
    m.pts.push({ x, y }); this.invalidate(); this.emit('measure', this.measureInfo());
  }
  measureFinish() {
    const m = this.measure; if (!m || m.done) return;
    // nhấp đúp tạo thêm một điểm trùng: bỏ đi
    while (m.pts.length > 1 && Math.hypot(m.pts.at(-1).x - m.pts.at(-2).x, m.pts.at(-1).y - m.pts.at(-2).y) < 0.05) m.pts.pop();
    m.done = true; m.cursor = null; this.invalidate(); this.emit('measure', this.measureInfo());
  }
  drawMeasure(c) {
    const m = this.measure; if (!m || !m.pts.length) return;
    const sp = m.pts.map((p) => this.toScreen(p.x, p.y));
    const line = () => { c.beginPath(); sp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (!m.done && m.cursor) c.lineTo(m.cursor[0], m.cursor[1]); };
    if (sp.length >= 3) { c.beginPath(); sp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = 'rgba(146,43,50,.16)'; c.fill(); }
    c.setLineDash([]); line(); c.strokeStyle = PAPER; c.lineWidth = 5; c.stroke();
    c.setLineDash([8, 5]); line(); c.strokeStyle = RED; c.lineWidth = 2.2; c.stroke();
    if (sp.length >= 3) { c.beginPath(); c.moveTo(sp.at(-1)[0], sp.at(-1)[1]); c.lineTo(sp[0][0], sp[0][1]); c.setLineDash([2, 5]); c.lineWidth = 1.6; c.stroke(); }
    c.setLineDash([]);
    for (const [x, y] of sp) { c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fillStyle = PAPER; c.fill(); c.lineWidth = 2; c.strokeStyle = RED; c.stroke(); }
    c.font = '600 11px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i < m.pts.length; i++) {
      const a = this.lonLatAt(m.pts[i - 1].x, m.pts[i - 1].y), b = this.lonLatAt(m.pts[i].x, m.pts[i].y); const d = haversine(a, b);
      const t = d >= 1000 ? `${(d / 1000).toFixed(2).replace('.', ',')} km` : `${d.toFixed(1).replace('.', ',')} m`;
      const mx = (sp[i - 1][0] + sp[i][0]) / 2, my = (sp[i - 1][1] + sp[i][1]) / 2; const w = c.measureText(t).width + 10;
      c.fillStyle = INK; c.fillRect(mx - w / 2, my - 9, w, 18); c.fillStyle = PAPER; c.fillText(t, mx, my + 0.5);
    }
  }
  drawGPS(c) {
    if (!this.gps) return; const [x, y] = this.toScreen(this.gps.x, this.gps.y);
    const r = Math.max(8, this.gps.acc * this.scale);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = 'rgba(2,90,76,.14)'; c.fill(); c.strokeStyle = GREEN; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(x, y, 7, 0, 7); c.fillStyle = RED; c.fill(); c.lineWidth = 3; c.strokeStyle = PAPER; c.stroke();
  }
  drawPin(c) {
    if (!this.pin) return; const [x, y] = this.toScreen(this.pin.x, this.pin.y);
    c.strokeStyle = PAPER; c.lineWidth = 5; c.beginPath(); c.arc(x, y, 9, 0, 7); c.moveTo(x - 17, y); c.lineTo(x + 17, y); c.moveTo(x, y - 17); c.lineTo(x, y + 17); c.stroke();
    c.strokeStyle = RED; c.lineWidth = 2; c.stroke();
  }
  setPin(x, y) { this.pin = x == null ? null : { x, y }; this.invalidate(); }
  setGPS(x, y, acc) { this.gps = x == null ? null : { x, y, acc }; this.invalidate(); }

  /* ---------- nhập liệu ---------- */
  bind() {
    const el = this.ov; el.style.touchAction = 'none';
    let moved = 0, t0 = 0, last = null, lastT = 0, pinch = null;
    el.addEventListener('pointerdown', (e) => {
      this.emit('press'); el.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.vel.x = this.vel.y = 0; this.anim = null; this.pendingHover = null;
      if (this.pointers.size === 1) { moved = 0; t0 = performance.now(); last = { x: e.offsetX, y: e.offsetY }; lastT = t0; this.pv = { x: 0, y: 0 }; this.hist = []; }
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; moved = 99; }
      el.classList.add('grab');
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { this.queueHover(e); return; }
      const nx = e.offsetX, ny = e.offsetY;
      if (this.pointers.size === 2 && pinch) {
        p.x = nx; p.y = ny; const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.panBy(cx - pinch.cx, cy - pinch.cy); this.zoomAt(cx, cy, Math.log2(d / pinch.d), true); pinch = { d, cx, cy }; return;
      }
      const dx = nx - p.x, dy = ny - p.y; p.x = nx; p.y = ny; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 5) {
        this.panBy(dx, dy); const now = performance.now(); const dt = Math.max(1, now - lastT); lastT = now;
        (this.hist ||= []).push({ t: now, x: nx, y: ny }); while (this.hist.length > 2 && now - this.hist[0].t > 120) this.hist.shift();
        if (this.hover !== -1) { this.hover = -1; this.emit('hover', -1); }
      }
    });
    const up = (e) => {
      const had = this.pointers.has(e.pointerId); this.pointers.delete(e.pointerId); if (!had) return;
      if (this.pointers.size < 2) pinch = null;
      if (this.pointers.size === 0) {
        el.classList.remove('grab');
        const dt = performance.now() - t0;
        if (moved <= 5 && dt < 600 && e.type === 'pointerup') this.onClick(e.offsetX, e.offsetY, e);
        else if (e.type === 'pointerup' && moved > 5 && this.hist && this.hist.length > 1) {
          // vận tốc = quãng đường trong ~100 ms cuối; thả chậm hơn 140 ms thì coi như dừng
          const hs = this.hist, a0 = hs[0], b0 = hs.at(-1), span = Math.max(16, b0.t - a0.t);
          if (performance.now() - b0.t < 140) {
            let vx = (b0.x - a0.x) / span, vy = (b0.y - a0.y) / span; const sp = Math.hypot(vx, vy);
            if (sp > 0.12) { const m = Math.min(sp, 3.2) / sp; this.vel.x = vx * m; this.vel.y = vy * m; this.lastFrame = performance.now() - 16; this.invalidate(); }
          }
        }
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { this.hoverEv = this.pendingHover = null; if (this.hover !== -1 || this.hoverZ !== -1) { this.hover = -1; this.hoverZ = -1; this.emit('hover', -1); this.invalidate(false); } });
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.anim = null;
      const dz = clamp(-e.deltaY * (e.ctrlKey ? 0.012 : (e.deltaMode ? 0.05 : 0.0022)), -0.9, 0.9);
      this.zoomAt(e.offsetX, e.offsetY, dz);
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (this.measure && !this.measure.done) { this.measureFinish(); return; }
      this.zoomAt(e.offsetX, e.offsetY, 1);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  /** Rê chuột chỉ xử lý một lần mỗi khung hình (dò thửa + cập nhật DOM), không theo từng sự kiện (chuột 1000 Hz làm đơ). */
  queueHover(e) {
    this.hoverEv = { offsetX: e.offsetX, offsetY: e.offsetY, pointerType: e.pointerType };
    if (this.hoverRaf) return;
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0; const ev = this.hoverEv; this.hoverEv = null; if (!ev || this.pointers.size) return;
      if (this.camMoving()) { this.pendingHover = ev; this.invalidate(); return; } // đang trượt/zoom: bản đồ chạy dưới con trỏ, dò thửa + dựng tooltip mỗi khung là lãng phí (nguyên nhân lag khi thả lúc đang kéo)
      this.onHoverMove(ev);
    });
  }
  camMoving() { return !!(this.vel.x || this.vel.y || this.zt || this.anim || performance.now() - (this.lastMove || -1e9) < 110); }
  onHoverMove(e) {
    const [x, y] = this.toWorld(e.offsetX, e.offsetY);
    this.emit('coords', this.vnAt(x, y));
    if (this.measure && !this.measure.done) { this.measure.cursor = [e.offsetX, e.offsetY]; this.invalidate(false); return; }
    if (e.pointerType === 'touch') return;
    if (this.state.quyhoach) { // chế độ quy hoạch: tô vùng quy hoạch khi rê, nhưng vẫn báo cả thửa nằm bên dưới (để chọn/hiển thị được thửa)
      const z = this.pickZone(x, y); const all = this.pickAll(x, y);
      if (z !== this.hoverZ) { this.hoverZ = z; this.invalidate(false); }
      this.emit('hover', all[0] ?? -1, e.offsetX, e.offsetY, all.length, z); return;
    }
    const all = this.pickAll(x, y); const h = all[0] ?? -1;
    if (h !== this.hover) { this.hover = h; this.invalidate(false); }
    this.emit('hover', h, e.offsetX, e.offsetY, all.length, -1);
  }
  onClick(px, py, e) {
    const [x, y] = this.toWorld(px, py);
    if (this.measure && !this.measure.done) { this.measureClick(x, y); return; }
    this.addRipple(x, y);
    const all = this.pickAll(x, y); // luôn chọn được thửa; bật lớp quy hoạch thì báo thêm vùng quy hoạch tại điểm bấm
    this.emit('click', { x, y, px, py, parcel: all[0] ?? -1, parcels: all, zone: this.state.quyhoach ? this.pickZone(x, y) : -1 });
  }
}

__e["haversine"] = haversine;
__e["MapView"] = MapView;
};
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/vn2000.js"] = function (__e) {
// vn2000.js — VN-2000 (TM-3°, k = 0,9999) <-> WGS84. Chuyển datum 7 tham số (Thông tư 973/2001/TT-TCĐC) rồi chiếu TM.
// Quy ước Việt Nam: X = hướng Bắc (northing), Y = hướng Đông (easting).
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), EP2 = E2 / (1 - E2);
const K0 = 0.9999, FE = 500000, D2R = Math.PI / 180, AS = Math.PI / 648000;
const e4 = E2 * E2, e6 = e4 * E2;
const T = { x: -191.90441429, y: -39.30318279, z: -111.45032835 };
const Rt = { x: -0.00928836 * AS, y: 0.01975479 * AS, z: -0.00427372 * AS };
const M = 1 + 0.252906278e-6;
let L0 = 105.75 * D2R;
const setCentralMeridian = (deg) => { L0 = deg * D2R; };

const merid = (p) => A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * p - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * p) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * p) - (35 * e6 / 3072) * Math.sin(6 * p));
function tmForward(lat, lon) {
  const p = lat * D2R, l = lon * D2R; const sp = Math.sin(p), cp = Math.cos(p), tp = Math.tan(p);
  const N = A / Math.sqrt(1 - E2 * sp * sp), Tt = tp * tp, C = EP2 * cp * cp, a = (l - L0) * cp;
  const E = K0 * N * (a + (1 - Tt + C) * a ** 3 / 6 + (5 - 18 * Tt + Tt * Tt + 72 * C - 58 * EP2) * a ** 5 / 120) + FE;
  const Nn = K0 * (merid(p) + N * tp * (a * a / 2 + (5 - Tt + 9 * C + 4 * C * C) * a ** 4 / 24 + (61 - 58 * Tt + Tt * Tt + 600 * C - 330 * EP2) * a ** 6 / 720));
  return { E, N: Nn };
}
function tmInverse(E, Nn) {
  const mu = (Nn / K0) / (A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256)); const s = Math.sqrt(1 - E2), e1 = (1 - s) / (1 + s);
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sp = Math.sin(p1), cp = Math.cos(p1), tp = Math.tan(p1);
  const N1 = A / Math.sqrt(1 - E2 * sp * sp), T1 = tp * tp, C1 = EP2 * cp * cp, R1 = A * (1 - E2) / (1 - E2 * sp * sp) ** 1.5, D = (E - FE) / (N1 * K0);
  const lat = p1 - (N1 * tp / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = L0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / cp;
  return { lat: lat / D2R, lon: lon / D2R };
}
function toECEF(lat, lon) {
  const p = lat * D2R, l = lon * D2R, sp = Math.sin(p), cp = Math.cos(p); const N = A / Math.sqrt(1 - E2 * sp * sp);
  return { x: N * cp * Math.cos(l), y: N * cp * Math.sin(l), z: N * (1 - E2) * sp };
}
function fromECEF(c) {
  const l = Math.atan2(c.y, c.x), r = Math.hypot(c.x, c.y); let p = Math.atan2(c.z, r * (1 - E2));
  for (let i = 0; i < 6; i++) { const sp = Math.sin(p), N = A / Math.sqrt(1 - E2 * sp * sp); p = Math.atan2(c.z + E2 * N * sp, r); }
  return { lat: p / D2R, lon: l / D2R };
}
const vnToWgsGeo = (lat, lon) => { const c = toECEF(lat, lon); return fromECEF({ x: T.x + M * (c.x - Rt.z * c.y + Rt.y * c.z), y: T.y + M * (Rt.z * c.x + c.y - Rt.x * c.z), z: T.z + M * (-Rt.y * c.x + Rt.x * c.y + c.z) }); };
const wgsToVnGeo = (lat, lon) => { const c = toECEF(lat, lon), x = (c.x - T.x) / M, y = (c.y - T.y) / M, z = (c.z - T.z) / M; return fromECEF({ x: x + Rt.z * y - Rt.y * z, y: -Rt.z * x + y + Rt.x * z, z: Rt.y * x - Rt.x * y + z }); };

/** WGS84 -> VN-2000: { X: Bắc, Y: Đông } (mét) */
function wgsToVN(lat, lon) { const g = wgsToVnGeo(lat, lon); const r = tmForward(g.lat, g.lon); return { X: r.N, Y: r.E }; }
/** VN-2000 (X Bắc, Y Đông) -> WGS84 { lat, lon } */
function vnToWgs(X, Y) { const g = tmInverse(Y, X); return vnToWgsGeo(g.lat, g.lon); }

__e["setCentralMeridian"] = setCentralMeridian;
__e["wgsToVN"] = wgsToVN;
__e["vnToWgs"] = vnToWgs;
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
__defs["/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/icons.js"] = function (__e) {
// icons.js — biểu tượng của bản cũ (SVG nhúng dạng văn bản), đổi sang bảng màu mới bằng currentColor.
const layer = "<svg width=\"150\" height=\"133\" viewBox=\"0 0 150 133\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M39.7841 103.542L38.5945 103.931L37.9707 104.107L37.8699 102.161L37.8384 101.969L37.8257 101.807L37.3113 101.18L37.1147 100.92L37.1212 100.864L37.3126 100.805L37.5318 100.766L37.5637 100.759L37.7842 100.711L37.9982 100.659L38.0282 100.596L38.0341 100.511L37.9982 100.416L37.9679 100.366L37.9323 100.328L37.8687 100.27L37.8443 100.239L37.8362 100.186L37.8557 100.136L37.894 100.073L37.9604 99.9423L37.9656 99.7979L37.9189 99.7036L37.8554 99.5944L37.7786 99.4874L37.7511 99.4356L37.6769 99.3376L37.6327 99.2673L37.6716 99.2009L37.741 99.1255L37.9202 99.0203L38.0024 98.9708L38.1299 98.805L38.1494 98.77L38.122 98.7479L38.0365 98.6943L37.904 98.6274L37.8131 98.5811L37.7828 98.546L37.7746 98.4813L37.7857 98.4037L37.7858 98.3668L37.7556 98.3465L37.7087 98.341L37.524 98.3648L37.4465 98.3719L37.411 98.348L37.3836 98.3075L37.4028 98.2316L37.4638 98.1024L37.5738 97.9643L37.696 97.5582L37.8232 97.37L37.8566 97.3037L37.8511 97.2741L37.763 97.2223L37.6558 97.1243L37.5458 96.8915L37.4559 96.5971L37.416 96.4519L37.3861 96.4095L37.3447 96.3966L37.0604 96.3757L36.9998 96.3757L36.9668 96.3424L36.9503 96.2981L36.9669 96.2538L37.1549 96.088L37.2521 95.9275L37.2741 95.8427L37.2424 95.7059L37.2065 95.6782L37.135 95.6743L36.8866 95.685L36.8341 95.6831L36.7983 95.6554L36.7243 95.5462L36.5177 95.3299L36.4048 95.1987L36.3856 95.1453L36.3885 95.0954L36.4437 95.0401L36.5242 94.9643L36.5436 94.9219L36.5358 94.7207L36.5442 94.6524L36.7408 94.3948L36.9015 94.2066L37.0006 94.1516L37.5859 93.9567L37.6553 93.9252L37.8087 93.7232L38.243 93.3636L38.2873 93.3082L38.3981 93.0353L38.4452 92.9817L38.5115 92.9523L38.6689 92.9211L39.116 92.8626L39.2954 92.7615L39.5138 92.649L39.6984 92.5894L39.9495 92.5436L40.5706 92.4061L40.8578 92.3142L40.9214 92.2681L40.9492 92.1795L41.0324 92.0024L41.0628 91.9674L41.1017 91.9489L42.0475 91.7059L42.1969 91.6543L42.3126 91.5587L42.6035 91.2136L42.7115 90.9978L42.7392 90.9389L42.729 90.8278L42.7201 90.7354L42.6186 90.4307L42.5693 90.2278L42.5533 90.164L42.4504 89.7428L42.4245 89.6384L42.3716 89.2466L42.2544 88.6352L42.1503 88.2917L42.0675 87.943L41.9937 87.5646L41.8707 87.1525L41.8012 86.9944L41.7328 86.8298L41.6869 86.4254L41.6671 86.3704L41.4586 85.8938L41.3707 85.6315L41.3565 85.5023L41.3895 85.329L41.4563 85.2219L41.6027 85.1243L41.6416 85.0467L41.6308 84.9322L41.5812 84.8399L41.4878 84.6884L41.3219 84.3506L41.0774 83.8205L40.9003 83.4269L40.7873 83.233L40.7398 83.1249L40.6943 83.0222L40.5541 82.7433L40.6367 82.6945L40.6614 82.6831L41.9633 82.0298L42.2846 81.8703L43.1473 81.4446L43.1712 81.4302L43.1605 81.4225L42.9033 81.3682L42.646 81.3337L42.5857 81.3117L42.448 81.2764L42.2365 81.1921L42.1415 81.139L42.0624 81.0853L41.8749 80.9409L41.7363 80.8287L41.5849 80.7038L41.4477 80.5974L41.4303 80.5821L41.389 80.5436L41.3557 80.5195L41.3192 80.4926L41.2717 80.4571L41.1429 80.4981L41.0838 80.4126L41.0666 80.3885L41.0003 80.2796L40.9482 80.1886L40.9261 80.1505L40.8996 80.0934L40.8583 80.0174L40.8532 79.9967L40.7815 79.8609L40.7198 79.7558L40.6942 79.7124L40.6666 79.6646L40.6591 79.6453L40.6022 79.5695L40.5609 79.5055L40.4967 79.4194L40.4458 79.3388L40.3889 79.2642L40.382 79.2489L40.3091 79.1546L40.2221 79.0443L40.1711 78.988L40.1623 78.978L40.1259 78.9451L40.0373 78.8696L40.0117 78.8345L39.9024 78.751L39.8235 78.6729L39.7269 78.5866L39.6871 78.5575L39.4469 78.3277L39.3655 78.242L39.1445 78.2681L39.0596 78.1754L38.9384 78.0511L38.8684 77.9754L38.8515 77.9617L38.7069 77.8145L38.5519 77.661L38.474 77.5783L38.4183 77.5129L38.27 77.3168L38.1767 77.1963L38.0653 77.0607L38.0577 77.052L37.9323 76.8689L37.9058 76.8189L37.8772 76.7723L37.8715 76.7619L37.7211 76.5286L37.7174 76.5237L37.6905 76.4848L37.6245 76.3898L37.5733 76.3317L37.4982 76.2109L37.3649 76.0088L37.3547 75.9917L37.2074 75.7451L37.0407 75.3376L36.9788 75.193L36.947 75.1465L36.8697 74.9903L36.7969 74.8426L36.7428 74.6948L36.7331 74.6436L36.7295 74.5965L36.7345 74.5272L36.7656 74.4182L36.8076 74.3457L36.888 74.2096L36.9181 74.15L37.0394 73.9026L37.1345 73.7537L37.24 73.6387L37.2905 73.5356L37.3399 73.4156L37.3858 73.3029L37.4204 73.2064L37.4302 73.1796L37.4031 73.1745L37.4961 72.836L37.5776 72.6893L37.5869 72.2475L37.5899 72.013L37.5901 72.0089L37.5904 71.9895L37.5843 71.837L37.5861 71.8227L37.8586 71.7322L37.8687 71.7289L37.699 71.6031L37.4365 71.3993L37.3635 71.3527L36.7119 70.9198L36.4498 70.7765L36.4221 70.7556L36.3213 70.6795L36.232 70.6136L36.1314 70.5395L36.0061 70.4684L35.9636 70.4286L35.901 70.3704L35.7737 70.2849L35.6616 70.2347L35.587 70.1958L35.4971 70.1331L35.2434 69.9466L35.0702 69.844L34.8985 69.7382L34.7095 69.6089L34.5975 69.5336L34.4646 69.3961L34.3103 69.2287L34.2864 69.2038L34.2473 69.1322L34.1685 69.0334L34.0618 68.9182L34.0363 68.8785L33.803 68.5848L33.6542 68.3841L33.5676 68.2896L33.503 68.2146L33.3546 68.0441L33.2989 67.9608L33.1512 67.7799L32.8592 67.4396L32.8219 67.3895L32.7809 67.3191L32.7556 67.286L32.6893 67.2189L32.5561 67.0675L32.3767 66.8487L32.2545 66.6939L32.0975 66.5038L32.0669 66.472L32.0367 66.4308L31.9178 66.267L31.8435 66.1324L31.8231 66.0848L31.8113 65.8165L31.8093 65.8038L31.7239 65.3651L31.6941 65.0829L31.7043 65.0398L31.771 64.9386L31.9758 64.7014L32.1869 64.438L32.2776 64.2594L32.4037 64.0837L32.426 63.9711L32.4296 63.8711L32.4059 63.8164L32.2605 63.6914L31.9107 63.4839L31.4969 63.2357L31.2491 63.0783L31.0979 63.0065L30.8525 62.8393L30.7459 62.7718L30.14 62.4268L29.9618 62.3071L29.7717 62.1771L29.6955 62.1378L29.5497 62.0715L29.4427 62.0383L29.3474 62.0292L28.9238 61.9473L28.356 61.8447L28.3324 61.8402L28.3741 61.7169L28.397 61.647L28.4292 61.5579L28.475 61.4302L28.4992 61.3529L28.5343 61.2662L28.5627 61.1881L28.6176 61.048L28.6473 60.9745L28.5254 60.9409L28.4815 60.9286L28.3513 60.9091L28.2941 60.8993L28.3097 60.8829L28.3446 60.8033L28.2119 60.7517L28.2263 60.7084L28.2215 60.6688L28.2336 60.6162L28.252 60.5713L28.3242 60.4304L28.3362 60.3842L28.3318 60.3419L28.2722 60.284L28.2337 60.2087L28.2321 60.2053L28.1697 60.0769L28.1446 60.0333L28.125 59.948L28.1068 59.8666L28.1394 59.854L28.224 59.9108L28.3519 59.9884L28.4826 60.0291L28.5237 60.0412L28.65 60.0492L28.702 60.0442L28.7631 60.0691L28.8345 60.0629L28.9045 60.0783L28.9227 60.0822L28.9969 59.9026L29.0621 59.7486L29.1077 59.6475L29.1691 59.5124L29.1873 59.4692L29.2244 59.4167L29.2583 59.3871L29.2752 59.3936L29.2606 59.4053L29.3856 59.4326L29.9171 59.5608L29.8646 59.6572L30.1258 59.7183L30.2032 59.7316L30.4882 59.78L30.6072 59.7967L30.7681 59.8428L30.8408 59.8612L31.142 59.9849L31.1981 60.0095L31.2785 60.0534L31.4183 60.1204L31.7205 60.2507L31.811 60.2817L32.1536 60.4385L32.3485 60.5224L32.4969 60.575L32.547 60.5937L32.5672 60.6014L32.7336 60.663L32.9343 60.7537L33.1517 60.8479L33.3138 60.8924L33.3302 60.8951L33.3844 60.9119L33.51 60.9474L33.5812 60.9612L33.6523 60.975L33.8299 61.0276L33.9395 61.0678L33.8294 61.2513L33.8608 61.2598L33.8611 61.2594L34.1574 61.3369L34.1884 61.2886L34.2006 61.2593L34.3002 61.0705L34.3179 61.0366L34.327 61.0129L34.3406 60.9821L34.5716 61.0008L34.6717 61.009L34.7087 61.0118L34.8766 61.0061L35.0008 61.0013L35.1523 61.0125L35.2881 61.0429L35.3086 61.0477L35.4229 61.056L35.4806 61.0602L35.4936 61.0457L35.527 61.0449L35.5557 61.0516L35.5614 61.062L35.5708 61.0636L35.8584 61.1096L35.8758 61.0968L35.9882 61.096L36.1262 61.1196L36.1496 61.08L36.2432 61.0957L36.4909 61.1567L36.5594 61.1562L36.584 61.2156L36.7071 61.234L36.7845 61.249L36.8137 61.2537L36.8321 61.2381L36.8843 61.2481L37.3772 61.3456L37.3887 61.3479L37.5768 61.3986L37.7773 61.4528L37.8463 61.4712L37.8587 61.4962L37.8981 61.5733L37.891 61.5971L38.0614 61.6776L38.1499 61.7197L38.2943 61.7488L38.3232 61.7546L38.3462 61.7593L38.5158 61.804L38.519 61.805L38.5466 61.8236L38.0963 62.4458L37.7773 62.8726L37.2833 63.5532L37.3911 63.5797L37.6229 63.3928L37.6311 63.3941L37.693 63.3946L37.998 63.1788L38.1229 63.2001L38.1394 63.173L38.1655 63.1298L38.2165 63.1104L38.3066 63.0911L38.4159 63.0448L38.4847 62.9742L38.5057 63.0068L38.5772 63.0214L38.8511 62.9975L38.9385 63.0204L38.9816 63.0053L39.0942 62.976L39.1768 62.9427L39.2172 62.9425L39.3399 62.929L39.4111 62.9142L39.5512 62.8641L39.6925 62.8071L39.7111 62.7933L39.7116 62.811L39.7164 63.0382L39.7193 63.2779L39.7199 63.3003L39.7265 63.4776L39.7568 63.5045L39.9941 63.7014L40.0139 63.7177L40.0658 63.7609L40.3 63.9426L40.3113 63.952L40.3391 63.9736L40.3603 63.9908L40.4918 64.0958L40.8114 64.3641L40.9824 64.0709L41.0064 64.0303L41.3085 63.5237L41.4898 63.5554L41.5299 63.5609L41.5682 63.5712L41.7458 63.6201L41.7628 63.6322L41.8364 63.6548L41.9511 63.6865L42.0248 63.7069L42.0475 63.7143L42.1397 63.7435L42.2891 63.7902L42.4031 63.8143L42.4758 63.8399L42.5074 63.8504L42.6188 63.8859L42.726 63.9198L42.9147 63.9798L42.7195 64.3396L42.9391 64.4001L42.9752 64.4089L43.1722 64.4566L43.2613 64.473L43.4115 64.5113L43.4269 64.515L43.6059 64.5584L43.6167 64.5615L43.753 64.6006L43.8393 64.6253L43.8775 64.6342L43.8914 64.6382L44.058 64.6827L44.092 64.6907L44.3537 64.7532L44.384 64.7599L44.6436 64.8163L44.6234 64.8694L44.5934 64.9476L44.5732 65.0007L44.5694 65.0107L44.553 65.0599L44.5325 65.1224L44.5447 65.1252L44.5733 65.0527L44.6245 65.0186L44.6571 65.0369L44.6649 65.0385L45.0726 65.1342L45.3707 65.2034L45.5518 65.2225L45.5645 65.2251L45.5626 65.2321L45.8367 65.2905L45.8651 65.2929L47.9074 65.7643L48.0028 65.7045L48.0297 65.6796L48.0412 65.6677L48.0287 65.6647L48.0297 65.6636L48.0377 65.6654L48.0777 65.6106L48.188 65.4576L48.2429 65.3819L48.3008 65.2975L48.3995 65.16L48.4766 65.0467L48.5695 64.9131L48.6171 64.848L48.6689 64.7803L48.7014 64.736L48.8558 64.7503L49.3654 64.8912L49.4319 64.9066L49.8677 65.0069L49.9195 64.997L49.6401 65.2926L49.7562 65.361L49.7822 65.3766L49.8018 65.388L49.8417 65.4119L49.9343 65.4687L49.9495 65.4777L49.9922 65.5016L50.041 65.5308L50.0786 65.5561L50.1196 65.5842L50.1315 65.5916L50.2104 65.6417L50.2482 65.664L50.257 65.6682L50.287 65.6823L50.3058 65.6789L50.3641 65.7085L50.4302 65.7458L50.4979 65.7894L50.5395 65.8352L50.5407 65.8361L50.6061 65.8788L50.642 65.8946L50.7416 65.94L50.7795 65.9589L50.8211 65.9755L50.8511 65.9939L50.8734 66.0076L51.0562 66.1269L52.1333 65.4579L52.1421 65.4614L52.2517 65.5261L52.3237 65.5649L52.479 65.6483L52.577 65.7022L52.6874 65.7633L52.7578 65.7856L52.7311 65.8713L52.8131 65.8811L52.981 65.9015L53.0123 65.9052L53.7772 66.018L53.7936 66.0225L53.8508 66.0394L53.9177 66.0474L54.0007 66.0609L54.0642 66.0714L54.1527 66.0879L54.8813 66.209L55.0208 66.2276L55.0576 66.2327L55.1681 66.245L55.281 66.2683L55.3855 66.2938L55.5797 66.3164L55.5816 66.3165L55.7192 66.3363L55.8382 66.3596L55.9178 66.3749L55.9703 66.3822L56.0922 66.3985L56.2108 66.4132L56.2928 66.4236L56.3725 66.4426L56.4382 66.4575L56.6277 66.5198L56.7348 66.5608L56.9068 66.6221L57.0503 66.6779L57.1133 66.6946L57.1495 66.7046L57.1873 66.7175L57.3392 66.779L57.3747 66.7928L57.4644 66.8268L57.6342 66.886L57.7747 66.9292L57.9529 66.988L58.0682 67.0226L58.1109 67.0358L58.123 67.0469L58.1482 67.0697L58.1514 67.0761L58.1674 67.1071L58.2355 67.2404L58.3594 67.4291L58.3606 67.4311L58.4248 67.4587L58.5354 67.4895L58.6157 67.5178L58.8106 67.5671L58.8883 67.5924L59.1613 67.6841L59.2368 67.7061L59.3072 67.7273L59.3132 67.7289L59.36 67.7437L59.3777 67.749L59.5228 67.7988L59.6222 67.8322L59.7069 67.8581L59.7994 67.885L60.241 68.0196L60.3367 68.0481L60.6001 68.1678L60.63 68.1539L60.6832 68.114L60.7876 68.0214L61.0645 68.1043L61.1807 68.1353L61.2865 68.1594L61.4083 68.1893L61.5347 68.2307L61.6008 68.2596L61.6927 68.3059L61.7167 68.3172L61.7839 68.348L61.9718 68.4385L62.0709 68.483L62.1346 68.5228L62.1546 68.5338L62.2095 68.563L62.3328 68.6291L62.3689 68.648L62.3918 68.661L62.4238 68.6789L62.4717 68.7027L62.5295 68.7362L62.5391 68.7409L62.6423 68.8001L62.7116 68.8388L62.7816 68.8775L62.8009 68.8887L62.9049 68.9406L62.9628 68.9796L62.9986 68.9887L63.0236 68.9637L63.0858 68.9019L63.1733 68.7986L63.3078 68.6536L63.4187 68.5344L63.435 68.5168L63.4851 68.4634L63.5281 68.4173L63.5401 68.3907L63.5659 68.3837L63.6461 68.3976L63.8381 68.4169L63.9075 68.4248L64.0585 68.4393L64.2457 68.4619L64.4234 68.4823L64.4439 68.4848L64.599 68.499L64.7036 68.5073L64.9297 68.5364L65.0547 68.5572L65.1817 68.5549L66.1232 68.4341L66.6032 68.4014L67.1629 67.6894L68.1619 66.8136L69.3593 65.7761L69.6107 65.3194L70.161 64.0487L70.7824 63.1695L70.8636 63.068L70.9019 63.0168L70.9633 62.9383L71.3286 62.6945L71.4451 62.5731L71.7601 62.0727L71.8649 61.8851L72.1446 61.3335L72.4341 60.7969L72.6485 60.4178L72.8686 60.0061L73.0082 59.7776L73.0851 59.6695L73.88 59.7816L80.1575 60.3139L80.4309 60.3164L80.4281 60.0469L80.4158 59.8421L80.3931 59.5301L80.3829 59.0621L80.3528 58.7339L80.3146 58.2345L80.2977 58.1201L80.2015 57.816L80.1042 57.4784L80.0428 57.2774L79.9115 57.0105L79.8824 56.9522L79.6926 56.5179L79.7431 56.267L79.7886 56.089L79.834 55.7805L79.9487 55.3785L80.0942 54.7553L80.1009 54.5531L80.1553 54.2374L80.2618 53.8276L80.3022 53.6825L80.3424 53.2972L80.3785 53.0045L80.3058 52.5844L80.1773 52.1967L79.9809 51.8568L79.9286 51.7633L79.8479 51.6805L79.6664 51.5282L79.4323 51.3555L79.2126 51.1817L79.0096 51.0173L78.9332 50.935L78.8874 50.7815L78.8106 50.6108L78.72 50.5076L78.5502 50.3579L78.4089 50.254L78.4044 50.2569L78.3984 50.2523L78.3486 50.1939L78.3647 50.1314L78.4228 49.9976L78.6425 49.6309L78.6589 49.6032L78.9461 49.1026L79.0872 48.8274L79.3232 48.4264L79.3483 48.3795L79.389 48.3449L79.5296 48.2499L79.8 48.0925L79.8138 48.0844L79.9481 48.0125L80.1369 48.2496L80.1262 48.638L80.1089 48.8124L80.1208 48.8715L80.2284 49.0409L80.2446 49.0667L80.6424 49.3017L80.8789 49.3515L81.048 49.3865L81.3849 49.5734L81.5009 49.6907L81.5942 49.9988L81.7058 50.2024L82.3299 50.9678L83.2642 52.2829L84.0295 53.3706L84.1742 53.7246L84.456 53.9812L84.5022 54.023L84.6868 54.2709L85.0765 54.9676L86.0288 56.2995L86.1179 56.5721L86.5388 57.6871L86.618 57.9179L86.9295 58.3058L87.0062 58.402L88 59.3764L88.0901 59.4643L88.5421 59.8513L89.3293 59.6156L90.3994 59.3304L92.4673 58.899L93.7121 58.6531L94.1737 58.9238L94.4682 58.8689L95.4597 58.4749L96.1433 58.1309L96.3493 58.072L96.5927 58.2379L96.5326 58.2589L96.7276 58.3821L96.9621 58.5527L97.1189 58.6807L97.1473 58.6926L97.5246 58.8453L97.8376 58.872L97.9354 58.9258L98.3954 59.0649L99.0106 58.9383L99.4015 58.9143L99.6257 58.9093L99.9849 58.9498L100.235 58.9244L100.409 58.8958L100.605 58.8905L101.122 58.9057L101.388 58.9368L101.495 58.9491L101.519 58.9519L101.522 58.9525L101.681 59.0096L101.93 59.157L102.444 59.3186L102.748 59.3709L102.748 59.3712L103.265 59.4337L103.57 59.4758L103.84 59.5578L104.042 59.6335L104.349 59.7617L104.546 59.8316L104.796 59.896L105.006 59.9249L105.445 59.8849L105.542 59.8717L106.63 59.4695L106.992 59.4713L108.124 59.7646L108.496 60.0015L108.966 60.2793L109.617 60.5837L110.129 60.5277L110.449 60.5437L110.717 60.6712L111.179 60.8649L110.847 61.4267L109.958 62.3536L108.707 63.4221L108.101 63.9894L107.762 64.5217L107.561 64.835L106.891 66.647L106.873 67.5881L108.496 67.6867L109.498 67.9173L109.901 68.0504L110.682 68.3091L111.876 69.0319L112.894 69.8103L113.237 70.1989L113.712 70.7347L113.777 70.8122L113.821 70.8679L114.663 71.591L115.313 72.2003L115.35 72.2346L116.075 73.0536L116.174 73.1374L116.533 73.8474L116.764 74.4295L116.936 75.4133L117.228 76.2386L117.676 76.7631L118.319 77.3025L118.537 77.3904L119.872 77.8697L121.244 78.2752L121.787 78.5232L122.351 78.922L123.073 79.1143L124.356 79.3346L124.639 79.0101L126.117 79.476L126.596 79.6878L127.398 80.0849L127.76 80.4697L128.186 80.9572L128.871 81.991L129.169 82.7839L129.149 84.3232L129.144 84.3785L129.376 85.1496L129.49 85.4825L129.487 85.5027L129.548 85.7204L129.936 86.6714L130.298 87.1773L130.993 88.0483L131.616 88.616L132.097 89.292L131.549 89.5547L130.799 89.8512L130.614 89.947L130.502 89.9802L130.224 90.0728L130.069 90.1472L130.078 90.1886L130.126 90.3366L129.858 90.3228L129.621 90.3316L129.437 90.3586L129.31 90.367L129.179 90.4013L128.825 90.8123L128.256 91.8703L127.933 92.4164L127.702 92.4353L127.793 92.6521L128.329 92.9959L128.424 93.1356L128.499 93.3508L128.554 93.8752L128.54 94.568L128.562 94.7882L128.613 95.0698L128.688 95.7406L128.762 96.182L128.881 96.3923L129.118 96.5772L129.353 96.6824L129.606 97.1182L129.637 97.472L129.714 97.6388L129.777 97.8005L128.984 97.905L128.968 98.0095L128.953 98.0808L128.915 98.4679L128.897 98.7167L128.809 99.0522L128.787 99.3375L128.796 99.444L128.765 99.5514L128.612 99.8082L128.523 99.8854L128.196 100.052L128.108 100.095L127.985 100.162L127.852 100.238L127.735 100.321L127.674 100.371L127.419 100.585L127.425 100.587L127.369 100.62L126.967 100.446L126.604 100.244L126.533 100.287L126.425 100.314L126.322 100.3L126.28 100.29L126.238 100.278L126.154 100.247L126.06 100.204L125.692 100.034L125.662 100.035L125.612 100.042L125.215 100.137L125.027 100.304L124.664 100.609L124.326 100.933L124.051 101.289L123.919 101.542L123.9 101.648L123.882 101.658L123.214 102.208L122.693 102.23L122.476 102.273L122.378 102.33L122.378 102.37L122.376 102.632L122.107 103.022L121.997 103.199L121.899 103.29L121.816 103.384L121.685 103.702L121.601 103.764L120.975 103.886L120.772 103.811L120.688 103.748L120.576 103.829L120.292 104.118L119.916 104.543L119.88 104.647L119.836 104.954L119.816 105.032L119.73 105.094L119.591 105.151L119.488 105.166L119.362 105.188L119.232 105.224L119.111 105.272L119.01 105.324L118.913 105.397L118.832 105.489L118.783 105.568L118.728 105.763L118.684 105.834L118.637 105.914L118.595 105.989L118.584 106.065L118.577 106.108L118.502 106.826L118.387 107.693L117.854 107.546L117.434 107.475L116.608 107.392L112.911 106.759L99.1327 105.383L91.057 103.888L84.53 102.699L81.8662 102.257L72.5325 100.721L72.2387 100.671L71.5192 100.621L64.4046 100.108L64.3696 100.302L63.9738 100.276L61.8555 100.19L61.6967 100.187L56.7563 100.084L56.5207 100.091L55.488 100.124L54.4554 100.164L51.3626 100.394L49.3557 100.656L49.1333 100.685L46.7889 101.164L46.6207 101.218L45.4163 101.606L44.2472 102.001L42.6947 102.542L40.7813 103.2L39.7841 103.542Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"#025A4C\"/>\n<path d=\"M39.7841 85.9718L38.5945 86.3606L37.9707 86.5369L37.8699 84.5907L37.8384 84.3989L37.8257 84.2367L37.3113 83.6095L37.1147 83.3495L37.1212 83.294L37.3126 83.2348L37.5318 83.1956L37.5637 83.1887L37.7842 83.1409L37.9982 83.0886L38.0282 83.0252L38.0341 82.9404L37.9982 82.8461L37.9679 82.7961L37.9323 82.7574L37.8687 82.7L37.8443 82.6687L37.8362 82.6152L37.8557 82.5654L37.894 82.5024L37.9604 82.372L37.9656 82.2276L37.9189 82.1333L37.8554 82.024L37.7786 81.9171L37.7511 81.8653L37.6769 81.7673L37.6327 81.697L37.6716 81.6306L37.741 81.5552L37.9202 81.45L38.0024 81.4005L38.1299 81.2347L38.1494 81.1997L38.122 81.1776L38.0365 81.1239L37.904 81.0571L37.8131 81.0108L37.7828 80.9757L37.7746 80.911L37.7857 80.8334L37.7858 80.7965L37.7556 80.7762L37.7087 80.7706L37.524 80.7945L37.4465 80.8016L37.411 80.7777L37.3836 80.7371L37.4028 80.6613L37.4638 80.5321L37.5738 80.394L37.696 79.9879L37.8232 79.7996L37.8566 79.7334L37.8511 79.7038L37.763 79.6519L37.6558 79.554L37.5458 79.3212L37.4559 79.0268L37.416 78.8816L37.3861 78.8392L37.3447 78.8263L37.0604 78.8054L36.9998 78.8054L36.9668 78.7721L36.9503 78.7278L36.9669 78.6835L37.1549 78.5177L37.2521 78.3572L37.2741 78.2724L37.2424 78.1356L37.2065 78.1079L37.135 78.1039L36.8866 78.1147L36.8341 78.1128L36.7983 78.0851L36.7243 77.9758L36.5177 77.7596L36.4048 77.6284L36.3856 77.575L36.3885 77.5251L36.4437 77.4698L36.5242 77.394L36.5436 77.3516L36.5358 77.1504L36.5442 77.0821L36.7408 76.8245L36.9015 76.6363L37.0006 76.5813L37.5859 76.3864L37.6553 76.3549L37.8087 76.1529L38.243 75.7933L38.2873 75.7379L38.3981 75.465L38.4452 75.4114L38.5115 75.382L38.6689 75.3507L39.116 75.2923L39.2954 75.1912L39.5138 75.0787L39.6984 75.0191L39.9495 74.9733L40.5706 74.8357L40.8578 74.7438L40.9214 74.6978L40.9492 74.6092L41.0324 74.4321L41.0628 74.3971L41.1017 74.3785L42.0475 74.1356L42.1969 74.084L42.3126 73.9883L42.6035 73.6433L42.7115 73.4275L42.7392 73.3686L42.729 73.2575L42.7201 73.1651L42.6186 72.8604L42.5693 72.6575L42.5533 72.5937L42.4504 72.1725L42.4245 72.0681L42.3716 71.6763L42.2544 71.0649L42.1503 70.7214L42.0675 70.3727L41.9937 69.9942L41.8707 69.5822L41.8012 69.4241L41.7328 69.2595L41.6869 68.8551L41.6671 68.8001L41.4586 68.3234L41.3707 68.0612L41.3565 67.932L41.3895 67.7587L41.4563 67.6516L41.6027 67.5539L41.6416 67.4764L41.6308 67.3619L41.5812 67.2696L41.4878 67.1181L41.3219 66.7803L41.0774 66.2502L40.9003 65.8566L40.7873 65.6627L40.7398 65.5546L40.6943 65.4519L40.5541 65.173L40.6367 65.1242L40.6614 65.1128L41.9633 64.4595L42.2846 64.2999L43.1473 63.8743L43.1712 63.8599L43.1605 63.8521L42.9033 63.7979L42.646 63.7634L42.5857 63.7414L42.448 63.7061L42.2365 63.6218L42.1415 63.5687L42.0624 63.515L41.8749 63.3706L41.7363 63.2584L41.5849 63.1335L41.4477 63.0271L41.4303 63.0118L41.389 62.9733L41.3557 62.9492L41.3192 62.9223L41.2717 62.8868L41.1429 62.9278L41.0838 62.8422L41.0666 62.8182L41.0003 62.7093L40.9482 62.6183L40.9261 62.5802L40.8996 62.5231L40.8583 62.4471L40.8532 62.4263L40.7815 62.2906L40.7198 62.1854L40.6942 62.142L40.6666 62.0943L40.6591 62.075L40.6022 61.9992L40.5609 61.9352L40.4967 61.8491L40.4458 61.7684L40.3889 61.6939L40.382 61.6786L40.3091 61.5843L40.2221 61.474L40.1711 61.4177L40.1623 61.4077L40.1259 61.3748L40.0373 61.2993L40.0117 61.2642L39.9024 61.1806L39.8235 61.1026L39.7269 61.0163L39.6871 60.9872L39.4469 60.7574L39.3655 60.6717L39.1445 60.6978L39.0596 60.6051L38.9384 60.4807L38.8684 60.4051L38.8515 60.3914L38.7069 60.2442L38.5519 60.0907L38.474 60.008L38.4183 59.9426L38.27 59.7465L38.1767 59.626L38.0653 59.4904L38.0577 59.4817L37.9323 59.2985L37.9058 59.2486L37.8772 59.202L37.8715 59.1916L37.7211 58.9583L37.7174 58.9534L37.6905 58.9145L37.6245 58.8195L37.5733 58.7614L37.4982 58.6406L37.3649 58.4385L37.3547 58.4214L37.2074 58.1748L37.0407 57.7673L36.9788 57.6226L36.947 57.5762L36.8697 57.42L36.7969 57.2722L36.7428 57.1245L36.7331 57.0733L36.7295 57.0262L36.7345 56.9569L36.7656 56.8479L36.8076 56.7754L36.888 56.6393L36.9181 56.5797L37.0394 56.3323L37.1345 56.1834L37.24 56.0684L37.2905 55.9653L37.3399 55.8453L37.3858 55.7325L37.4204 55.6361L37.4302 55.6092L37.4031 55.6042L37.4961 55.2656L37.5776 55.119L37.5869 54.6772L37.5899 54.4426L37.5901 54.4386L37.5904 54.4192L37.5843 54.2667L37.5861 54.2524L37.8586 54.1619L37.8687 54.1586L37.699 54.0328L37.4365 53.829L37.3635 53.7824L36.7119 53.3495L36.4498 53.2062L36.4221 53.1853L36.3213 53.1092L36.232 53.0433L36.1314 52.9691L36.0061 52.8981L35.9636 52.8583L35.901 52.8001L35.7737 52.7146L35.6616 52.6643L35.587 52.6255L35.4971 52.5628L35.2434 52.3763L35.0702 52.2737L34.8985 52.1679L34.7095 52.0386L34.5975 51.9633L34.4646 51.8258L34.3103 51.6584L34.2864 51.6334L34.2473 51.5619L34.1685 51.4631L34.0618 51.3479L34.0363 51.3082L33.803 51.0144L33.6542 50.8138L33.5676 50.7193L33.503 50.6443L33.3546 50.4738L33.2989 50.3905L33.1512 50.2096L32.8592 49.8693L32.8219 49.8192L32.7809 49.7488L32.7556 49.7157L32.6893 49.6486L32.5561 49.4972L32.3767 49.2783L32.2545 49.1236L32.0975 48.9335L32.0669 48.9017L32.0367 48.8605L31.9178 48.6966L31.8435 48.5621L31.8231 48.5145L31.8113 48.2462L31.8093 48.2335L31.7239 47.7948L31.6941 47.5126L31.7043 47.4695L31.771 47.3683L31.9758 47.1311L32.1869 46.8677L32.2776 46.6891L32.4037 46.5134L32.426 46.4008L32.4296 46.3008L32.4059 46.2461L32.2605 46.1211L31.9107 45.9135L31.4969 45.6654L31.2491 45.508L31.0979 45.4362L30.8525 45.269L30.7459 45.2015L30.14 44.8565L29.9618 44.7368L29.7717 44.6068L29.6955 44.5675L29.5497 44.5012L29.4427 44.468L29.3474 44.4589L28.9238 44.377L28.356 44.2744L28.3324 44.2699L28.3741 44.1466L28.397 44.0767L28.4292 43.9876L28.475 43.8598L28.4992 43.7825L28.5343 43.6959L28.5627 43.6178L28.6176 43.4777L28.6473 43.4042L28.5254 43.3706L28.4815 43.3583L28.3513 43.3388L28.2941 43.329L28.3097 43.3126L28.3446 43.233L28.2119 43.1814L28.2263 43.1381L28.2215 43.0985L28.2336 43.0459L28.252 43.001L28.3242 42.8601L28.3362 42.8139L28.3318 42.7716L28.2722 42.7137L28.2337 42.6384L28.2321 42.6349L28.1697 42.5066L28.1446 42.4629L28.125 42.3777L28.1068 42.2963L28.1394 42.2837L28.224 42.3405L28.3519 42.4181L28.4826 42.4588L28.5237 42.4709L28.65 42.4788L28.702 42.4739L28.7631 42.4988L28.8345 42.4926L28.9045 42.508L28.9227 42.5119L28.9969 42.3323L29.0621 42.1783L29.1077 42.0772L29.1691 41.9421L29.1873 41.8989L29.2244 41.8464L29.2583 41.8168L29.2752 41.8233L29.2606 41.835L29.3856 41.8623L29.9171 41.9905L29.8646 42.0869L30.1258 42.148L30.2032 42.1612L30.4882 42.2096L30.6072 42.2264L30.7681 42.2725L30.8408 42.2909L31.142 42.4146L31.1981 42.4392L31.2785 42.4831L31.4183 42.5501L31.7205 42.6804L31.811 42.7114L32.1536 42.8682L32.3485 42.9521L32.4969 43.0046L32.547 43.0234L32.5672 43.031L32.7336 43.0927L32.9343 43.1834L33.1517 43.2776L33.3138 43.3221L33.3302 43.3248L33.3844 43.3416L33.51 43.3771L33.5812 43.3909L33.6523 43.4047L33.8299 43.4572L33.9395 43.4975L33.8294 43.681L33.8608 43.6895L33.8611 43.6891L34.1574 43.7666L34.1884 43.7183L34.2006 43.6889L34.3002 43.5002L34.3179 43.4663L34.327 43.4426L34.3406 43.4118L34.5716 43.4305L34.6717 43.4387L34.7087 43.4415L34.8766 43.4358L35.0008 43.431L35.1523 43.4421L35.2881 43.4726L35.3086 43.4774L35.4229 43.4857L35.4806 43.4899L35.4936 43.4754L35.527 43.4746L35.5557 43.4813L35.5614 43.4917L35.5708 43.4933L35.8584 43.5393L35.8758 43.5265L35.9882 43.5257L36.1262 43.5493L36.1496 43.5096L36.2432 43.5254L36.4909 43.5863L36.5594 43.5859L36.584 43.6453L36.7071 43.6636L36.7845 43.6787L36.8137 43.6833L36.8321 43.6678L36.8843 43.6778L37.3772 43.7753L37.3887 43.7776L37.5768 43.8283L37.7773 43.8825L37.8463 43.9009L37.8587 43.9258L37.8981 44.0029L37.891 44.0268L38.0614 44.1073L38.1499 44.1494L38.2943 44.1785L38.3232 44.1842L38.3462 44.189L38.5158 44.2337L38.519 44.2347L38.5466 44.2532L38.0963 44.8755L37.7773 45.3023L37.2833 45.9829L37.3911 46.0093L37.6229 45.8225L37.6311 45.8238L37.693 45.8243L37.998 45.6085L38.1229 45.6298L38.1394 45.6027L38.1655 45.5595L38.2165 45.5401L38.3066 45.5208L38.4159 45.4745L38.4847 45.4039L38.5057 45.4365L38.5772 45.4511L38.8511 45.4272L38.9385 45.4501L38.9816 45.435L39.0942 45.4057L39.1768 45.3724L39.2172 45.3722L39.3399 45.3586L39.4111 45.3439L39.5512 45.2938L39.6925 45.2368L39.7111 45.223L39.7116 45.2406L39.7164 45.4679L39.7193 45.7076L39.7199 45.73L39.7265 45.9073L39.7568 45.9342L39.9941 46.1311L40.0139 46.1473L40.0658 46.1906L40.3 46.3723L40.3113 46.3817L40.3391 46.4033L40.3603 46.4205L40.4918 46.5255L40.8114 46.7938L40.9824 46.5005L41.0064 46.46L41.3085 45.9533L41.4898 45.9851L41.5299 45.9906L41.5682 46.0008L41.7458 46.0498L41.7628 46.0619L41.8364 46.0844L41.9511 46.1162L42.0248 46.1365L42.0475 46.144L42.1397 46.1732L42.2891 46.2199L42.4031 46.244L42.4758 46.2696L42.5074 46.2801L42.6188 46.3156L42.726 46.3495L42.9147 46.4095L42.7195 46.7693L42.9391 46.8298L42.9752 46.8386L43.1722 46.8863L43.2613 46.9026L43.4115 46.941L43.4269 46.9447L43.6059 46.9881L43.6167 46.9912L43.753 47.0303L43.8393 47.0549L43.8775 47.0639L43.8914 47.0679L44.058 47.1124L44.092 47.1204L44.3537 47.1829L44.384 47.1896L44.6436 47.246L44.6234 47.2991L44.5934 47.3773L44.5732 47.4304L44.5694 47.4404L44.553 47.4896L44.5325 47.5521L44.5447 47.5549L44.5733 47.4824L44.6245 47.4482L44.6571 47.4666L44.6649 47.4682L45.0726 47.5639L45.3707 47.633L45.5518 47.6522L45.5645 47.6548L45.5626 47.6618L45.8367 47.7202L45.8651 47.7226L47.9074 48.194L48.0028 48.1342L48.0297 48.1093L48.0412 48.0974L48.0287 48.0943L48.0297 48.0932L48.0377 48.095L48.0777 48.0403L48.188 47.8873L48.2429 47.8116L48.3008 47.7272L48.3995 47.5897L48.4766 47.4764L48.5695 47.3428L48.6171 47.2776L48.6689 47.21L48.7014 47.1657L48.8558 47.1799L49.3654 47.3209L49.4319 47.3363L49.8677 47.4366L49.9195 47.4267L49.6401 47.7222L49.7562 47.7906L49.7822 47.8063L49.8018 47.8177L49.8417 47.8416L49.9343 47.8984L49.9495 47.9074L49.9922 47.9313L50.041 47.9605L50.0786 47.9857L50.1196 48.0139L50.1315 48.0213L50.2104 48.0713L50.2482 48.0937L50.257 48.0978L50.287 48.112L50.3058 48.1086L50.3641 48.1382L50.4302 48.1754L50.4979 48.2191L50.5395 48.2649L50.5407 48.2657L50.6061 48.3085L50.642 48.3242L50.7416 48.3697L50.7795 48.3886L50.8211 48.4052L50.8511 48.4236L50.8734 48.4373L51.0562 48.5566L52.1333 47.8875L52.1421 47.8911L52.2517 47.9558L52.3237 47.9946L52.479 48.078L52.577 48.1319L52.6874 48.193L52.7578 48.2152L52.7311 48.301L52.8131 48.3108L52.981 48.3312L53.0123 48.3349L53.7772 48.4477L53.7936 48.4521L53.8508 48.4691L53.9177 48.4771L54.0007 48.4906L54.0642 48.501L54.1527 48.5176L54.8813 48.6387L55.0208 48.6573L55.0576 48.6624L55.1681 48.6746L55.281 48.698L55.3855 48.7235L55.5797 48.7461L55.5816 48.7462L55.7192 48.766L55.8382 48.7893L55.9178 48.8046L55.9703 48.8119L56.0922 48.8282L56.2108 48.8429L56.2928 48.8533L56.3725 48.8723L56.4382 48.8872L56.6277 48.9495L56.7348 48.9905L56.9068 49.0518L57.0503 49.1076L57.1133 49.1243L57.1495 49.1343L57.1873 49.1472L57.3392 49.2087L57.3747 49.2225L57.4644 49.2565L57.6342 49.3157L57.7747 49.3589L57.9529 49.4177L58.0682 49.4523L58.1109 49.4655L58.123 49.4766L58.1482 49.4994L58.1514 49.5058L58.1674 49.5368L58.2355 49.6701L58.3594 49.8588L58.3606 49.8608L58.4248 49.8884L58.5354 49.9192L58.6157 49.9475L58.8106 49.9968L58.8883 50.0221L59.1613 50.1137L59.2368 50.1358L59.3072 50.1569L59.3132 50.1586L59.36 50.1734L59.3777 50.1787L59.5228 50.2285L59.6222 50.2619L59.7069 50.2878L59.7994 50.3147L60.241 50.4493L60.3367 50.4778L60.6001 50.5975L60.63 50.5836L60.6832 50.5437L60.7876 50.4511L61.0645 50.534L61.1807 50.565L61.2865 50.589L61.4083 50.619L61.5347 50.6604L61.6008 50.6893L61.6927 50.7355L61.7167 50.7469L61.7839 50.7777L61.9718 50.8682L62.0709 50.9127L62.1346 50.9525L62.1546 50.9635L62.2095 50.9926L62.3328 51.0588L62.3689 51.0777L62.3918 51.0907L62.4238 51.1086L62.4717 51.1324L62.5295 51.1659L62.5391 51.1706L62.6423 51.2297L62.7116 51.2685L62.7816 51.3072L62.8009 51.3184L62.9049 51.3703L62.9628 51.4093L62.9986 51.4184L63.0236 51.3934L63.0858 51.3316L63.1733 51.2283L63.3078 51.0833L63.4187 50.9641L63.435 50.9465L63.4851 50.8931L63.5281 50.847L63.5401 50.8204L63.5659 50.8133L63.6461 50.8273L63.8381 50.8466L63.9075 50.8545L64.0585 50.8689L64.2457 50.8916L64.4234 50.912L64.4439 50.9145L64.599 50.9287L64.7036 50.937L64.9297 50.9661L65.0547 50.9868L65.1817 50.9846L66.1232 50.8638L66.6032 50.8311L67.1629 50.1191L68.1619 49.2433L69.3593 48.2058L69.6107 47.7491L70.161 46.4784L70.7824 45.5992L70.8636 45.4977L70.9019 45.4465L70.9633 45.368L71.3286 45.1242L71.4451 45.0028L71.7601 44.5024L71.8649 44.3148L72.1446 43.7632L72.4341 43.2266L72.6485 42.8475L72.8686 42.4358L73.0082 42.2073L73.0851 42.0992L73.88 42.2113L80.1575 42.7436L80.4309 42.7461L80.4281 42.4766L80.4158 42.2718L80.3931 41.9598L80.3829 41.4918L80.3528 41.1636L80.3146 40.6642L80.2977 40.5498L80.2015 40.2457L80.1042 39.908L80.0428 39.7071L79.9115 39.4401L79.8824 39.3819L79.6926 38.9476L79.7431 38.6967L79.7886 38.5187L79.834 38.2102L79.9487 37.8082L80.0942 37.185L80.1009 36.9828L80.1553 36.6671L80.2618 36.2573L80.3022 36.1121L80.3424 35.7269L80.3785 35.4341L80.3058 35.0141L80.1773 34.6264L79.9809 34.2865L79.9286 34.1929L79.8479 34.1102L79.6664 33.9579L79.4323 33.7852L79.2126 33.6114L79.0096 33.447L78.9332 33.3647L78.8874 33.2112L78.8106 33.0404L78.72 32.9373L78.5502 32.7875L78.4089 32.6837L78.4044 32.6866L78.3984 32.682L78.3486 32.6235L78.3647 32.561L78.4228 32.4273L78.6425 32.0606L78.6589 32.0329L78.9461 31.5323L79.0872 31.2571L79.3232 30.8561L79.3483 30.8092L79.389 30.7746L79.5296 30.6796L79.8 30.5221L79.8138 30.5141L79.9481 30.4422L80.1369 30.6793L80.1262 31.0677L80.1089 31.242L80.1208 31.3012L80.2284 31.4706L80.2446 31.4964L80.6424 31.7314L80.8789 31.7812L81.048 31.8162L81.3849 32.0031L81.5009 32.1204L81.5942 32.4285L81.7058 32.6321L82.3299 33.3975L83.2642 34.7126L84.0295 35.8003L84.1742 36.1543L84.456 36.4109L84.5022 36.4527L84.6868 36.7006L85.0765 37.3973L86.0288 38.7292L86.1179 39.0018L86.5388 40.1168L86.618 40.3476L86.9295 40.7355L87.0062 40.8317L88 41.8061L88.0901 41.894L88.5421 42.281L89.3293 42.0453L90.3994 41.7601L92.4673 41.3287L93.7121 41.0828L94.1737 41.3535L94.4682 41.2986L95.4597 40.9046L96.1433 40.5606L96.3493 40.5017L96.5927 40.6676L96.5326 40.6886L96.7276 40.8118L96.9621 40.9824L97.1189 41.1103L97.1473 41.1223L97.5246 41.275L97.8376 41.3017L97.9354 41.3555L98.3954 41.4946L99.0106 41.368L99.4015 41.344L99.6257 41.339L99.9849 41.3795L100.235 41.3541L100.409 41.3255L100.605 41.3202L101.122 41.3354L101.388 41.3664L101.495 41.3788L101.519 41.3816L101.522 41.3822L101.681 41.4393L101.93 41.5867L102.444 41.7483L102.748 41.8006L102.748 41.8009L103.265 41.8633L103.57 41.9055L103.84 41.9875L104.042 42.0632L104.349 42.1913L104.546 42.2613L104.796 42.3257L105.006 42.3546L105.445 42.3146L105.542 42.3014L106.63 41.8992L106.992 41.901L108.124 42.1943L108.496 42.4312L108.966 42.709L109.617 43.0133L110.129 42.9574L110.449 42.9734L110.717 43.1009L111.179 43.2946L110.847 43.8564L109.958 44.7833L108.707 45.8518L108.101 46.4191L107.762 46.9514L107.561 47.2647L106.891 49.0766L106.873 50.0178L108.496 50.1164L109.498 50.347L109.901 50.4801L110.682 50.7388L111.876 51.4616L112.894 52.24L113.237 52.6286L113.712 53.1644L113.777 53.2419L113.821 53.2976L114.663 54.0207L115.313 54.63L115.35 54.6643L116.075 55.4833L116.174 55.567L116.533 56.2771L116.764 56.8592L116.936 57.843L117.228 58.6683L117.676 59.1928L118.319 59.7322L118.537 59.8201L119.872 60.2994L121.244 60.7049L121.787 60.9528L122.351 61.3517L123.073 61.5439L124.356 61.7643L124.639 61.4398L126.117 61.9057L126.596 62.1174L127.398 62.5146L127.76 62.8994L128.186 63.3869L128.871 64.4207L129.169 65.2136L129.149 66.7529L129.144 66.8082L129.376 67.5793L129.49 67.9122L129.487 67.9324L129.548 68.15L129.936 69.1011L130.298 69.607L130.993 70.478L131.616 71.0456L132.097 71.7216L131.549 71.9844L130.799 72.2809L130.614 72.3767L130.502 72.4099L130.224 72.5025L130.069 72.5769L130.078 72.6183L130.126 72.7663L129.858 72.7524L129.621 72.7613L129.437 72.7883L129.31 72.7967L129.179 72.831L128.825 73.242L128.256 74.3L127.933 74.8461L127.702 74.865L127.793 75.0818L128.329 75.4255L128.424 75.5653L128.499 75.7805L128.554 76.3049L128.54 76.9976L128.562 77.2179L128.613 77.4995L128.688 78.1703L128.762 78.6117L128.881 78.822L129.118 79.0069L129.353 79.1121L129.606 79.5478L129.637 79.9017L129.714 80.0685L129.777 80.2302L128.984 80.3347L128.968 80.4391L128.953 80.5105L128.915 80.8976L128.897 81.1463L128.809 81.4818L128.787 81.7672L128.796 81.8737L128.765 81.9811L128.612 82.2379L128.523 82.3151L128.196 82.4818L128.108 82.5251L127.985 82.5912L127.852 82.6672L127.735 82.7506L127.674 82.8002L127.419 83.0143L127.425 83.0167L127.369 83.0499L126.967 82.8758L126.604 82.674L126.533 82.7164L126.425 82.7436L126.322 82.73L126.28 82.7201L126.238 82.7073L126.154 82.6771L126.06 82.6335L125.692 82.4641L125.662 82.465L125.612 82.472L125.215 82.5663L125.027 82.7338L124.664 83.0384L124.326 83.3625L124.051 83.7191L123.919 83.9721L123.9 84.0774L123.882 84.0875L123.214 84.638L122.693 84.6598L122.476 84.7031L122.378 84.7601L122.378 84.7994L122.376 85.0621L122.107 85.4521L121.997 85.6289L121.899 85.7201L121.816 85.8134L121.685 86.1313L121.601 86.1933L120.975 86.3155L120.772 86.241L120.688 86.1772L120.576 86.2591L120.292 86.5476L119.916 86.9724L119.88 87.0771L119.836 87.3841L119.816 87.4621L119.73 87.5238L119.591 87.581L119.488 87.5957L119.362 87.6175L119.232 87.6539L119.111 87.7022L119.01 87.7541L118.913 87.8265L118.832 87.9189L118.783 87.9977L118.728 88.1925L118.684 88.2641L118.637 88.3438L118.595 88.4187L118.584 88.4949L118.577 88.5377L118.502 89.2553L118.387 90.1225L117.854 89.9755L117.434 89.9049L116.608 89.8219L112.911 89.1889L99.1327 87.8125L91.057 86.3179L84.53 85.1283L81.8662 84.6863L72.5325 83.1506L72.2387 83.1004L71.5192 83.0504L64.4046 82.5373L64.3696 82.7319L63.9738 82.7056L61.8555 82.6199L61.6967 82.6163L56.7563 82.5132L56.5207 82.5205L55.488 82.5539L54.4554 82.5937L51.3626 82.8241L49.3557 83.0855L49.1333 83.1143L46.7889 83.5935L46.6207 83.648L45.4163 84.0354L44.2472 84.4308L42.6947 84.9718L40.7813 85.6297L39.7841 85.9718Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"#027F6B\"/>\n<path d=\"M39.7841 70.9718L38.5945 71.3606L37.9707 71.5369L37.8699 69.5907L37.8384 69.3989L37.8257 69.2367L37.3113 68.6095L37.1147 68.3495L37.1212 68.294L37.3126 68.2348L37.5318 68.1956L37.5637 68.1887L37.7842 68.1409L37.9982 68.0886L38.0282 68.0252L38.0341 67.9404L37.9982 67.8461L37.9679 67.7961L37.9323 67.7574L37.8687 67.7L37.8443 67.6687L37.8362 67.6152L37.8557 67.5654L37.894 67.5024L37.9604 67.372L37.9656 67.2276L37.9189 67.1333L37.8554 67.024L37.7786 66.9171L37.7511 66.8653L37.6769 66.7673L37.6327 66.697L37.6716 66.6306L37.741 66.5552L37.9202 66.45L38.0024 66.4005L38.1299 66.2347L38.1494 66.1997L38.122 66.1776L38.0365 66.1239L37.904 66.0571L37.8131 66.0108L37.7828 65.9757L37.7746 65.911L37.7857 65.8334L37.7858 65.7965L37.7556 65.7762L37.7087 65.7706L37.524 65.7945L37.4465 65.8016L37.411 65.7777L37.3836 65.7371L37.4028 65.6613L37.4638 65.5321L37.5738 65.394L37.696 64.9879L37.8232 64.7996L37.8566 64.7334L37.8511 64.7038L37.763 64.6519L37.6558 64.554L37.5458 64.3212L37.4559 64.0268L37.416 63.8816L37.3861 63.8392L37.3447 63.8263L37.0604 63.8054L36.9998 63.8054L36.9668 63.7721L36.9503 63.7278L36.9669 63.6835L37.1549 63.5177L37.2521 63.3572L37.2741 63.2724L37.2424 63.1356L37.2065 63.1079L37.135 63.1039L36.8866 63.1147L36.8341 63.1128L36.7983 63.0851L36.7243 62.9758L36.5177 62.7596L36.4048 62.6284L36.3856 62.575L36.3885 62.5251L36.4437 62.4698L36.5242 62.394L36.5436 62.3516L36.5358 62.1504L36.5442 62.0821L36.7408 61.8245L36.9015 61.6363L37.0006 61.5813L37.5859 61.3864L37.6553 61.3549L37.8087 61.1529L38.243 60.7933L38.2873 60.7379L38.3981 60.465L38.4452 60.4114L38.5115 60.382L38.6689 60.3507L39.116 60.2923L39.2954 60.1912L39.5138 60.0787L39.6984 60.0191L39.9495 59.9733L40.5706 59.8357L40.8578 59.7438L40.9214 59.6978L40.9492 59.6092L41.0324 59.4321L41.0628 59.3971L41.1017 59.3785L42.0475 59.1356L42.1969 59.084L42.3126 58.9883L42.6035 58.6433L42.7115 58.4275L42.7392 58.3686L42.729 58.2575L42.7201 58.1651L42.6186 57.8604L42.5693 57.6575L42.5533 57.5937L42.4504 57.1725L42.4245 57.0681L42.3716 56.6763L42.2544 56.0649L42.1503 55.7214L42.0675 55.3727L41.9937 54.9942L41.8707 54.5822L41.8012 54.4241L41.7328 54.2595L41.6869 53.8551L41.6671 53.8001L41.4586 53.3234L41.3707 53.0612L41.3565 52.932L41.3895 52.7587L41.4563 52.6516L41.6027 52.5539L41.6416 52.4764L41.6308 52.3619L41.5812 52.2696L41.4878 52.1181L41.3219 51.7803L41.0774 51.2502L40.9003 50.8566L40.7873 50.6627L40.7398 50.5546L40.6943 50.4519L40.5541 50.173L40.6367 50.1242L40.6614 50.1128L41.9633 49.4595L42.2846 49.2999L43.1473 48.8743L43.1712 48.8599L43.1605 48.8521L42.9033 48.7979L42.646 48.7634L42.5857 48.7414L42.448 48.7061L42.2365 48.6218L42.1415 48.5687L42.0624 48.515L41.8749 48.3706L41.7363 48.2584L41.5849 48.1335L41.4477 48.0271L41.4303 48.0118L41.389 47.9733L41.3557 47.9492L41.3192 47.9223L41.2717 47.8868L41.1429 47.9278L41.0838 47.8422L41.0666 47.8182L41.0003 47.7093L40.9482 47.6183L40.9261 47.5802L40.8996 47.5231L40.8583 47.4471L40.8532 47.4263L40.7815 47.2906L40.7198 47.1854L40.6942 47.142L40.6666 47.0943L40.6591 47.075L40.6022 46.9992L40.5609 46.9352L40.4967 46.8491L40.4458 46.7684L40.3889 46.6939L40.382 46.6786L40.3091 46.5843L40.2221 46.474L40.1711 46.4177L40.1623 46.4077L40.1259 46.3748L40.0373 46.2993L40.0117 46.2642L39.9024 46.1806L39.8235 46.1026L39.7269 46.0163L39.6871 45.9872L39.4469 45.7574L39.3655 45.6717L39.1445 45.6978L39.0596 45.6051L38.9384 45.4807L38.8684 45.4051L38.8515 45.3914L38.7069 45.2442L38.5519 45.0907L38.474 45.008L38.4183 44.9426L38.27 44.7465L38.1767 44.626L38.0653 44.4904L38.0577 44.4817L37.9323 44.2985L37.9058 44.2486L37.8772 44.202L37.8715 44.1916L37.7211 43.9583L37.7174 43.9534L37.6905 43.9145L37.6245 43.8195L37.5733 43.7614L37.4982 43.6406L37.3649 43.4385L37.3547 43.4214L37.2074 43.1748L37.0407 42.7673L36.9788 42.6226L36.947 42.5762L36.8697 42.42L36.7969 42.2722L36.7428 42.1245L36.7331 42.0733L36.7295 42.0262L36.7345 41.9569L36.7656 41.8479L36.8076 41.7754L36.888 41.6393L36.9181 41.5797L37.0394 41.3323L37.1345 41.1834L37.24 41.0684L37.2905 40.9653L37.3399 40.8453L37.3858 40.7325L37.4204 40.6361L37.4302 40.6092L37.4031 40.6042L37.4961 40.2656L37.5776 40.119L37.5869 39.6772L37.5899 39.4426L37.5901 39.4386L37.5904 39.4192L37.5843 39.2667L37.5861 39.2524L37.8586 39.1619L37.8687 39.1586L37.699 39.0328L37.4365 38.829L37.3635 38.7824L36.7119 38.3495L36.4498 38.2062L36.4221 38.1853L36.3213 38.1092L36.232 38.0433L36.1314 37.9691L36.0061 37.8981L35.9636 37.8583L35.901 37.8001L35.7737 37.7146L35.6616 37.6643L35.587 37.6255L35.4971 37.5628L35.2434 37.3763L35.0702 37.2737L34.8985 37.1679L34.7095 37.0386L34.5975 36.9633L34.4646 36.8258L34.3103 36.6584L34.2864 36.6334L34.2473 36.5619L34.1685 36.4631L34.0618 36.3479L34.0363 36.3082L33.803 36.0144L33.6542 35.8138L33.5676 35.7193L33.503 35.6443L33.3546 35.4738L33.2989 35.3905L33.1512 35.2096L32.8592 34.8693L32.8219 34.8192L32.7809 34.7488L32.7556 34.7157L32.6893 34.6486L32.5561 34.4972L32.3767 34.2783L32.2545 34.1236L32.0975 33.9335L32.0669 33.9017L32.0367 33.8605L31.9178 33.6966L31.8435 33.5621L31.8231 33.5145L31.8113 33.2462L31.8093 33.2335L31.7239 32.7948L31.6941 32.5126L31.7043 32.4695L31.771 32.3683L31.9758 32.1311L32.1869 31.8677L32.2776 31.6891L32.4037 31.5134L32.426 31.4008L32.4296 31.3008L32.4059 31.2461L32.2605 31.1211L31.9107 30.9135L31.4969 30.6654L31.2491 30.508L31.0979 30.4362L30.8525 30.269L30.7459 30.2015L30.14 29.8565L29.9618 29.7368L29.7717 29.6068L29.6955 29.5675L29.5497 29.5012L29.4427 29.468L29.3474 29.4589L28.9238 29.377L28.356 29.2744L28.3324 29.2699L28.3741 29.1466L28.397 29.0767L28.4292 28.9876L28.475 28.8598L28.4992 28.7825L28.5343 28.6959L28.5627 28.6178L28.6176 28.4777L28.6473 28.4042L28.5254 28.3706L28.4815 28.3583L28.3513 28.3388L28.2941 28.329L28.3097 28.3126L28.3446 28.233L28.2119 28.1814L28.2263 28.1381L28.2215 28.0985L28.2336 28.0459L28.252 28.001L28.3242 27.8601L28.3362 27.8139L28.3318 27.7716L28.2722 27.7137L28.2337 27.6384L28.2321 27.6349L28.1697 27.5066L28.1446 27.4629L28.125 27.3777L28.1068 27.2963L28.1394 27.2837L28.224 27.3405L28.3519 27.4181L28.4826 27.4588L28.5237 27.4709L28.65 27.4788L28.702 27.4739L28.7631 27.4988L28.8345 27.4926L28.9045 27.508L28.9227 27.5119L28.9969 27.3323L29.0621 27.1783L29.1077 27.0772L29.1691 26.9421L29.1873 26.8989L29.2244 26.8464L29.2583 26.8168L29.2752 26.8233L29.2606 26.835L29.3856 26.8623L29.9171 26.9905L29.8646 27.0869L30.1258 27.148L30.2032 27.1612L30.4882 27.2096L30.6072 27.2264L30.7681 27.2725L30.8408 27.2909L31.142 27.4146L31.1981 27.4392L31.2785 27.4831L31.4183 27.5501L31.7205 27.6804L31.811 27.7114L32.1536 27.8682L32.3485 27.9521L32.4969 28.0046L32.547 28.0234L32.5672 28.031L32.7336 28.0927L32.9343 28.1834L33.1517 28.2776L33.3138 28.3221L33.3302 28.3248L33.3844 28.3416L33.51 28.3771L33.5812 28.3909L33.6523 28.4047L33.8299 28.4572L33.9395 28.4975L33.8294 28.681L33.8608 28.6895L33.8611 28.6891L34.1574 28.7666L34.1884 28.7183L34.2006 28.6889L34.3002 28.5002L34.3179 28.4663L34.327 28.4426L34.3406 28.4118L34.5716 28.4305L34.6717 28.4387L34.7087 28.4415L34.8766 28.4358L35.0008 28.431L35.1523 28.4421L35.2881 28.4726L35.3086 28.4774L35.4229 28.4857L35.4806 28.4899L35.4936 28.4754L35.527 28.4746L35.5557 28.4813L35.5614 28.4917L35.5708 28.4933L35.8584 28.5393L35.8758 28.5265L35.9882 28.5257L36.1262 28.5493L36.1496 28.5096L36.2432 28.5254L36.4909 28.5863L36.5594 28.5859L36.584 28.6453L36.7071 28.6636L36.7845 28.6787L36.8137 28.6833L36.8321 28.6678L36.8843 28.6778L37.3772 28.7753L37.3887 28.7776L37.5768 28.8283L37.7773 28.8825L37.8463 28.9009L37.8587 28.9258L37.8981 29.0029L37.891 29.0268L38.0614 29.1073L38.1499 29.1494L38.2943 29.1785L38.3232 29.1842L38.3462 29.189L38.5158 29.2337L38.519 29.2347L38.5466 29.2532L38.0963 29.8755L37.7773 30.3023L37.2833 30.9829L37.3911 31.0093L37.6229 30.8225L37.6311 30.8238L37.693 30.8243L37.998 30.6085L38.1229 30.6298L38.1394 30.6027L38.1655 30.5595L38.2165 30.5401L38.3066 30.5208L38.4159 30.4745L38.4847 30.4039L38.5057 30.4365L38.5772 30.4511L38.8511 30.4272L38.9385 30.4501L38.9816 30.435L39.0942 30.4057L39.1768 30.3724L39.2172 30.3722L39.3399 30.3586L39.4111 30.3439L39.5512 30.2938L39.6925 30.2368L39.7111 30.223L39.7116 30.2406L39.7164 30.4679L39.7193 30.7076L39.7199 30.73L39.7265 30.9073L39.7568 30.9342L39.9941 31.1311L40.0139 31.1473L40.0658 31.1906L40.3 31.3723L40.3113 31.3817L40.3391 31.4033L40.3603 31.4205L40.4918 31.5255L40.8114 31.7938L40.9824 31.5005L41.0064 31.46L41.3085 30.9533L41.4898 30.9851L41.5299 30.9906L41.5682 31.0008L41.7458 31.0498L41.7628 31.0619L41.8364 31.0844L41.9511 31.1162L42.0248 31.1365L42.0475 31.144L42.1397 31.1732L42.2891 31.2199L42.4031 31.244L42.4758 31.2696L42.5074 31.2801L42.6188 31.3156L42.726 31.3495L42.9147 31.4095L42.7195 31.7693L42.9391 31.8298L42.9752 31.8386L43.1722 31.8863L43.2613 31.9026L43.4115 31.941L43.4269 31.9447L43.6059 31.9881L43.6167 31.9912L43.753 32.0303L43.8393 32.0549L43.8775 32.0639L43.8914 32.0679L44.058 32.1124L44.092 32.1204L44.3537 32.1829L44.384 32.1896L44.6436 32.246L44.6234 32.2991L44.5934 32.3773L44.5732 32.4304L44.5694 32.4404L44.553 32.4896L44.5325 32.5521L44.5447 32.5549L44.5733 32.4824L44.6245 32.4482L44.6571 32.4666L44.6649 32.4682L45.0726 32.5639L45.3707 32.633L45.5518 32.6522L45.5645 32.6548L45.5626 32.6618L45.8367 32.7202L45.8651 32.7226L47.9074 33.194L48.0028 33.1342L48.0297 33.1093L48.0412 33.0974L48.0287 33.0943L48.0297 33.0932L48.0377 33.095L48.0777 33.0403L48.188 32.8873L48.2429 32.8116L48.3008 32.7272L48.3995 32.5897L48.4766 32.4764L48.5695 32.3428L48.6171 32.2776L48.6689 32.21L48.7014 32.1657L48.8558 32.1799L49.3654 32.3209L49.4319 32.3363L49.8677 32.4366L49.9195 32.4267L49.6401 32.7222L49.7562 32.7906L49.7822 32.8063L49.8018 32.8177L49.8417 32.8416L49.9343 32.8984L49.9495 32.9074L49.9922 32.9313L50.041 32.9605L50.0786 32.9857L50.1196 33.0139L50.1315 33.0213L50.2104 33.0713L50.2482 33.0937L50.257 33.0978L50.287 33.112L50.3058 33.1086L50.3641 33.1382L50.4302 33.1754L50.4979 33.2191L50.5395 33.2649L50.5407 33.2657L50.6061 33.3085L50.642 33.3242L50.7416 33.3697L50.7795 33.3886L50.8211 33.4052L50.8511 33.4236L50.8734 33.4373L51.0562 33.5566L52.1333 32.8875L52.1421 32.8911L52.2517 32.9558L52.3237 32.9946L52.479 33.078L52.577 33.1319L52.6874 33.193L52.7578 33.2152L52.7311 33.301L52.8131 33.3108L52.981 33.3312L53.0123 33.3349L53.7772 33.4477L53.7936 33.4521L53.8508 33.4691L53.9177 33.4771L54.0007 33.4906L54.0642 33.501L54.1527 33.5176L54.8813 33.6387L55.0208 33.6573L55.0576 33.6624L55.1681 33.6746L55.281 33.698L55.3855 33.7235L55.5797 33.7461L55.5816 33.7462L55.7192 33.766L55.8382 33.7893L55.9178 33.8046L55.9703 33.8119L56.0922 33.8282L56.2108 33.8429L56.2928 33.8533L56.3725 33.8723L56.4382 33.8872L56.6277 33.9495L56.7348 33.9905L56.9068 34.0518L57.0503 34.1076L57.1133 34.1243L57.1495 34.1343L57.1873 34.1472L57.3392 34.2087L57.3747 34.2225L57.4644 34.2565L57.6342 34.3157L57.7747 34.3589L57.9529 34.4177L58.0682 34.4523L58.1109 34.4655L58.123 34.4766L58.1482 34.4994L58.1514 34.5058L58.1674 34.5368L58.2355 34.6701L58.3594 34.8588L58.3606 34.8608L58.4248 34.8884L58.5354 34.9192L58.6157 34.9475L58.8106 34.9968L58.8883 35.0221L59.1613 35.1137L59.2368 35.1358L59.3072 35.1569L59.3132 35.1586L59.36 35.1734L59.3777 35.1787L59.5228 35.2285L59.6222 35.2619L59.7069 35.2878L59.7994 35.3147L60.241 35.4493L60.3367 35.4778L60.6001 35.5975L60.63 35.5836L60.6832 35.5437L60.7876 35.4511L61.0645 35.534L61.1807 35.565L61.2865 35.589L61.4083 35.619L61.5347 35.6604L61.6008 35.6893L61.6927 35.7355L61.7167 35.7469L61.7839 35.7777L61.9718 35.8682L62.0709 35.9127L62.1346 35.9525L62.1546 35.9635L62.2095 35.9926L62.3328 36.0588L62.3689 36.0777L62.3918 36.0907L62.4238 36.1086L62.4717 36.1324L62.5295 36.1659L62.5391 36.1706L62.6423 36.2297L62.7116 36.2685L62.7816 36.3072L62.8009 36.3184L62.9049 36.3703L62.9628 36.4093L62.9986 36.4184L63.0236 36.3934L63.0858 36.3316L63.1733 36.2283L63.3078 36.0833L63.4187 35.9641L63.435 35.9465L63.4851 35.8931L63.5281 35.847L63.5401 35.8204L63.5659 35.8133L63.6461 35.8273L63.8381 35.8466L63.9075 35.8545L64.0585 35.8689L64.2457 35.8916L64.4234 35.912L64.4439 35.9145L64.599 35.9287L64.7036 35.937L64.9297 35.9661L65.0547 35.9868L65.1817 35.9846L66.1232 35.8638L66.6032 35.8311L67.1629 35.1191L68.1619 34.2433L69.3593 33.2058L69.6107 32.7491L70.161 31.4784L70.7824 30.5992L70.8636 30.4977L70.9019 30.4465L70.9633 30.368L71.3286 30.1242L71.4451 30.0028L71.7601 29.5024L71.8649 29.3148L72.1446 28.7632L72.4341 28.2266L72.6485 27.8475L72.8686 27.4358L73.0082 27.2073L73.0851 27.0992L73.88 27.2113L80.1575 27.7436L80.4309 27.7461L80.4281 27.4766L80.4158 27.2718L80.3931 26.9598L80.3829 26.4918L80.3528 26.1636L80.3146 25.6642L80.2977 25.5498L80.2015 25.2457L80.1042 24.908L80.0428 24.7071L79.9115 24.4401L79.8824 24.3819L79.6926 23.9476L79.7431 23.6967L79.7886 23.5187L79.834 23.2102L79.9487 22.8082L80.0942 22.185L80.1009 21.9828L80.1553 21.6671L80.2618 21.2573L80.3022 21.1121L80.3424 20.7269L80.3785 20.4341L80.3058 20.0141L80.1773 19.6264L79.9809 19.2865L79.9286 19.1929L79.8479 19.1102L79.6664 18.9579L79.4323 18.7852L79.2126 18.6114L79.0096 18.447L78.9332 18.3647L78.8874 18.2112L78.8106 18.0404L78.72 17.9373L78.5502 17.7875L78.4089 17.6837L78.4044 17.6866L78.3984 17.682L78.3486 17.6235L78.3647 17.561L78.4228 17.4273L78.6425 17.0606L78.6589 17.0329L78.9461 16.5323L79.0872 16.2571L79.3232 15.8561L79.3483 15.8092L79.389 15.7746L79.5296 15.6796L79.8 15.5221L79.8138 15.5141L79.9481 15.4422L80.1369 15.6793L80.1262 16.0677L80.1089 16.242L80.1208 16.3012L80.2284 16.4706L80.2446 16.4964L80.6424 16.7314L80.8789 16.7812L81.048 16.8162L81.3849 17.0031L81.5009 17.1204L81.5942 17.4285L81.7058 17.6321L82.3299 18.3975L83.2642 19.7126L84.0295 20.8003L84.1742 21.1543L84.456 21.4109L84.5022 21.4527L84.6868 21.7006L85.0765 22.3973L86.0288 23.7292L86.1179 24.0018L86.5388 25.1168L86.618 25.3476L86.9295 25.7355L87.0062 25.8317L88 26.8061L88.0901 26.894L88.5421 27.281L89.3293 27.0453L90.3994 26.7601L92.4673 26.3287L93.7121 26.0828L94.1737 26.3535L94.4682 26.2986L95.4597 25.9046L96.1433 25.5606L96.3493 25.5017L96.5927 25.6676L96.5326 25.6886L96.7276 25.8118L96.9621 25.9824L97.1189 26.1103L97.1473 26.1223L97.5246 26.275L97.8376 26.3017L97.9354 26.3555L98.3954 26.4946L99.0106 26.368L99.4015 26.344L99.6257 26.339L99.9849 26.3795L100.235 26.3541L100.409 26.3255L100.605 26.3202L101.122 26.3354L101.388 26.3664L101.495 26.3788L101.519 26.3816L101.522 26.3822L101.681 26.4393L101.93 26.5867L102.444 26.7483L102.748 26.8006L102.748 26.8009L103.265 26.8633L103.57 26.9055L103.84 26.9875L104.042 27.0632L104.349 27.1913L104.546 27.2613L104.796 27.3257L105.006 27.3546L105.445 27.3146L105.542 27.3014L106.63 26.8992L106.992 26.901L108.124 27.1943L108.496 27.4312L108.966 27.709L109.617 28.0133L110.129 27.9574L110.449 27.9734L110.717 28.1009L111.179 28.2946L110.847 28.8564L109.958 29.7833L108.707 30.8518L108.101 31.4191L107.762 31.9514L107.561 32.2647L106.891 34.0766L106.873 35.0178L108.496 35.1164L109.498 35.347L109.901 35.4801L110.682 35.7388L111.876 36.4616L112.894 37.24L113.237 37.6286L113.712 38.1644L113.777 38.2419L113.821 38.2976L114.663 39.0207L115.313 39.63L115.35 39.6643L116.075 40.4833L116.174 40.567L116.533 41.2771L116.764 41.8592L116.936 42.843L117.228 43.6683L117.676 44.1928L118.319 44.7322L118.537 44.8201L119.872 45.2994L121.244 45.7049L121.787 45.9528L122.351 46.3517L123.073 46.5439L124.356 46.7643L124.639 46.4398L126.117 46.9057L126.596 47.1174L127.398 47.5146L127.76 47.8994L128.186 48.3869L128.871 49.4207L129.169 50.2136L129.149 51.7529L129.144 51.8082L129.376 52.5793L129.49 52.9122L129.487 52.9324L129.548 53.15L129.936 54.1011L130.298 54.607L130.993 55.478L131.616 56.0456L132.097 56.7216L131.549 56.9844L130.799 57.2809L130.614 57.3767L130.502 57.4099L130.224 57.5025L130.069 57.5769L130.078 57.6183L130.126 57.7663L129.858 57.7524L129.621 57.7613L129.437 57.7883L129.31 57.7967L129.179 57.831L128.825 58.242L128.256 59.3L127.933 59.8461L127.702 59.865L127.793 60.0818L128.329 60.4255L128.424 60.5653L128.499 60.7805L128.554 61.3049L128.54 61.9976L128.562 62.2179L128.613 62.4995L128.688 63.1703L128.762 63.6117L128.881 63.822L129.118 64.0069L129.353 64.1121L129.606 64.5478L129.637 64.9017L129.714 65.0685L129.777 65.2302L128.984 65.3347L128.968 65.4391L128.953 65.5105L128.915 65.8976L128.897 66.1463L128.809 66.4818L128.787 66.7672L128.796 66.8737L128.765 66.9811L128.612 67.2379L128.523 67.3151L128.196 67.4818L128.108 67.5251L127.985 67.5912L127.852 67.6672L127.735 67.7506L127.674 67.8002L127.419 68.0143L127.425 68.0167L127.369 68.0499L126.967 67.8758L126.604 67.674L126.533 67.7164L126.425 67.7436L126.322 67.73L126.28 67.7201L126.238 67.7073L126.154 67.6771L126.06 67.6335L125.692 67.4641L125.662 67.465L125.612 67.472L125.215 67.5663L125.027 67.7338L124.664 68.0384L124.326 68.3625L124.051 68.7191L123.919 68.9721L123.9 69.0774L123.882 69.0875L123.214 69.638L122.693 69.6598L122.476 69.7031L122.378 69.7601L122.378 69.7994L122.376 70.0621L122.107 70.4521L121.997 70.6289L121.899 70.7201L121.816 70.8134L121.685 71.1313L121.601 71.1933L120.975 71.3155L120.772 71.241L120.688 71.1772L120.576 71.2591L120.292 71.5476L119.916 71.9724L119.88 72.0771L119.836 72.3841L119.816 72.4621L119.73 72.5238L119.591 72.581L119.488 72.5957L119.362 72.6175L119.232 72.6539L119.111 72.7022L119.01 72.7541L118.913 72.8265L118.832 72.9189L118.783 72.9977L118.728 73.1925L118.684 73.2641L118.637 73.3438L118.595 73.4187L118.584 73.4949L118.577 73.5377L118.502 74.2553L118.387 75.1225L117.854 74.9755L117.434 74.9049L116.608 74.8219L112.911 74.1889L99.1327 72.8125L91.057 71.3179L84.53 70.1283L81.8662 69.6863L72.5325 68.1506L72.2387 68.1004L71.5192 68.0504L64.4046 67.5373L64.3696 67.7319L63.9738 67.7056L61.8555 67.6199L61.6967 67.6163L56.7563 67.5132L56.5207 67.5205L55.488 67.5539L54.4554 67.5937L51.3626 67.8241L49.3557 68.0855L49.1333 68.1143L46.7889 68.5935L46.6207 68.648L45.4163 69.0354L44.2472 69.4308L42.6947 69.9718L40.7813 70.6297L39.7841 70.9718Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"#04B79A\"/>\n</svg>\n";
const gps = "<svg width=\"104\" height=\"104\" viewBox=\"0 0 104 104\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M58 15.0303C73.269 17.883 85.2199 30.162 87.5771 45.5996H104V57.5996H87.4443C84.8034 72.6608 73.0046 84.5667 58 87.3701V104H46V87.6328C30.2393 85.4035 17.6902 73.1923 14.9561 57.5996H0V45.5996H14.8232C17.2623 29.6266 29.9711 17.0348 46 14.7676V0H58V15.0303ZM51.2002 25.5996C37.0618 25.5996 25.6008 37.0609 25.6006 51.1992C25.6006 65.3377 37.0617 76.7998 51.2002 76.7998C65.3386 76.7998 76.7998 65.3377 76.7998 51.1992C76.7996 37.0609 65.3385 25.5997 51.2002 25.5996Z\" fill=\"url(#paint0_linear_36_217)\"/>\n<circle cx=\"51.5\" cy=\"51.5\" r=\"17.5\" fill=\"url(#paint1_linear_36_217)\"/>\n<defs>\n<linearGradient id=\"paint0_linear_36_217\" x1=\"116.5\" y1=\"3\" x2=\"-20\" y2=\"81.5\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#D3FB8C\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n<linearGradient id=\"paint1_linear_36_217\" x1=\"73.2067\" y1=\"35.0096\" x2=\"27.2692\" y2=\"61.4279\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#D3FB8C\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n</defs>\n</svg>\n";
const home = "<svg width=\"93\" height=\"93\" viewBox=\"0 0 93 93\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M39.4396 0.525797C49.5914 -1.01555 59.9678 0.854196 68.9435 5.84123C74.609 8.98901 79.5139 13.2671 83.381 18.3666L86.2746 16.434C89.0615 14.5719 92.7655 16.7573 92.4826 20.0971L90.8527 39.3315C90.636 41.8894 88.0997 43.5847 85.6535 42.8061L67.2599 36.9516C64.066 35.935 63.4634 31.6762 66.2502 29.8139L70.1554 27.2035C67.7074 24.1757 64.689 21.6215 61.2404 19.7055C55.3325 16.423 48.5025 15.1929 41.8205 16.2074C35.1387 17.222 28.9819 20.424 24.3146 25.3119C19.6473 30.2 16.7324 36.4984 16.0275 43.2201C15.3227 49.9417 16.8674 56.7075 20.4191 62.4574C23.9709 68.2075 29.3303 72.6169 35.6564 74.9955C41.9825 77.374 48.9189 77.5875 55.3791 75.602C59.2921 74.3993 62.8968 72.4313 65.9972 69.8393C69.3575 67.0299 74.2572 66.0718 77.8351 68.5981C81.4129 71.1244 82.307 76.1329 79.2092 79.2289C73.8833 84.5516 67.3114 88.5277 60.0383 90.7631C50.2234 93.7796 39.6854 93.4558 30.0744 89.8422C20.4632 86.2285 12.3212 79.5292 6.92498 70.7934C1.52876 62.0575 -0.817756 51.778 0.253103 41.5658C1.32401 31.3538 5.75198 21.7852 12.8429 14.3588C19.934 6.93235 29.2879 2.06715 39.4396 0.525797Z\" fill=\"url(#paint0_linear_101_20)\"/>\n<defs>\n<linearGradient id=\"paint0_linear_101_20\" x1=\"95.4536\" y1=\"-1.40712\" x2=\"36.021\" y2=\"115.33\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#D3FB8C\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n</defs>\n</svg>\n";
const ruler = "<svg width=\"113\" height=\"113\" viewBox=\"0 0 113 113\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M24.4748 112.134C23.6938 112.915 22.4275 112.915 21.6464 112.134L0.585825 91.0737C-0.195224 90.2926 -0.195224 89.0263 0.585824 88.2452L88.245 0.586088C89.026 -0.19496 90.2923 -0.19496 91.0734 0.586089L112.134 21.6467C112.915 22.4277 112.915 23.6941 112.134 24.4751L24.4748 112.134ZM24.8733 88.9855C24.0922 88.2044 22.8259 88.2044 22.0449 88.9855L21.3378 89.6926C20.5567 90.4736 20.5567 91.74 21.3378 92.521L30.3326 101.516C31.1137 102.297 32.38 102.297 33.1611 101.516L33.8682 100.809C34.6492 100.028 34.6492 98.7614 33.8682 97.9804L24.8733 88.9855ZM29.06 74.2502C28.2789 75.0312 28.2789 76.2976 29.06 77.0786L41.9164 89.935C42.6974 90.716 43.9637 90.716 44.7448 89.935L45.4519 89.2279C46.2329 88.4468 46.2329 87.1805 45.4519 86.3994L32.5955 73.5431C31.8145 72.762 30.5481 72.762 29.7671 73.5431L29.06 74.2502ZM44.5024 66.5279C43.7214 67.309 43.7214 68.5753 44.5024 69.3564L53.4973 78.3513C54.2783 79.1323 55.5447 79.1323 56.3257 78.3513L57.0328 77.6442C57.8139 76.8631 57.8139 75.5968 57.0328 74.8157L48.0379 65.8208C47.2569 65.0398 45.9906 65.0398 45.2095 65.8208L44.5024 66.5279ZM52.949 50.3612C52.168 51.1422 52.168 52.4085 52.949 53.1896L65.8054 66.0459C66.5864 66.827 67.8528 66.827 68.6338 66.0459L69.3409 65.3388C70.122 64.5578 70.122 63.2915 69.3409 62.5104L56.4845 49.6541C55.7035 48.873 54.4372 48.873 53.6561 49.6541L52.949 50.3612ZM67.6677 43.3626C66.8867 44.1436 66.8867 45.41 67.6677 46.191L76.6626 55.1859C77.4437 55.967 78.71 55.967 79.4911 55.1859L80.1982 54.4788C80.9792 53.6978 80.9792 52.4314 80.1982 51.6504L71.2033 42.6555C70.4222 41.8744 69.1559 41.8744 68.3749 42.6555L67.6677 43.3626ZM74.707 28.6031C73.926 29.3842 73.926 30.6505 74.707 31.4315L87.5634 44.2879C88.3445 45.069 89.6108 45.069 90.3918 44.2879L91.0989 43.5808C91.88 42.7998 91.88 41.5334 91.0989 40.7524L78.2426 27.896C77.4615 27.115 76.1952 27.115 75.4142 27.896L74.707 28.6031ZM90.8331 20.1986C90.052 20.9797 90.052 22.246 90.8331 23.0271L99.828 32.022C100.609 32.803 101.875 32.803 102.656 32.022L103.364 31.3148C104.145 30.5338 104.145 29.2675 103.364 28.4864L94.3686 19.4915C93.5876 18.7105 92.3212 18.7105 91.5402 19.4915L90.8331 20.1986Z\" fill=\"url(#paint0_linear_49_26)\"/>\n<defs>\n<linearGradient id=\"paint0_linear_49_26\" x1=\"101.604\" y1=\"11.1163\" x2=\"11.1161\" y2=\"101.604\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#D3FB8C\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n</defs>\n</svg>\n";
const basemap = "<svg width=\"112\" height=\"112\" viewBox=\"0 0 112 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M100.38 28.6537L77.0466 14.6538C76.4435 14.2851 75.7639 14.0597 75.06 13.995C74.3562 13.9303 73.6468 14.0279 72.9866 14.2804L37.7533 27.4871L16.38 14.6538C15.6708 14.2236 14.859 13.9923 14.0297 13.9841C13.2004 13.9759 12.3841 14.1911 11.6666 14.6071C10.22 15.4471 9.28662 16.9871 9.28662 18.6671V79.3337C9.28662 80.9671 10.1266 82.5071 11.5733 83.3471L34.9066 97.3471C36.12 98.0938 37.6133 98.2337 38.9666 97.7204L74.2 84.5138L95.6199 97.3471C96.3666 97.8138 97.2066 98.0004 98 98.0004C98.7933 98.0004 99.5866 97.8138 100.287 97.3938C101.733 96.5538 102.667 95.0137 102.667 93.3337V32.6671C102.671 31.8563 102.462 31.0586 102.061 30.3541C101.659 29.6497 101.08 29.0632 100.38 28.6537ZM70 76.0671L42 86.5671V35.8871L70 25.3871V76.0671Z\" fill=\"url(#paint0_linear_37_298)\"/>\n<defs>\n<linearGradient id=\"paint0_linear_37_298\" x1=\"55.9767\" y1=\"13.9756\" x2=\"55.9767\" y2=\"98.0258\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#B6E561\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n</defs>\n</svg>\n";
const thua = "<svg width=\"40\" height=\"23\" viewBox=\"0 0 40 23\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M4.66054 20.9615L4.21569 21.1069L3.98244 21.1728L3.94473 20.445L3.93296 20.3733L3.92823 20.3127L3.73587 20.0781L3.66234 19.9809L3.66477 19.9601L3.73634 19.938L3.81831 19.9233L3.83023 19.9207L3.9127 19.9029L3.99272 19.8833L4.00392 19.8596L4.00614 19.8279L3.99271 19.7926L3.98139 19.7739L3.96807 19.7595L3.9443 19.738L3.93515 19.7263L3.93215 19.7063L3.93943 19.6877L3.95375 19.6641L3.97857 19.6153L3.98054 19.5613L3.96307 19.5261L3.93931 19.4852L3.91061 19.4452L3.90032 19.4259L3.87258 19.3892L3.85603 19.3629L3.87057 19.3381L3.89653 19.3099L3.96354 19.2706L3.99429 19.2521L4.04197 19.1901L4.04924 19.177L4.039 19.1687L4.00705 19.1487L3.95751 19.1237L3.92348 19.1063L3.91216 19.0932L3.9091 19.069L3.91327 19.04L3.91329 19.0262L3.902 19.0186L3.88446 19.0165L3.8154 19.0255L3.78641 19.0281L3.77312 19.0192L3.76287 19.004L3.77007 18.9756L3.79287 18.9273L3.834 18.8757L3.87971 18.7238L3.92729 18.6534L3.93978 18.6287L3.93773 18.6176L3.90477 18.5982L3.86467 18.5616L3.82356 18.4745L3.78993 18.3644L3.77502 18.3101L3.76381 18.2943L3.74835 18.2895L3.64204 18.2817L3.61936 18.2817L3.60703 18.2692L3.60087 18.2526L3.60708 18.236L3.67738 18.1741L3.71373 18.114L3.72194 18.0823L3.7101 18.0312L3.69668 18.0208L3.66993 18.0193L3.57705 18.0234L3.55743 18.0227L3.54401 18.0123L3.51634 17.9714L3.43909 17.8906L3.39689 17.8415L3.38969 17.8215L3.39077 17.8029L3.41141 17.7822L3.44152 17.7539L3.44877 17.738L3.44587 17.6628L3.44899 17.6372L3.5225 17.5409L3.58261 17.4705L3.61966 17.45L3.83855 17.3771L3.86448 17.3653L3.92185 17.2898L4.08424 17.1553L4.10083 17.1346L4.14226 17.0325L4.15989 17.0125L4.18465 17.0015L4.24353 16.9898L4.41071 16.968L4.47781 16.9301L4.55948 16.8881L4.62848 16.8658L4.72239 16.8487L4.95464 16.7972L5.06204 16.7629L5.08583 16.7456L5.09621 16.7125L5.12732 16.6463L5.13869 16.6332L5.15323 16.6263L5.50694 16.5354L5.56279 16.5161L5.60607 16.4803L5.71485 16.3513L5.75523 16.2706L5.76556 16.2486L5.76177 16.207L5.75844 16.1725L5.72047 16.0586L5.70205 15.9827L5.69607 15.9588L5.65759 15.8013L5.64792 15.7623L5.62813 15.6158L5.5843 15.3871L5.54535 15.2587L5.51441 15.1283L5.4868 14.9868L5.44082 14.8327L5.41483 14.7736L5.38923 14.712L5.37208 14.5608L5.36466 14.5402L5.2867 14.362L5.25382 14.2639L5.24853 14.2156L5.26088 14.1508L5.28583 14.1108L5.3406 14.0742L5.35515 14.0453L5.35112 14.0024L5.33257 13.9679L5.29763 13.9113L5.2356 13.7849L5.14415 13.5867L5.07794 13.4395L5.03569 13.367L5.01794 13.3266L5.00091 13.2882L4.94848 13.1839L4.97935 13.1657L4.98861 13.1614L5.47542 12.9171L5.59557 12.8574L5.91819 12.6983L5.92712 12.6929L5.92313 12.69L5.82693 12.6697L5.73074 12.6568L5.70819 12.6486L5.6567 12.6354L5.57761 12.6039L5.54206 12.584L5.51251 12.5639L5.44238 12.5099L5.39055 12.468L5.33393 12.4213L5.28263 12.3815L5.27614 12.3758L5.26068 12.3614L5.24824 12.3523L5.23459 12.3423L5.21682 12.329L5.16864 12.3443L5.14656 12.3123L5.14012 12.3033L5.11531 12.2626L5.09585 12.2286L5.0876 12.2144L5.07769 12.193L5.06222 12.1646L5.06031 12.1568L5.0335 12.1061L5.01044 12.0667L5.00087 12.0505L4.99056 12.0327L4.98775 12.0254L4.96648 11.9971L4.95104 11.9731L4.92701 11.941L4.90798 11.9108L4.88672 11.8829L4.88414 11.8772L4.85688 11.8419L4.82434 11.8007L4.80527 11.7797L4.80198 11.7759L4.78835 11.7636L4.75522 11.7354L4.74567 11.7222L4.70478 11.691L4.67526 11.6618L4.63914 11.6295L4.62429 11.6187L4.53446 11.5327L4.50401 11.5007L4.42135 11.5104L4.38963 11.4758L4.3443 11.4293L4.31811 11.401L4.31181 11.3959L4.25773 11.3408L4.19978 11.2834L4.17065 11.2525L4.14982 11.228L4.09437 11.1547L4.05946 11.1096L4.01781 11.0589L4.01497 11.0557L3.96806 10.9872L3.95817 10.9685L3.94749 10.9511L3.94533 10.9472L3.88909 10.86L3.8877 10.8581L3.87766 10.8436L3.85297 10.8081L3.83384 10.7863L3.80574 10.7412L3.75591 10.6656L3.75207 10.6592L3.69702 10.567L3.63467 10.4146L3.61153 10.3605L3.59962 10.3432L3.57071 10.2847L3.5435 10.2295L3.52327 10.1742L3.51963 10.1551L3.51828 10.1375L3.52017 10.1115L3.53181 10.0708L3.54751 10.0437L3.57758 9.99281L3.58882 9.97051L3.63418 9.87798L3.66973 9.82232L3.70918 9.7793L3.72807 9.74074L3.74654 9.69589L3.76371 9.65372L3.77667 9.61765L3.78031 9.60762L3.77019 9.60572L3.80496 9.47913L3.83544 9.42429L3.83893 9.25909L3.84003 9.17137L3.84012 9.16987L3.84023 9.1626L3.83793 9.10557L3.83861 9.10023L3.9405 9.06641L3.94429 9.06516L3.88085 9.0181L3.78269 8.94192L3.75538 8.92447L3.51171 8.76259L3.41369 8.70901L3.40336 8.70119L3.36566 8.67275L3.33227 8.64809L3.29465 8.62037L3.24778 8.5938L3.23191 8.5789L3.20849 8.55715L3.16088 8.52518L3.11898 8.50639L3.09105 8.49187L3.05745 8.46841L2.96258 8.39868L2.89783 8.36031L2.83359 8.32073L2.76294 8.27239L2.72105 8.24425L2.67135 8.19282L2.61364 8.13022L2.60472 8.12089L2.59009 8.09413L2.56063 8.05719L2.52073 8.01413L2.51119 7.99926L2.42396 7.88942L2.36832 7.8144L2.33594 7.77906L2.31177 7.75102L2.25629 7.68724L2.23546 7.65609L2.18022 7.58847L2.07102 7.46121L2.05707 7.44248L2.04176 7.41616L2.03229 7.40378L2.0075 7.37867L1.9577 7.32204L1.89061 7.24022L1.84491 7.18235L1.78618 7.11126L1.77476 7.09936L1.76345 7.08396L1.719 7.0227L1.69122 6.9724L1.68359 6.95457L1.67917 6.85424L1.67843 6.84951L1.6465 6.68547L1.63534 6.57994L1.63918 6.5638L1.6641 6.52596L1.7407 6.43726L1.81962 6.33877L1.85356 6.27199L1.90068 6.20628L1.90902 6.1642L1.91036 6.12678L1.9015 6.10635L1.84714 6.05958L1.71634 5.98198L1.5616 5.88919L1.46896 5.83031L1.41242 5.80348L1.32063 5.74094L1.28077 5.71572L1.05419 5.58671L0.987547 5.54196L0.91649 5.49334L0.887981 5.47865L0.833463 5.45384L0.793444 5.44144L0.757813 5.43801L0.599425 5.40738L0.387073 5.36903L0.378244 5.36733L0.393856 5.32123L0.402414 5.29512L0.414477 5.26178L0.431604 5.21401L0.440651 5.18511L0.453761 5.1527L0.46437 5.12351L0.484897 5.07112L0.496035 5.04362L0.450444 5.03105L0.434006 5.02647L0.385328 5.01917L0.363933 5.0155L0.369765 5.00939L0.382819 4.97961L0.333199 4.96032L0.338598 4.94412L0.336811 4.92933L0.341335 4.90964L0.348197 4.89286L0.375209 4.84015L0.379679 4.82288L0.378044 4.80707L0.355749 4.78542L0.341346 4.75725L0.340767 4.75597L0.317418 4.70798L0.308034 4.69165L0.30069 4.65976L0.29389 4.62935L0.306105 4.62463L0.337713 4.64586L0.385555 4.67487L0.434417 4.69009L0.449807 4.69463L0.497012 4.6976L0.516473 4.69574L0.539303 4.70506L0.56603 4.70273L0.592212 4.70851L0.598994 4.70995L0.62673 4.6428L0.651123 4.58521L0.668167 4.54742L0.691134 4.49689L0.697931 4.48074L0.711832 4.46111L0.724506 4.45002L0.730806 4.45246L0.725359 4.45683L0.772103 4.46706L0.970836 4.51498L0.951219 4.55104L1.04889 4.57386L1.07785 4.57883L1.18441 4.59693L1.22892 4.6032L1.28908 4.62044L1.31624 4.62732L1.42888 4.67356L1.44988 4.68277L1.47995 4.69918L1.5322 4.72425L1.64521 4.77297L1.67905 4.78455L1.80716 4.84319L1.88007 4.87456L1.93555 4.89422L1.95428 4.90123L1.96185 4.90409L2.02405 4.92715L2.09909 4.96106L2.1804 4.99629L2.24102 5.01294L2.24717 5.01395L2.26743 5.0202L2.3144 5.03348L2.34103 5.03867L2.36759 5.04381L2.43401 5.06346L2.47499 5.07851L2.43383 5.14712L2.44555 5.15031L2.44566 5.15017L2.5565 5.17915L2.56805 5.16107L2.57263 5.15011L2.60987 5.07953L2.6165 5.06684L2.6199 5.05798L2.62497 5.04646L2.71136 5.05346L2.74879 5.05654L2.76262 5.05759L2.82543 5.05543L2.87187 5.05365L2.9285 5.05782L2.97931 5.06922L2.98696 5.07101L3.02969 5.07409L3.05127 5.07566L3.05615 5.07025L3.06862 5.06994L3.07936 5.07247L3.0815 5.07636L3.08501 5.07693L3.19257 5.09414L3.19905 5.08936L3.24108 5.08907L3.29268 5.09789L3.30146 5.08306L3.33644 5.08895L3.42909 5.11174L3.45469 5.11156L3.46389 5.13378L3.50993 5.14065L3.53886 5.14626L3.54976 5.14801L3.55668 5.14218L3.57618 5.14592L3.76051 5.18239L3.7648 5.18327L3.83514 5.20221L3.91012 5.2225L3.93592 5.22935L3.94054 5.23869L3.95528 5.26753L3.95263 5.27645L4.01634 5.30653L4.04943 5.3223L4.10344 5.33318L4.11426 5.33532L4.12286 5.33708L4.18627 5.35383L4.18747 5.35418L4.1978 5.36112L4.02941 5.59382L3.91011 5.75342L3.72539 6.0079L3.76568 6.0178L3.85237 5.94792L3.85543 5.94841L3.87861 5.94861L3.99264 5.8679L4.03934 5.87587L4.04551 5.86575L4.05529 5.8496L4.07435 5.84235L4.10803 5.83511L4.14892 5.81779L4.17463 5.79139L4.1825 5.80359L4.20922 5.80905L4.31167 5.8001L4.34434 5.80868L4.36047 5.80302L4.40256 5.79208L4.43344 5.77963L4.44856 5.77953L4.49445 5.77448L4.52108 5.76897L4.57344 5.75022L4.62629 5.72891L4.63324 5.72376L4.63342 5.73035L4.63524 5.81535L4.63632 5.90497L4.63653 5.91336L4.63901 5.97964L4.65034 5.98969L4.73908 6.06333L4.74647 6.06941L4.7659 6.08557L4.85345 6.15351L4.8577 6.15704L4.86809 6.16513L4.876 6.17156L4.92518 6.21083L5.04467 6.31114L5.10865 6.20149L5.11761 6.18634L5.23059 5.99686L5.29837 6.00874L5.31338 6.0108L5.32769 6.01462L5.39411 6.03294L5.40047 6.03744L5.42798 6.04589L5.47088 6.05777L5.49845 6.06537L5.50691 6.06815L5.5414 6.07906L5.59727 6.09654L5.6399 6.10556L5.66708 6.11513L5.67888 6.11904L5.72055 6.13233L5.76064 6.14499L5.8312 6.16743L5.75821 6.30199L5.84031 6.32461L5.85383 6.32789L5.92751 6.34575L5.96081 6.35185L6.01698 6.36617L6.02273 6.36759L6.08968 6.38381L6.0937 6.38495L6.14468 6.39958L6.17697 6.4088L6.19123 6.41214L6.19645 6.41364L6.25873 6.43029L6.27145 6.43326L6.3693 6.45665L6.38064 6.45914L6.47772 6.48023L6.47017 6.50011L6.45894 6.52934L6.45137 6.54921L6.44997 6.55294L6.44385 6.57134L6.43617 6.59469L6.44072 6.59574L6.45144 6.56864L6.47059 6.55587L6.48278 6.56272L6.48567 6.56333L6.63813 6.59911L6.74962 6.62497L6.81732 6.63212L6.82209 6.6331L6.82137 6.63573L6.92385 6.65755L6.93449 6.65846L7.69821 6.83475L7.73388 6.81237L7.74392 6.80307L7.74824 6.79862L7.74355 6.79747L7.74393 6.79706L7.74693 6.79774L7.76188 6.77725L7.80312 6.72006L7.82365 6.69175L7.84531 6.66017L7.88221 6.60876L7.91104 6.5664L7.94576 6.51642L7.96358 6.49207L7.98296 6.46677L7.99511 6.4502L8.05282 6.45554L8.2434 6.50823L8.26825 6.51401L8.43123 6.55151L8.45059 6.5478L8.34612 6.65833L8.38952 6.68391L8.39925 6.68977L8.40658 6.69403L8.42151 6.70294L8.45615 6.7242L8.46183 6.72757L8.47777 6.7365L8.49605 6.74744L8.51008 6.75686L8.52541 6.76738L8.52987 6.77015L8.5594 6.78887L8.5735 6.79723L8.57681 6.79878L8.58801 6.80408L8.59506 6.8028L8.61684 6.81386L8.64158 6.8278L8.66689 6.84414L8.68243 6.86126L8.6829 6.86157L8.70735 6.87754L8.72077 6.88344L8.75801 6.90043L8.7722 6.90751L8.78773 6.91371L8.79896 6.92059L8.80729 6.92573L8.87567 6.97032L9.27842 6.72014L9.28173 6.72147L9.32273 6.74566L9.34963 6.76016L9.40769 6.79136L9.44434 6.81152L9.48565 6.83437L9.51196 6.84268L9.50198 6.87475L9.53266 6.87842L9.59542 6.88604L9.60712 6.88744L9.89315 6.9296L9.89928 6.93127L9.92068 6.93761L9.9457 6.9406L9.97673 6.94563L10.0005 6.94956L10.0336 6.95573L10.306 7.00103L10.3582 7.008L10.372 7.00989L10.4133 7.01447L10.4555 7.02321L10.4946 7.03275L10.5672 7.0412L10.5679 7.04124L10.6194 7.04862L10.6639 7.05734L10.6936 7.06308L10.7133 7.06579L10.7588 7.07188L10.8032 7.0774L10.8338 7.08127L10.8637 7.08837L10.8882 7.09396L10.9591 7.11726L10.9991 7.13258L11.0634 7.15549L11.1171 7.17638L11.1407 7.18263L11.1542 7.18637L11.1683 7.19119L11.2251 7.21419L11.2384 7.21933L11.272 7.23205L11.3354 7.25418L11.388 7.27033L11.4546 7.29234L11.4977 7.30525L11.5137 7.31019L11.5182 7.31435L11.5276 7.3229L11.5288 7.32526L11.5348 7.33685L11.5603 7.38671L11.6066 7.45726L11.6071 7.45802L11.6311 7.46835L11.6725 7.47986L11.7025 7.49045L11.7754 7.50887L11.8044 7.51836L11.9065 7.55262L11.9347 7.56087L11.9611 7.56877L11.9633 7.56939L11.9808 7.57491L11.9874 7.5769L12.0417 7.59551L12.0789 7.608L12.1105 7.61769L12.1451 7.62777L12.3103 7.67809L12.346 7.68875L12.4445 7.7335L12.4557 7.72831L12.4756 7.71338L12.5146 7.67878L12.6182 7.70978L12.6616 7.72137L12.7012 7.73035L12.7468 7.74155L12.794 7.75704L12.8187 7.76783L12.8531 7.78513L12.8621 7.78937L12.8872 7.8009L12.9575 7.83473L12.9945 7.85136L13.0183 7.86625L13.0258 7.87038L13.0463 7.88127L13.0925 7.90601L13.106 7.91306L13.1145 7.91793L13.1265 7.92464L13.1444 7.93354L13.166 7.94605L13.1696 7.9478L13.2082 7.96994L13.2341 7.98443L13.2603 7.9989L13.2675 8.00307L13.3064 8.0225L13.3281 8.03706L13.3414 8.04046L13.3508 8.03115L13.3741 8.00802L13.4068 7.9694L13.4571 7.91517L13.4985 7.8706L13.5046 7.864L13.5233 7.84405L13.5395 7.82679L13.5439 7.81686L13.5536 7.81422L13.5836 7.81944L13.6554 7.82666L13.6813 7.82961L13.7378 7.83501L13.8078 7.84348L13.8742 7.85112L13.8819 7.85204L13.9399 7.85735L13.979 7.86045L14.0636 7.87133L14.1103 7.87911L14.1578 7.87825L14.5098 7.83309L14.6894 7.82087L14.8987 7.55461L15.2722 7.22712L15.72 6.83915L15.814 6.66836L16.0198 6.1932L16.2521 5.86444L16.2825 5.82647L16.2968 5.80734L16.3198 5.77798L16.4564 5.6868L16.4999 5.64143L16.6177 5.4543L16.6569 5.38414L16.7615 5.17788L16.8698 4.97722L16.9499 4.83544L17.0322 4.68151L17.0845 4.59606L17.1132 4.55565L17.4105 4.59755L19.7579 4.7966L19.8601 4.79753L19.8591 4.69677L19.8545 4.62017L19.846 4.5035L19.8422 4.32851L19.8309 4.20577L19.8166 4.01904L19.8103 3.97624L19.7743 3.86251L19.738 3.73627L19.715 3.66113L19.6659 3.5613L19.655 3.53951L19.584 3.37711L19.6029 3.2833L19.6199 3.21674L19.6369 3.10137L19.6798 2.95104L19.7342 2.71799L19.7367 2.64237L19.757 2.52434L19.7969 2.37108L19.812 2.31682L19.827 2.17276L19.8405 2.06329L19.8133 1.90622L19.7653 1.76122L19.6919 1.63413L19.6723 1.59915L19.6421 1.56819L19.5742 1.51124L19.4867 1.44666L19.4045 1.38167L19.3286 1.32021L19.3001 1.28943L19.2829 1.23203L19.2542 1.16818L19.2203 1.12961L19.1568 1.07361L19.104 1.03476L19.1023 1.03587L19.1001 1.03413L19.0815 1.01228L19.0875 0.988912L19.1092 0.938898L19.1913 0.801785L19.1975 0.791423L19.3049 0.604214L19.3577 0.501311L19.4459 0.351354L19.4553 0.333833L19.4705 0.320875L19.5231 0.285346L19.6242 0.226478L19.6294 0.223483L19.6796 0.196596L19.7502 0.285237L19.7462 0.430484L19.7397 0.495681L19.7441 0.517807L19.7844 0.581159L19.7905 0.590806L19.9392 0.678666L20.0276 0.697299L20.0909 0.710374L20.2169 0.780279L20.2602 0.824118L20.2951 0.939333L20.3368 1.01548L20.5702 1.30169L20.9196 1.79346L21.2058 2.20022L21.2599 2.33258L21.3653 2.42854L21.3826 2.44417L21.4516 2.53688L21.5973 2.79738L21.9534 3.29545L21.9867 3.39737L22.1441 3.81433L22.1737 3.90063L22.2902 4.0457L22.3189 4.08167L22.6905 4.44602L22.7242 4.4789L22.8932 4.62361L23.1876 4.53547L23.5878 4.42881L24.3611 4.26752L24.8265 4.17555L24.9991 4.27677L25.1093 4.25626L25.48 4.10891L25.7356 3.98027L25.8127 3.95826L25.9037 4.02028L25.8812 4.02814L25.9542 4.07423L26.0418 4.13802L26.1005 4.18586L26.1111 4.19033L26.2522 4.24743L26.3692 4.25743L26.4058 4.27752L26.5778 4.32956L26.8079 4.28221L26.954 4.27323L27.0379 4.27137L27.1722 4.28651L27.2658 4.27699L27.3309 4.26631L27.4042 4.26432L27.5974 4.27L27.6967 4.28163L27.7368 4.28626L27.7459 4.28728L27.7469 4.2875L27.8066 4.30886L27.8996 4.36398L28.0917 4.4244L28.2054 4.44396L28.2052 4.44407L28.3989 4.46744L28.5126 4.48321L28.6137 4.51387L28.6893 4.54215L28.8041 4.59009L28.8779 4.61625L28.9712 4.64034L29.0496 4.65115L29.2138 4.63619L29.2502 4.63125L29.6572 4.48084L29.7926 4.48151L30.2156 4.59118L30.3548 4.67977L30.5307 4.78366L30.7741 4.89747L30.9656 4.87655L31.0853 4.88254L31.1855 4.93022L31.358 5.00263L31.2339 5.21272L30.9014 5.55932L30.4338 5.95887L30.2072 6.17102L30.0803 6.37009L30.0053 6.48724L29.7546 7.1648L29.7481 7.51674L30.355 7.55361L30.7295 7.63983L30.8803 7.6896L31.1723 7.78635L31.6188 8.05663L31.9994 8.3477L32.1276 8.49302L32.3055 8.69339L32.3297 8.72237L32.3461 8.7432L32.6608 9.01358L32.9042 9.24144L32.9179 9.25426L33.1891 9.56051L33.2258 9.59184L33.3604 9.85734L33.4467 10.075L33.5111 10.4429L33.6199 10.7515L33.7876 10.9477L34.0282 11.1494L34.1096 11.1822L34.609 11.3615L35.1217 11.5131L35.3248 11.6058L35.5359 11.7549L35.8058 11.8269L36.2854 11.9092L36.3914 11.7879L36.944 11.9621L37.1233 12.0413L37.423 12.1898L37.5586 12.3337L37.7179 12.516L37.974 12.9026L38.0854 13.1991L38.078 13.7747L38.0759 13.7954L38.1629 14.0837L38.2053 14.2082L38.2043 14.2158L38.2272 14.2972L38.3723 14.6528L38.5077 14.842L38.7673 15.1677L39.0004 15.3799L39.1804 15.6327L38.9754 15.731L38.695 15.8419L38.6256 15.8777L38.584 15.8901L38.48 15.9247L38.4219 15.9526L38.4254 15.968L38.4431 16.0234L38.3428 16.0182L38.2545 16.0215L38.1857 16.0316L38.1379 16.0347L38.089 16.0476L37.9569 16.2012L37.7439 16.5969L37.6233 16.8011L37.5366 16.8082L37.5708 16.8892L37.7714 17.0178L37.8067 17.07L37.8347 17.1505L37.8553 17.3466L37.8502 17.6056L37.8584 17.688L37.8775 17.7933L37.9053 18.0442L37.9332 18.2092L37.9776 18.2879L38.0663 18.357L38.154 18.3963L38.2487 18.5593L38.2603 18.6916L38.2891 18.754L38.3128 18.8144L38.0164 18.8535L38.0101 18.8926L38.0044 18.9193L37.9904 19.064L37.9836 19.157L37.9508 19.2825L37.9424 19.3892L37.946 19.429L37.9342 19.4692L37.8771 19.5652L37.8438 19.5941L37.7216 19.6564L37.6887 19.6726L37.6426 19.6973L37.593 19.7257L37.5492 19.7569L37.5264 19.7755L37.431 19.8555L37.4333 19.8564L37.4123 19.8689L37.2619 19.8037L37.1264 19.7283L37.0996 19.7441L37.0593 19.7543L37.0209 19.7492L37.0051 19.7455L36.9893 19.7407L36.9579 19.7294L36.9227 19.7131L36.7853 19.6498L36.7738 19.6501L36.7552 19.6527L36.607 19.688L36.5367 19.7506L36.4008 19.8646L36.2744 19.9857L36.1714 20.1191L36.1221 20.2137L36.1151 20.2531L36.1084 20.2569L35.8586 20.4627L35.6637 20.4708L35.5827 20.4871L35.5461 20.5084L35.5461 20.5231L35.5451 20.6213L35.4447 20.7671L35.4035 20.8333L35.3667 20.8674L35.3357 20.9022L35.2868 21.0211L35.2553 21.0443L35.0211 21.09L34.9455 21.0621L34.914 21.0383L34.872 21.0689L34.7659 21.1768L34.6253 21.3357L34.6119 21.3748L34.5954 21.4896L34.5877 21.5187L34.5557 21.5418L34.5037 21.5632L34.4654 21.5687L34.4182 21.5769L34.3694 21.5905L34.3243 21.6085L34.2865 21.6279L34.2502 21.655L34.2197 21.6896L34.2016 21.719L34.181 21.7919L34.1645 21.8187L34.1471 21.8485L34.1311 21.8765L34.1271 21.905L34.1247 21.921L34.0967 22.1893L34.0534 22.5136L33.8541 22.4586L33.6973 22.4322L33.3884 22.4012L32.0059 22.1645L26.8535 21.6498L23.8337 21.0909L21.393 20.6461L20.3968 20.4808L16.9066 19.9065L16.7967 19.8877L16.5277 19.869L13.8672 19.6772L13.8541 19.7499L13.7061 19.7401L12.914 19.708L12.8546 19.7067L11.0072 19.6681L10.9191 19.6709L10.5329 19.6834L10.1468 19.6983L8.99023 19.7844L8.23976 19.8822L8.1566 19.8929L7.27994 20.0721L7.21705 20.0925L6.76665 20.2374L6.32948 20.3852L5.74893 20.5875L5.03344 20.8336L4.66054 20.9615Z\" fill=\"url(#paint0_linear_2018_359)\" stroke=\"white\" stroke-width=\"0.5\" stroke-miterlimit=\"2.66947\" stroke-linejoin=\"round\"/>\n<defs>\n<linearGradient id=\"paint0_linear_2018_359\" x1=\"2.69416\" y1=\"3.02917\" x2=\"21.336\" y2=\"30.9919\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#D3FB8C\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n</defs>\n</svg>\n";
const qh = "<svg width=\"40\" height=\"23\" viewBox=\"0 0 40 23\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M4.66054 20.9615L4.21569 21.1069L3.98244 21.1728L3.94473 20.445L3.93296 20.3733L3.92823 20.3127L3.73587 20.0781L3.66234 19.9809L3.66477 19.9601L3.73634 19.938L3.81831 19.9233L3.83023 19.9207L3.9127 19.9029L3.99272 19.8833L4.00392 19.8596L4.00614 19.8279L3.99271 19.7926L3.98139 19.7739L3.96807 19.7595L3.9443 19.738L3.93515 19.7263L3.93215 19.7063L3.93943 19.6877L3.95375 19.6641L3.97857 19.6153L3.98054 19.5613L3.96307 19.5261L3.93931 19.4852L3.91061 19.4452L3.90032 19.4259L3.87258 19.3892L3.85603 19.3629L3.87057 19.3381L3.89653 19.3099L3.96354 19.2706L3.99429 19.2521L4.04197 19.1901L4.04924 19.177L4.039 19.1687L4.00705 19.1487L3.95751 19.1237L3.92348 19.1063L3.91216 19.0932L3.9091 19.069L3.91327 19.04L3.91329 19.0262L3.902 19.0186L3.88446 19.0165L3.8154 19.0255L3.78641 19.0281L3.77312 19.0192L3.76287 19.004L3.77007 18.9756L3.79287 18.9273L3.834 18.8757L3.87971 18.7238L3.92729 18.6534L3.93978 18.6287L3.93773 18.6176L3.90477 18.5982L3.86467 18.5616L3.82356 18.4745L3.78993 18.3644L3.77502 18.3101L3.76381 18.2943L3.74835 18.2895L3.64204 18.2817L3.61936 18.2817L3.60703 18.2692L3.60087 18.2526L3.60708 18.236L3.67738 18.1741L3.71373 18.114L3.72194 18.0823L3.7101 18.0312L3.69668 18.0208L3.66993 18.0193L3.57705 18.0234L3.55743 18.0227L3.54401 18.0123L3.51634 17.9714L3.43909 17.8906L3.39689 17.8415L3.38969 17.8215L3.39077 17.8029L3.41141 17.7822L3.44152 17.7539L3.44877 17.738L3.44587 17.6628L3.44899 17.6372L3.5225 17.5409L3.58261 17.4705L3.61966 17.45L3.83855 17.3771L3.86448 17.3653L3.92185 17.2898L4.08424 17.1553L4.10083 17.1346L4.14226 17.0325L4.15989 17.0125L4.18465 17.0015L4.24353 16.9898L4.41071 16.968L4.47781 16.9301L4.55948 16.8881L4.62848 16.8658L4.72239 16.8487L4.95464 16.7972L5.06204 16.7629L5.08583 16.7456L5.09621 16.7125L5.12732 16.6463L5.13869 16.6332L5.15323 16.6263L5.50694 16.5354L5.56279 16.5161L5.60607 16.4803L5.71485 16.3513L5.75523 16.2706L5.76556 16.2486L5.76177 16.207L5.75844 16.1725L5.72047 16.0586L5.70205 15.9827L5.69607 15.9588L5.65759 15.8013L5.64792 15.7623L5.62813 15.6158L5.5843 15.3871L5.54535 15.2587L5.51441 15.1283L5.4868 14.9868L5.44082 14.8327L5.41483 14.7736L5.38923 14.712L5.37208 14.5608L5.36466 14.5402L5.2867 14.362L5.25382 14.2639L5.24853 14.2156L5.26088 14.1508L5.28583 14.1108L5.3406 14.0742L5.35515 14.0453L5.35112 14.0024L5.33257 13.9679L5.29763 13.9113L5.2356 13.7849L5.14415 13.5867L5.07794 13.4395L5.03569 13.367L5.01794 13.3266L5.00091 13.2882L4.94848 13.1839L4.97935 13.1657L4.98861 13.1614L5.47542 12.9171L5.59557 12.8574L5.91819 12.6983L5.92712 12.6929L5.92313 12.69L5.82693 12.6697L5.73074 12.6568L5.70819 12.6486L5.6567 12.6354L5.57761 12.6039L5.54206 12.584L5.51251 12.5639L5.44238 12.5099L5.39055 12.468L5.33393 12.4213L5.28263 12.3815L5.27614 12.3758L5.26068 12.3614L5.24824 12.3523L5.23459 12.3423L5.21682 12.329L5.16864 12.3443L5.14656 12.3123L5.14012 12.3033L5.11531 12.2626L5.09585 12.2286L5.0876 12.2144L5.07769 12.193L5.06222 12.1646L5.06031 12.1568L5.0335 12.1061L5.01044 12.0667L5.00087 12.0505L4.99056 12.0327L4.98775 12.0254L4.96648 11.9971L4.95104 11.9731L4.92701 11.941L4.90798 11.9108L4.88672 11.8829L4.88414 11.8772L4.85688 11.8419L4.82434 11.8007L4.80527 11.7797L4.80198 11.7759L4.78835 11.7636L4.75522 11.7354L4.74567 11.7222L4.70478 11.691L4.67526 11.6618L4.63914 11.6295L4.62429 11.6187L4.53446 11.5327L4.50401 11.5007L4.42135 11.5104L4.38963 11.4758L4.3443 11.4293L4.31811 11.401L4.31181 11.3959L4.25773 11.3408L4.19978 11.2834L4.17065 11.2525L4.14982 11.228L4.09437 11.1547L4.05946 11.1096L4.01781 11.0589L4.01497 11.0557L3.96806 10.9872L3.95817 10.9685L3.94749 10.9511L3.94533 10.9472L3.88909 10.86L3.8877 10.8581L3.87766 10.8436L3.85297 10.8081L3.83384 10.7863L3.80574 10.7412L3.75591 10.6656L3.75207 10.6592L3.69702 10.567L3.63467 10.4146L3.61153 10.3605L3.59962 10.3432L3.57071 10.2847L3.5435 10.2295L3.52327 10.1742L3.51963 10.1551L3.51828 10.1375L3.52017 10.1115L3.53181 10.0708L3.54751 10.0437L3.57758 9.99281L3.58882 9.97051L3.63418 9.87798L3.66973 9.82232L3.70918 9.7793L3.72807 9.74074L3.74654 9.69589L3.76371 9.65372L3.77667 9.61765L3.78031 9.60762L3.77019 9.60572L3.80496 9.47913L3.83544 9.42429L3.83893 9.25909L3.84003 9.17137L3.84012 9.16987L3.84023 9.1626L3.83793 9.10557L3.83861 9.10023L3.9405 9.06641L3.94429 9.06516L3.88085 9.0181L3.78269 8.94192L3.75538 8.92447L3.51171 8.76259L3.41369 8.70901L3.40336 8.70119L3.36566 8.67275L3.33227 8.64809L3.29465 8.62037L3.24778 8.5938L3.23191 8.5789L3.20849 8.55715L3.16088 8.52518L3.11898 8.50639L3.09105 8.49187L3.05745 8.46841L2.96258 8.39868L2.89783 8.36031L2.83359 8.32073L2.76294 8.27239L2.72105 8.24425L2.67135 8.19282L2.61364 8.13022L2.60472 8.12089L2.59009 8.09413L2.56063 8.05719L2.52073 8.01413L2.51119 7.99926L2.42396 7.88942L2.36832 7.8144L2.33594 7.77906L2.31177 7.75102L2.25629 7.68724L2.23546 7.65609L2.18022 7.58847L2.07102 7.46121L2.05707 7.44248L2.04176 7.41616L2.03229 7.40378L2.0075 7.37867L1.9577 7.32204L1.89061 7.24022L1.84491 7.18235L1.78618 7.11126L1.77476 7.09936L1.76345 7.08396L1.719 7.0227L1.69122 6.9724L1.68359 6.95457L1.67917 6.85424L1.67843 6.84951L1.6465 6.68547L1.63534 6.57994L1.63918 6.5638L1.6641 6.52596L1.7407 6.43726L1.81962 6.33877L1.85356 6.27199L1.90068 6.20628L1.90902 6.1642L1.91036 6.12678L1.9015 6.10635L1.84714 6.05958L1.71634 5.98198L1.5616 5.88919L1.46896 5.83031L1.41242 5.80348L1.32063 5.74094L1.28077 5.71572L1.05419 5.58671L0.987547 5.54196L0.91649 5.49334L0.887981 5.47865L0.833463 5.45384L0.793444 5.44144L0.757813 5.43801L0.599425 5.40738L0.387073 5.36903L0.378244 5.36733L0.393856 5.32123L0.402414 5.29512L0.414477 5.26178L0.431604 5.21401L0.440651 5.18511L0.453761 5.1527L0.46437 5.12351L0.484897 5.07112L0.496035 5.04362L0.450444 5.03105L0.434006 5.02647L0.385328 5.01917L0.363933 5.0155L0.369765 5.00939L0.382819 4.97961L0.333199 4.96032L0.338598 4.94412L0.336811 4.92933L0.341335 4.90964L0.348197 4.89286L0.375209 4.84015L0.379679 4.82288L0.378044 4.80707L0.355749 4.78542L0.341346 4.75725L0.340767 4.75597L0.317418 4.70798L0.308034 4.69165L0.30069 4.65976L0.29389 4.62935L0.306105 4.62463L0.337713 4.64586L0.385555 4.67487L0.434417 4.69009L0.449807 4.69463L0.497012 4.6976L0.516473 4.69574L0.539303 4.70506L0.56603 4.70273L0.592212 4.70851L0.598994 4.70995L0.62673 4.6428L0.651123 4.58521L0.668167 4.54742L0.691134 4.49689L0.697931 4.48074L0.711832 4.46111L0.724506 4.45002L0.730806 4.45246L0.725359 4.45683L0.772103 4.46706L0.970836 4.51498L0.951219 4.55104L1.04889 4.57386L1.07785 4.57883L1.18441 4.59693L1.22892 4.6032L1.28908 4.62044L1.31624 4.62732L1.42888 4.67356L1.44988 4.68277L1.47995 4.69918L1.5322 4.72425L1.64521 4.77297L1.67905 4.78455L1.80716 4.84319L1.88007 4.87456L1.93555 4.89422L1.95428 4.90123L1.96185 4.90409L2.02405 4.92715L2.09909 4.96106L2.1804 4.99629L2.24102 5.01294L2.24717 5.01395L2.26743 5.0202L2.3144 5.03348L2.34103 5.03867L2.36759 5.04381L2.43401 5.06346L2.47499 5.07851L2.43383 5.14712L2.44555 5.15031L2.44566 5.15017L2.5565 5.17915L2.56805 5.16107L2.57263 5.15011L2.60987 5.07953L2.6165 5.06684L2.6199 5.05798L2.62497 5.04646L2.71136 5.05346L2.74879 5.05654L2.76262 5.05759L2.82543 5.05543L2.87187 5.05365L2.9285 5.05782L2.97931 5.06922L2.98696 5.07101L3.02969 5.07409L3.05127 5.07566L3.05615 5.07025L3.06862 5.06994L3.07936 5.07247L3.0815 5.07636L3.08501 5.07693L3.19257 5.09414L3.19905 5.08936L3.24108 5.08907L3.29268 5.09789L3.30146 5.08306L3.33644 5.08895L3.42909 5.11174L3.45469 5.11156L3.46389 5.13378L3.50993 5.14065L3.53886 5.14626L3.54976 5.14801L3.55668 5.14218L3.57618 5.14592L3.76051 5.18239L3.7648 5.18327L3.83514 5.20221L3.91012 5.2225L3.93592 5.22935L3.94054 5.23869L3.95528 5.26753L3.95263 5.27645L4.01634 5.30653L4.04943 5.3223L4.10344 5.33318L4.11426 5.33532L4.12286 5.33708L4.18627 5.35383L4.18747 5.35418L4.1978 5.36112L4.02941 5.59382L3.91011 5.75342L3.72539 6.0079L3.76568 6.0178L3.85237 5.94792L3.85543 5.94841L3.87861 5.94861L3.99264 5.8679L4.03934 5.87587L4.04551 5.86575L4.05529 5.8496L4.07435 5.84235L4.10803 5.83511L4.14892 5.81779L4.17463 5.79139L4.1825 5.80359L4.20922 5.80905L4.31167 5.8001L4.34434 5.80868L4.36047 5.80302L4.40256 5.79208L4.43344 5.77963L4.44856 5.77953L4.49445 5.77448L4.52108 5.76897L4.57344 5.75022L4.62629 5.72891L4.63324 5.72376L4.63342 5.73035L4.63524 5.81535L4.63632 5.90497L4.63653 5.91336L4.63901 5.97964L4.65034 5.98969L4.73908 6.06333L4.74647 6.06941L4.7659 6.08557L4.85345 6.15351L4.8577 6.15704L4.86809 6.16513L4.876 6.17156L4.92518 6.21083L5.04467 6.31114L5.10865 6.20149L5.11761 6.18634L5.23059 5.99686L5.29837 6.00874L5.31338 6.0108L5.32769 6.01462L5.39411 6.03294L5.40047 6.03744L5.42798 6.04589L5.47088 6.05777L5.49845 6.06537L5.50691 6.06815L5.5414 6.07906L5.59727 6.09654L5.6399 6.10556L5.66708 6.11513L5.67888 6.11904L5.72055 6.13233L5.76064 6.14499L5.8312 6.16743L5.75821 6.30199L5.84031 6.32461L5.85383 6.32789L5.92751 6.34575L5.96081 6.35185L6.01698 6.36617L6.02273 6.36759L6.08968 6.38381L6.0937 6.38495L6.14468 6.39958L6.17697 6.4088L6.19123 6.41214L6.19645 6.41364L6.25873 6.43029L6.27145 6.43326L6.3693 6.45665L6.38064 6.45914L6.47772 6.48023L6.47017 6.50011L6.45894 6.52934L6.45137 6.54921L6.44997 6.55294L6.44385 6.57134L6.43617 6.59469L6.44072 6.59574L6.45144 6.56864L6.47059 6.55587L6.48278 6.56272L6.48567 6.56333L6.63813 6.59911L6.74962 6.62497L6.81732 6.63212L6.82209 6.6331L6.82137 6.63573L6.92385 6.65755L6.93449 6.65846L7.69821 6.83475L7.73388 6.81237L7.74392 6.80307L7.74824 6.79862L7.74355 6.79747L7.74393 6.79706L7.74693 6.79774L7.76188 6.77725L7.80312 6.72006L7.82365 6.69175L7.84531 6.66017L7.88221 6.60876L7.91104 6.5664L7.94576 6.51642L7.96358 6.49207L7.98296 6.46677L7.99511 6.4502L8.05282 6.45554L8.2434 6.50823L8.26825 6.51401L8.43123 6.55151L8.45059 6.5478L8.34612 6.65833L8.38952 6.68391L8.39925 6.68977L8.40658 6.69403L8.42151 6.70294L8.45615 6.7242L8.46183 6.72757L8.47777 6.7365L8.49605 6.74744L8.51008 6.75686L8.52541 6.76738L8.52987 6.77015L8.5594 6.78887L8.5735 6.79723L8.57681 6.79878L8.58801 6.80408L8.59506 6.8028L8.61684 6.81386L8.64158 6.8278L8.66689 6.84414L8.68243 6.86126L8.6829 6.86157L8.70735 6.87754L8.72077 6.88344L8.75801 6.90043L8.7722 6.90751L8.78773 6.91371L8.79896 6.92059L8.80729 6.92573L8.87567 6.97032L9.27842 6.72014L9.28173 6.72147L9.32273 6.74566L9.34963 6.76016L9.40769 6.79136L9.44434 6.81152L9.48565 6.83437L9.51196 6.84268L9.50198 6.87475L9.53266 6.87842L9.59542 6.88604L9.60712 6.88744L9.89315 6.9296L9.89928 6.93127L9.92068 6.93761L9.9457 6.9406L9.97673 6.94563L10.0005 6.94956L10.0336 6.95573L10.306 7.00103L10.3582 7.008L10.372 7.00989L10.4133 7.01447L10.4555 7.02321L10.4946 7.03275L10.5672 7.0412L10.5679 7.04124L10.6194 7.04862L10.6639 7.05734L10.6936 7.06308L10.7133 7.06579L10.7588 7.07188L10.8032 7.0774L10.8338 7.08127L10.8637 7.08837L10.8882 7.09396L10.9591 7.11726L10.9991 7.13258L11.0634 7.15549L11.1171 7.17638L11.1407 7.18263L11.1542 7.18637L11.1683 7.19119L11.2251 7.21419L11.2384 7.21933L11.272 7.23205L11.3354 7.25418L11.388 7.27033L11.4546 7.29234L11.4977 7.30525L11.5137 7.31019L11.5182 7.31435L11.5276 7.3229L11.5288 7.32526L11.5348 7.33685L11.5603 7.38671L11.6066 7.45726L11.6071 7.45802L11.6311 7.46835L11.6725 7.47986L11.7025 7.49045L11.7754 7.50887L11.8044 7.51836L11.9065 7.55262L11.9347 7.56087L11.9611 7.56877L11.9633 7.56939L11.9808 7.57491L11.9874 7.5769L12.0417 7.59551L12.0789 7.608L12.1105 7.61769L12.1451 7.62777L12.3103 7.67809L12.346 7.68875L12.4445 7.7335L12.4557 7.72831L12.4756 7.71338L12.5146 7.67878L12.6182 7.70978L12.6616 7.72137L12.7012 7.73035L12.7468 7.74155L12.794 7.75704L12.8187 7.76783L12.8531 7.78513L12.8621 7.78937L12.8872 7.8009L12.9575 7.83473L12.9945 7.85136L13.0183 7.86625L13.0258 7.87038L13.0463 7.88127L13.0925 7.90601L13.106 7.91306L13.1145 7.91793L13.1265 7.92464L13.1444 7.93354L13.166 7.94605L13.1696 7.9478L13.2082 7.96994L13.2341 7.98443L13.2603 7.9989L13.2675 8.00307L13.3064 8.0225L13.3281 8.03706L13.3414 8.04046L13.3508 8.03115L13.3741 8.00802L13.4068 7.9694L13.4571 7.91517L13.4985 7.8706L13.5046 7.864L13.5233 7.84405L13.5395 7.82679L13.5439 7.81686L13.5536 7.81422L13.5836 7.81944L13.6554 7.82666L13.6813 7.82961L13.7378 7.83501L13.8078 7.84348L13.8742 7.85112L13.8819 7.85204L13.9399 7.85735L13.979 7.86045L14.0636 7.87133L14.1103 7.87911L14.1578 7.87825L14.5098 7.83309L14.6894 7.82087L14.8987 7.55461L15.2722 7.22712L15.72 6.83915L15.814 6.66836L16.0198 6.1932L16.2521 5.86444L16.2825 5.82647L16.2968 5.80734L16.3198 5.77798L16.4564 5.6868L16.4999 5.64143L16.6177 5.4543L16.6569 5.38414L16.7615 5.17788L16.8698 4.97722L16.9499 4.83544L17.0322 4.68151L17.0845 4.59606L17.1132 4.55565L17.4105 4.59755L19.7579 4.7966L19.8601 4.79753L19.8591 4.69677L19.8545 4.62017L19.846 4.5035L19.8422 4.32851L19.8309 4.20577L19.8166 4.01904L19.8103 3.97624L19.7743 3.86251L19.738 3.73627L19.715 3.66113L19.6659 3.5613L19.655 3.53951L19.584 3.37711L19.6029 3.2833L19.6199 3.21674L19.6369 3.10137L19.6798 2.95104L19.7342 2.71799L19.7367 2.64237L19.757 2.52434L19.7969 2.37108L19.812 2.31682L19.827 2.17276L19.8405 2.06329L19.8133 1.90622L19.7653 1.76122L19.6919 1.63413L19.6723 1.59915L19.6421 1.56819L19.5742 1.51124L19.4867 1.44666L19.4045 1.38167L19.3286 1.32021L19.3001 1.28943L19.2829 1.23203L19.2542 1.16818L19.2203 1.12961L19.1568 1.07361L19.104 1.03476L19.1023 1.03587L19.1001 1.03413L19.0815 1.01228L19.0875 0.988912L19.1092 0.938898L19.1913 0.801785L19.1975 0.791423L19.3049 0.604214L19.3577 0.501311L19.4459 0.351354L19.4553 0.333833L19.4705 0.320875L19.5231 0.285346L19.6242 0.226478L19.6294 0.223483L19.6796 0.196596L19.7502 0.285237L19.7462 0.430484L19.7397 0.495681L19.7441 0.517807L19.7844 0.581159L19.7905 0.590806L19.9392 0.678666L20.0276 0.697299L20.0909 0.710374L20.2169 0.780279L20.2602 0.824118L20.2951 0.939333L20.3368 1.01548L20.5702 1.30169L20.9196 1.79346L21.2058 2.20022L21.2599 2.33258L21.3653 2.42854L21.3826 2.44417L21.4516 2.53688L21.5973 2.79738L21.9534 3.29545L21.9867 3.39737L22.1441 3.81433L22.1737 3.90063L22.2902 4.0457L22.3189 4.08167L22.6905 4.44602L22.7242 4.4789L22.8932 4.62361L23.1876 4.53547L23.5878 4.42881L24.3611 4.26752L24.8265 4.17555L24.9991 4.27677L25.1093 4.25626L25.48 4.10891L25.7356 3.98027L25.8127 3.95826L25.9037 4.02028L25.8812 4.02814L25.9542 4.07423L26.0418 4.13802L26.1005 4.18586L26.1111 4.19033L26.2522 4.24743L26.3692 4.25743L26.4058 4.27752L26.5778 4.32956L26.8079 4.28221L26.954 4.27323L27.0379 4.27137L27.1722 4.28651L27.2658 4.27699L27.3309 4.26631L27.4042 4.26432L27.5974 4.27L27.6967 4.28163L27.7368 4.28626L27.7459 4.28728L27.7469 4.2875L27.8066 4.30886L27.8996 4.36398L28.0917 4.4244L28.2054 4.44396L28.2052 4.44407L28.3989 4.46744L28.5126 4.48321L28.6137 4.51387L28.6893 4.54215L28.8041 4.59009L28.8779 4.61625L28.9712 4.64034L29.0496 4.65115L29.2138 4.63619L29.2502 4.63125L29.6572 4.48084L29.7926 4.48151L30.2156 4.59118L30.3548 4.67977L30.5307 4.78366L30.7741 4.89747L30.9656 4.87655L31.0853 4.88254L31.1855 4.93022L31.358 5.00263L31.2339 5.21272L30.9014 5.55932L30.4338 5.95887L30.2072 6.17102L30.0803 6.37009L30.0053 6.48724L29.7546 7.1648L29.7481 7.51674L30.355 7.55361L30.7295 7.63983L30.8803 7.6896L31.1723 7.78635L31.6188 8.05663L31.9994 8.3477L32.1276 8.49302L32.3055 8.69339L32.3297 8.72237L32.3461 8.7432L32.6608 9.01358L32.9042 9.24144L32.9179 9.25426L33.1891 9.56051L33.2258 9.59184L33.3604 9.85734L33.4467 10.075L33.5111 10.4429L33.6199 10.7515L33.7876 10.9477L34.0282 11.1494L34.1096 11.1822L34.609 11.3615L35.1217 11.5131L35.3248 11.6058L35.5359 11.7549L35.8058 11.8269L36.2854 11.9092L36.3914 11.7879L36.944 11.9621L37.1233 12.0413L37.423 12.1898L37.5586 12.3337L37.7179 12.516L37.974 12.9026L38.0854 13.1991L38.078 13.7747L38.0759 13.7954L38.1629 14.0837L38.2053 14.2082L38.2043 14.2158L38.2272 14.2972L38.3723 14.6528L38.5077 14.842L38.7673 15.1677L39.0004 15.3799L39.1804 15.6327L38.9754 15.731L38.695 15.8419L38.6256 15.8777L38.584 15.8901L38.48 15.9247L38.4219 15.9526L38.4254 15.968L38.4431 16.0234L38.3428 16.0182L38.2545 16.0215L38.1857 16.0316L38.1379 16.0347L38.089 16.0476L37.9569 16.2012L37.7439 16.5969L37.6233 16.8011L37.5366 16.8082L37.5708 16.8892L37.7714 17.0178L37.8067 17.07L37.8347 17.1505L37.8553 17.3466L37.8502 17.6056L37.8584 17.688L37.8775 17.7933L37.9053 18.0442L37.9332 18.2092L37.9776 18.2879L38.0663 18.357L38.154 18.3963L38.2487 18.5593L38.2603 18.6916L38.2891 18.754L38.3128 18.8144L38.0164 18.8535L38.0101 18.8926L38.0044 18.9193L37.9904 19.064L37.9836 19.157L37.9508 19.2825L37.9424 19.3892L37.946 19.429L37.9342 19.4692L37.8771 19.5652L37.8438 19.5941L37.7216 19.6564L37.6887 19.6726L37.6426 19.6973L37.593 19.7257L37.5492 19.7569L37.5264 19.7755L37.431 19.8555L37.4333 19.8564L37.4123 19.8689L37.2619 19.8037L37.1264 19.7283L37.0996 19.7441L37.0593 19.7543L37.0209 19.7492L37.0051 19.7455L36.9893 19.7407L36.9579 19.7294L36.9227 19.7131L36.7853 19.6498L36.7738 19.6501L36.7552 19.6527L36.607 19.688L36.5367 19.7506L36.4008 19.8646L36.2744 19.9857L36.1714 20.1191L36.1221 20.2137L36.1151 20.2531L36.1084 20.2569L35.8586 20.4627L35.6637 20.4708L35.5827 20.4871L35.5461 20.5084L35.5461 20.5231L35.5451 20.6213L35.4447 20.7671L35.4035 20.8333L35.3667 20.8674L35.3357 20.9022L35.2868 21.0211L35.2553 21.0443L35.0211 21.09L34.9455 21.0621L34.914 21.0383L34.872 21.0689L34.7659 21.1768L34.6253 21.3357L34.6119 21.3748L34.5954 21.4896L34.5877 21.5187L34.5557 21.5418L34.5037 21.5632L34.4654 21.5687L34.4182 21.5769L34.3694 21.5905L34.3243 21.6085L34.2865 21.6279L34.2502 21.655L34.2197 21.6896L34.2016 21.719L34.181 21.7919L34.1645 21.8187L34.1471 21.8485L34.1311 21.8765L34.1271 21.905L34.1247 21.921L34.0967 22.1893L34.0534 22.5136L33.8541 22.4586L33.6973 22.4322L33.3884 22.4012L32.0059 22.1645L26.8535 21.6498L23.8337 21.0909L21.393 20.6461L20.3968 20.4808L16.9066 19.9065L16.7967 19.8877L16.5277 19.869L13.8672 19.6772L13.8541 19.7499L13.7061 19.7401L12.914 19.708L12.8546 19.7067L11.0072 19.6681L10.9191 19.6709L10.5329 19.6834L10.1468 19.6983L8.99023 19.7844L8.23976 19.8822L8.1566 19.8929L7.27994 20.0721L7.21705 20.0925L6.76665 20.2374L6.32948 20.3852L5.74893 20.5875L5.03344 20.8336L4.66054 20.9615Z\" fill=\"url(#paint0_linear_2018_360)\" stroke=\"#FF0000\" stroke-width=\"0.5\" stroke-miterlimit=\"2.66947\" stroke-linejoin=\"round\"/>\n<defs>\n<linearGradient id=\"paint0_linear_2018_360\" x1=\"2.69416\" y1=\"3.02917\" x2=\"21.336\" y2=\"30.9919\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#D3FB8C\"/>\n<stop offset=\"1\" stop-color=\"#99C54A\"/>\n</linearGradient>\n</defs>\n</svg>\n";
const copy = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M11.547 1.15479H5.77351C5.13578 1.15479 4.6188 1.67176 4.6188 2.30949V8.08299C4.6188 8.72071 5.13578 9.23769 5.77351 9.23769H11.547C12.1847 9.23769 12.7017 8.72071 12.7017 8.08299V2.30949C12.7017 1.67176 12.1847 1.15479 11.547 1.15479Z\" fill=\"url(#paint0_linear_2018_338)\"/>\n<path d=\"M4.90748 10.3924C4.52467 10.3924 4.15754 10.2403 3.88686 9.96964C3.61617 9.69896 3.4641 9.33183 3.4641 8.94902V4.6189H2.3094C1.67432 4.6189 1.1547 5.13851 1.1547 5.7736V11.5471C1.1547 12.1822 1.67432 12.7018 2.3094 12.7018H8.0829C8.71799 12.7018 9.2376 12.1822 9.2376 11.5471V10.3924H4.90748Z\" fill=\"url(#paint1_linear_2018_338)\"/>\n<defs>\n<linearGradient id=\"paint0_linear_2018_338\" x1=\"8.66026\" y1=\"1.15479\" x2=\"8.66026\" y2=\"9.23769\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#99C54A\"/>\n<stop offset=\"1\" stop-color=\"#D3FB8C\"/>\n</linearGradient>\n<linearGradient id=\"paint1_linear_2018_338\" x1=\"5.19615\" y1=\"4.6189\" x2=\"5.19615\" y2=\"12.7018\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#99C54A\"/>\n<stop offset=\"1\" stop-color=\"#D3FB8C\"/>\n</linearGradient>\n</defs>\n</svg>\n";

const SRC = { layer, gps, home, ruler, basemap, thua, qh, copy };
const cache = new Map();

function recolor(txt) {
  return txt
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    .replace(/fill="url\(#[^)]*\)"/g, 'fill="currentColor"')
    .replace(/fill="#D3FB8C"/gi, 'fill="currentColor" fill-opacity=".45"')
    .replace(/fill="#B6E561"/gi, 'fill="currentColor" fill-opacity=".72"')
    .replace(/fill="#99C54A"/gi, 'fill="currentColor"')
    .replace(/stroke="white"/gi, 'stroke="#fbf4e4"')
    .replace(/stroke="#FF0000"/gi, 'stroke="#922b32"')
    .replace(/<svg ([^>]*?)width="\d+" height="\d+"/, '<svg $1');
}
/** Trả về phần tử <svg> mới (đổi màu theo màu chữ hiện tại). */
function oldIcon(name, size = 22) {
  let doc = cache.get(name);
  if (!doc) { doc = new DOMParser().parseFromString(recolor(SRC[name]), 'image/svg+xml').documentElement; cache.set(name, doc); }
  const el = document.importNode(doc, true);
  el.setAttribute('width', size); el.setAttribute('height', size); el.setAttribute('aria-hidden', 'true'); el.setAttribute('focusable', 'false');
  return el;
}

__e["oldIcon"] = oldIcon;
};
__m("/home/claude/w/webgis-thanh-phuoc-fixed(6)/dev/src/js/map-app.js");
})();
