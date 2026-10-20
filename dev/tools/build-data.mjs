#!/usr/bin/env node
/**
 * build-data.mjs — chuyển dữ liệu gốc (source-data/*.js, xuất từ qgis2web) thành
 * các gói nhị phân gọn nhẹ trong data/ để trình duyệt tải nhanh.
 *
 * - KHÔNG sửa dữ liệu gốc: chỉ đọc source-data/.
 * - Toạ độ được chiếu sang Web Mercator (EPSG:3857), lượng tử hoá 0,1 m, lưu Int32.
 * - Dữ liệu mới không còn trường tên chủ sử dụng; mọi thuộc tính hiển thị lấy NGUYÊN từ các trường của dữ liệu
 *   (không sinh/tính thêm trong mã): SO_TO, SO_THUA, DT, DT_PL, MSDD/Ten_MSDD, DC_TD, TyLeQH, và ở chi tiết quy hoạch:
 *   MA_LĐ_QH, TEN_LĐ_QH, DT_QH, TyLe_QH.
 *
 * Dùng:  node dev/tools/build-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { earcut } from './earcut.mjs';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'source-data');
const OUT = join(ROOT, '..', 'data');
mkdirSync(OUT, { recursive: true });

/* ---------- đọc dữ liệu gốc (dạng `var json_x = {...};`) ---------- */
function readGeo(file) {
  const t = readFileSync(join(SRC, file), 'utf8');
  return JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
}
const thua = readGeo('THUA_DAT_2.js').features;
const qhThua = readGeo('QH_THUA_1.js').features;
const qhCt = readGeo('QH_CHI_TIET_0.js').features;
const qhClean = readGeo('QH_Clean_v3_3.js').features;

/* ---------- nhóm loại đất (dùng chung cho hiện trạng & quy hoạch) ---------- */
// Tên và màu của nhóm nằm trong config.js (NHOM_DAT); ở đây chỉ gán mã -> chỉ số nhóm.
const GROUPS = [
  { id: 0, name: 'Đất ở' },
  { id: 1, name: 'Đất ở kết hợp (vườn, nông nghiệp…)' },
  { id: 2, name: 'Đất trồng lúa' },
  { id: 3, name: 'Đất cây hằng năm & lâu năm' },
  { id: 4, name: 'Nuôi trồng thủy sản & làm muối' },
  { id: 5, name: 'Đất rừng' },
  { id: 6, name: 'Giao thông, thủy lợi, năng lượng, hạ tầng' },
  { id: 7, name: 'Mặt nước (sông, kênh, ao, hồ)' },
  { id: 8, name: 'Công cộng, dịch vụ, sản xuất, tôn giáo, khác' },
  { id: 9, name: 'Đất chưa sử dụng' },
  { id: 10, name: 'Chưa có thông tin' },
];
const CODE_GROUP = {
  ONT: 0, ODT: 0,
  LUC: 2, LUK: 2, LUN: 2,
  BHK: 3, HNK: 3, CLN: 3, CNL: 3, LNC: 3, LNQ: 3, NKH: 3,
  NTS: 4, LMU: 4,
  RPH: 5, RPM: 5, RPK: 5, RDK: 5, RSM: 5, RSX: 5,
  DGT: 6, DTL: 6, DNL: 6, DBV: 6, DRA: 6,
  SON: 7, MNC: 7,
  DGD: 8, DYT: 8, DTT: 8, DVH: 8, DCH: 8, TSC: 8, TON: 8, TIN: 8, NTD: 8, SKC: 8, CNT: 8,
  CAN: 8, CQP: 8, TMD: 8, DKV: 8, DSK: 8,
  BCS: 9,
};
function groupOf(rawCode) {
  if (!rawCode) return 10;
  const code = String(rawCode).replace(/\s+/g, '');
  const parts = code.split('+');
  const first = parts[0];
  if (first === 'ONT' && parts.length > 1) return 1;
  return CODE_GROUP[first] ?? 8;
}

