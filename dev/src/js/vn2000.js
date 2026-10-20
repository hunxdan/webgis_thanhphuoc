// vn2000.js — VN-2000 (TM-3°, k = 0,9999) <-> WGS84. Chuyển datum 7 tham số (Thông tư 973/2001/TT-TCĐC) rồi chiếu TM.
// Quy ước Việt Nam: X = hướng Bắc (northing), Y = hướng Đông (easting).
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), EP2 = E2 / (1 - E2);
const K0 = 0.9999, FE = 500000, D2R = Math.PI / 180, AS = Math.PI / 648000;
const e4 = E2 * E2, e6 = e4 * E2;
const T = { x: -191.90441429, y: -39.30318279, z: -111.45032835 };
const Rt = { x: -0.00928836 * AS, y: 0.01975479 * AS, z: -0.00427372 * AS };
const M = 1 + 0.252906278e-6;
let L0 = 105.75 * D2R;
export const setCentralMeridian = (deg) => { L0 = deg * D2R; };

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
export function wgsToVN(lat, lon) { const g = wgsToVnGeo(lat, lon); const r = tmForward(g.lat, g.lon); return { X: r.N, Y: r.E }; }
/** VN-2000 (X Bắc, Y Đông) -> WGS84 { lat, lon } */
export function vnToWgs(X, Y) { const g = tmInverse(Y, X); return vnToWgsGeo(g.lat, g.lon); }
