// util.js — tiện ích dùng chung. Không dùng innerHTML: mọi nội dung đi qua textContent.

export const CFG = window.WEBGIS_CONFIG;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Dựng phần tử DOM an toàn: h('div', {class:'x', onclick:fn}, 'text', child…) */
export function h(tag, attrs, ...kids) {
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
export const fmt0 = (n) => nf0.format(n);
export const fmt1 = (n) => nf1.format(n);
export const fmt2 = (n) => nf2.format(n);
export const fmtArea = (m2) => (m2 == null ? '—' : `${m2 >= 1e4 ? fmt2(m2) : fmt1(m2)} m²`);

/** Bỏ dấu tiếng Việt, hạ chữ thường — dùng cho tìm kiếm. */
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

/** Làm sạch ô nhập: giới hạn độ dài, chỉ giữ chữ, số, khoảng trắng và vài dấu câu. */
export function cleanText(s, max = 60) {
  return String(s ?? '').normalize('NFC').replace(/[^\p{L}\p{N}\s.,\-/]/gu, '').replace(/\s+/g, ' ').slice(0, max);
}
/** Số nguyên dương hoặc null. */
export function posInt(s, maxDigits = 6) {
  const t = String(s ?? '').trim();
  if (!/^\d+$/.test(t) || t.length > maxDigits) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** Che một phần tên người; giữ nguyên tên tổ chức. Idempotent (chạy lại không đổi). */
const ORG = /^(ủy ban|uỷ ban|ubnd|ban |công ty|cty|hợp tác xã|htx|trường|trạm|nhà thờ|chùa|đình|miếu|tổng công ty|doanh nghiệp|bộ |sở |chi nhánh|xí nghiệp|tập đoàn|đảng|đoàn|hội|nhà máy|trung tâm|bệnh viện|quân|công an|nhà nước|tòa|toà|viện|điện lực)/i;
export function maskOwner(name) {
  if (!name || ORG.test(name)) return name;
  return name.split(' ').map((w, i) => (i === 0 || w.includes('*') ? w : `${w[0]}***`)).join(' ');
}

/* localStorage chỉ cho thiết lập giao diện — luôn bọc try/catch. */
export const store = {
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
export async function imageSrc(name, url) { if (!OFFLINE) return url; const d = await offline(); return d.img[name] || url; }

export async function loadPack(name) {
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
export const loadJSON = async (name) => {
  if (OFFLINE) { const d = (await offline()).json[name]; if (!d) throw new Error('data'); return d; }
  return fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error('data'); return r.json(); });
};

/** Toạ độ mét (Web Mercator) tương đối gốc -> lon/lat. */
const R = 6378137;
export function relToLonLat(meta, x, y) {
  const X = meta.origin.mx + x, Y = meta.origin.my + y;
  return { lon: (X / R) * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(Y / R)) - Math.PI / 2) * 180 / Math.PI };
}
export function lonLatToRel(meta, lon, lat) {
  const X = (lon * Math.PI / 180) * R;
  const Y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R;
  return { x: X - meta.origin.mx, y: Y - meta.origin.my };
}

export function el$(sel, root = document) { return root.querySelector(sel); }
export function all$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/** Thông báo ngắn. */
export function toast(msg, ms = 3200) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

/** Lỗi chung cho người dùng — không lộ đường dẫn nội bộ. */
export function fail(msg = 'Không tải được dữ liệu. Vui lòng thử lại sau.') {
  toast(msg, 6000);
}

/* ---------- bảng màu GỐC theo mã loại đất / mã quy hoạch (config.js) ---------- */
export const colTD = (ma) => (CFG.MAU_THUA && CFG.MAU_THUA[ma]) || CFG.MAU_THUA_MAC_DINH;
export const colQH = (ma) => (CFG.MAU_QH && CFG.MAU_QH[ma]) || CFG.MAU_QH_MAC_DINH;
export const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Ô nhiễu hạt giấy 220x220 (lớp đen trong suốt, đã gồm độ mờ chung 0,22): dùng làm nền giấy ở trang (CSS) và ở nền Giấy của bản đồ (canvas). */
export function grainTile() {
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
export function grainURL() {
  if (grainUrl) return grainUrl;
  const N = 220; const ga = new Uint8Array(N * N * 2);
  for (let i = 0; i < N * N; i++) { ga[2 * i] = 0; ga[2 * i + 1] = Math.round(Math.pow(Math.random(), 2.2) * 120 * 0.22); }
  const png = encodePngGA(N, N, ga);
  try { grainUrl = URL.createObjectURL(new Blob([png], { type: 'image/png' })); }
  catch { let b = ''; for (let i = 0; i < png.length; i += 0x8000) b += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000)); grainUrl = `data:image/png;base64,${btoa(b)}`; }
  return grainUrl;
}