/* ---------- Web Mercator ---------- */
const R = 6378137;
const mx = (lon) => (lon * Math.PI / 180) * R;
const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R;

// bbox toàn vùng
let lonMin = 1e9, lonMax = -1e9, latMin = 1e9, latMax = -1e9;
const eachPt = (coords, fn) => {
  if (typeof coords[0] === 'number') fn(coords[0], coords[1]);
  else for (const c of coords) eachPt(c, fn);
};
for (const f of thua) eachPt(f.geometry.coordinates, (x, y) => {
  if (x < lonMin) lonMin = x; if (x > lonMax) lonMax = x;
  if (y < latMin) latMin = y; if (y > latMax) latMax = y;
});
const origin = { lon: (lonMin + lonMax) / 2, lat: (latMin + latMax) / 2 };
origin.mx = mx(origin.lon); origin.my = my(origin.lat);
const Q = 10; // 1 đơn vị = 0,1 m

/** Đóng gói hình học: mọi vòng của MultiPolygon (kể cả lỗ) vào một danh sách vòng. */
function packGeoms(features, withTri = false) {
  const pts = []; const ringStart = [0]; const featRing = [0]; const bbox = [];
  const tri = []; const lab = []; let badTri = 0;
  for (const f of features) {
    let x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let bestA = -1, bx = 0, by = 0;
    for (const poly of polys) {
      const flat = []; const holes = []; let base = pts.length / 2; const polyBase = base; let ok = true;
      poly.forEach((ring, ri) => {
        const n = ring.length - 1; // bỏ điểm đóng
        if (n < 3) { if (ri === 0) ok = false; return; }
        if (ri > 0) holes.push(flat.length / 2);
        for (let i = 0; i < n; i++) {
          const X = Math.round((mx(ring[i][0]) - origin.mx) * Q);
          const Y = Math.round((my(ring[i][1]) - origin.my) * Q);
          pts.push(X, Y); flat.push(X, Y);
          if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
        }
        ringStart.push(pts.length / 2);
      });
      if (!withTri || !ok) continue;
      const t = earcut(flat, holes); let sumT = 0;
      for (let k = 0; k < t.length; k += 3) {
        const i0 = t[k], i1 = t[k + 1], i2 = t[k + 2];
        const ax = flat[2 * i0], ay = flat[2 * i0 + 1], cx = flat[2 * i1], cy = flat[2 * i1 + 1], ex = flat[2 * i2], ey = flat[2 * i2 + 1];
        const a2 = Math.abs((cx - ax) * (ey - ay) - (ex - ax) * (cy - ay)) / 2; sumT += a2;
        if (a2 > bestA) { bestA = a2; bx = Math.round((ax + cx + ex) / 3); by = Math.round((ay + cy + ey) / 3); }
        tri.push(polyBase + i0, polyBase + i1, polyBase + i2);
      }
      // kiểm tra: tổng diện tích tam giác phải bằng diện tích đa giác
      let pa = 0; let hs = 0;
      for (let r = 0; r < poly.length; r++) {
        const e = r + 1 < poly.length ? holes[r] : flat.length / 2; const s0 = r === 0 ? 0 : holes[r - 1]; let ra = 0;
        for (let i = s0, j = e - 1; i < e; j = i++) ra += flat[2 * j] * flat[2 * i + 1] - flat[2 * i] * flat[2 * j + 1];
        pa += r === 0 ? Math.abs(ra) / 2 : -Math.abs(ra) / 2; hs += 0;
      }
      if (Math.abs(pa - sumT) > Math.max(2, pa * 0.001)) { badTri++; if (process.env.DBG) console.log("bad", f.properties.ID ?? f.properties.MA_THUA ?? "", poly.length, pa, sumT, flat.length / 2); }
    }
    featRing.push(ringStart.length - 1);
    bbox.push(x0, y0, x1, y1);
    if (withTri) lab.push(bestA >= 0 ? bx : Math.round((x0 + x1) / 2), bestA >= 0 ? by : Math.round((y0 + y1) / 2));
  }
  if (withTri) console.log(`    tam giác hoá: ${tri.length / 3} tam giác, đa giác sai lệch diện tích: ${badTri}`);
  const out = {
    pts: Int32Array.from(pts), ringStart: Uint32Array.from(ringStart),
    featRing: Uint32Array.from(featRing), bbox: Int32Array.from(bbox),
  };
  if (withTri) { out.tri = Uint32Array.from(tri); out.lab = Int32Array.from(lab); }
  return out;
}
function pack(sections) {
  const index = {}; let off = 0; const parts = [];
  for (const [name, arr] of Object.entries(sections)) {
    const type = arr.constructor.name;
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    index[name] = { type, offset: off, length: arr.length };
    parts.push(buf, Buffer.alloc(pad));
    off += buf.length + pad;
  }
  return { bin: Buffer.concat(parts), index };
}
const write = (name, data) => writeFileSync(join(OUT, name), data);

