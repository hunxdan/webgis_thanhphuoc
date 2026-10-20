// pack-offline.mjs — gói dữ liệu + ảnh SVG lớn thành data/offline.js để mở được bằng file:// (không cần server).
// Chỉ nạp khi trang chạy dưới file://. Chạy lại sau mỗi lần dựng dữ liệu: node dev/tools/pack-offline.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const R = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = { pack: {}, json: {}, img: {} };
for (const n of ['parcels', 'qh', 'ct']) D.pack[n] = { json: JSON.parse(readFileSync(join(R, 'data', n + '.json'), 'utf8')), bin: readFileSync(join(R, 'data', n + '.bin')).toString('base64') };
for (const n of ['meta', 'attrs']) D.json[n] = JSON.parse(readFileSync(join(R, 'data', n + '.json'), 'utf8'));
writeFileSync(join(R, 'data', 'offline.js'), 'window.__WG_DATA=' + JSON.stringify(D) + ';\n');
console.log('ok');