/* ---------- 1. Thửa đất ---------- */
const idToIdx = new Map();
thua.forEach((f, i) => idToIdx.set(f.properties.ID, i));
const qhByIdx = new Array(thua.length).fill(null);
for (const f of qhThua) {
  const i = idToIdx.get(f.properties.ID);
  if (i !== undefined) qhByIdx[i] = f.properties;
}

const msddNames = []; const msddIdx = new Map();
const addrList = []; const addrIdx = new Map();
const dict = (map, list, v) => { if (v == null) return -1; if (!map.has(v)) { map.set(v, list.length); list.push(v); } return map.get(v); };

const grpArr = new Uint8Array(thua.length);
const rows = [];
let sumDT = 0;
const sheets = new Set();
const codeSet = new Set();

// chi tiết quy hoạch -> sắp theo thửa
const ctByIdx = thua.map(() => []);
const ctCodes = []; const ctCodeIdx = new Map();
qhCt.forEach((f, k) => {
  const i = idToIdx.get(f.properties.ID);
  if (i === undefined) return;
  const ma = f.properties['MA_LĐ_QH'];
  if (!ctCodeIdx.has(ma)) { ctCodeIdx.set(ma, ctCodes.length); ctCodes.push([ma, f.properties['TEN_LĐ_QH'], groupOf(ma)]); }
  ctByIdx[i].push({ k, code: ctCodeIdx.get(ma), dt: f.properties.DT_QH, tyle: f.properties.TyLe_QH ?? 0 });
});

thua.forEach((f, i) => {
  const p = f.properties; const q = qhByIdx[i];
  const code = p.MSDD ? String(p.MSDD).replace(/\s+/g, '') : null;
  if (code) codeSet.add(code);
  const g = groupOf(code);
  grpArr[i] = g;
  sumDT += p.DT || 0;
  sheets.add(p.SO_TO);
  const ten = p.Ten_MSDD ? String(p.Ten_MSDD).replace(/\s+/g, ' ').trim() : null;
  const hasQH = q && q.TyLeQH > 0; // theo trường TyLeQH của dữ liệu
  rows.push([
    Number(p.SO_TO), Number(p.SO_THUA),
    p.DT ?? null, p.DT_PL ?? null,
    code, dict(msddIdx, msddNames, ten),
    dict(addrIdx, addrList, p.DC_TD && p.DC_TD !== 'None' ? String(p.DC_TD).trim() : null),
    q ? q.DT_in_QH : null, q ? q.TyLeQH : null,
    hasQH ? 1 : 0, g,
  ]);
});
const g1 = packGeoms(thua, true);
const p1 = pack({ pts: g1.pts, ringStart: g1.ringStart, featRing: g1.featRing, bbox: g1.bbox, grp: grpArr, tri: g1.tri, lab: g1.lab });
write('parcels.bin', p1.bin);
write('parcels.json', JSON.stringify(p1.index));
write('attrs.json', JSON.stringify({
  cols: ['to', 'thua', 'dt', 'dtpl', 'ma', 'ten', 'dc', 'dtqh', 'tyle', 'cqh', 'g'],
  ten: msddNames, dc: addrList, rows,
}));

/* ---------- 2. Chi tiết quy hoạch ---------- */
const ctOrder = []; const ctStart = [0]; const ctCode = []; const ctDt = []; const ctTy = [];
ctByIdx.forEach((arr) => {
  for (const e of arr) { ctOrder.push(e.k); ctCode.push(e.code); ctDt.push(e.dt); ctTy.push(e.tyle); }
  ctStart.push(ctOrder.length);
});
const g2 = packGeoms(ctOrder.map((k) => qhCt[k]));
const p2 = pack({
  pts: g2.pts, ringStart: g2.ringStart, featRing: g2.featRing, bbox: g2.bbox,
  ctStart: Uint32Array.from(ctStart), code: Uint16Array.from(ctCode),
  dt: Float32Array.from(ctDt), tyle: Float32Array.from(ctTy),
});
write('ct.bin', p2.bin);
write('ct.json', JSON.stringify({ index: p2.index, codes: ctCodes }));

/* ---------- 3. Vùng quy hoạch (QH_Clean_v3) ---------- */
const zCodes = []; const zCodeIdx = new Map(); const zCode = []; const zTT = []; const zTTi = new Map(); const zTTl = []; const zTTarr = [];
for (const f of qhClean) {
  const ma = f.properties['MA_LĐ_QH'];
  if (!zCodeIdx.has(ma)) { zCodeIdx.set(ma, zCodes.length); zCodes.push([ma, f.properties['TEN_LĐ_QH'], groupOf(ma)]); }
  zCode.push(zCodeIdx.get(ma));
  zTTarr.push(dict(zTTi, zTTl, f.properties.TT_QH ? String(f.properties.TT_QH).trim() : null));
}
const g3 = packGeoms(qhClean, true);
const p3 = pack({
  pts: g3.pts, ringStart: g3.ringStart, featRing: g3.featRing, bbox: g3.bbox, tri: g3.tri, lab: g3.lab,
  code: Uint16Array.from(zCode), tt: Int16Array.from(zTTarr),
  dtqh: Float32Array.from(qhClean.map((f) => Number(f.properties.DTQH) || 0)),
});
write('qh.bin', p3.bin);
write('qh.json', JSON.stringify({ index: p3.index, codes: zCodes, tt: zTTl }));

/* ---------- meta ---------- */
let mnx = 1e12, mny = 1e12, mxx = -1e12, mxy = -1e12;
for (let i = 0; i < g1.bbox.length; i += 4) {
  mnx = Math.min(mnx, g1.bbox[i]); mny = Math.min(mny, g1.bbox[i + 1]);
  mxx = Math.max(mxx, g1.bbox[i + 2]); mxy = Math.max(mxy, g1.bbox[i + 3]);
}
write('meta.json', JSON.stringify({
  version: 2, quant: Q, origin,
  bbox: { lonMin, lonMax, latMin, latMax }, bboxQ: [mnx, mny, mxx, mxy],
  groups: GROUPS,
  stats: {
    parcels: thua.length, sheets: sheets.size, qhZones: qhClean.length,
    qhTypes: ctCodes.length, landUseCodes: codeSet.size,
    areaHa: Math.round(sumDT / 100) / 100,
  },
}));

console.log(`OK  thửa=${thua.length}  tờ=${sheets.size}  vùng QH=${qhClean.length}  loại QH=${ctCodes.length}  mảnh chi tiết=${ctOrder.length}`);
console.log(`    tổng DT=${(sumDT / 10000).toFixed(1)} ha`);
for (const n of ['parcels.bin', 'attrs.json', 'ct.bin', 'qh.bin']) {
  console.log('   ', n, (readFileSync(join(OUT, n)).length / 1e6).toFixed(2), 'MB');
}
