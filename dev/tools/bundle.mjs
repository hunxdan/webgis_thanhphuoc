// bundle.mjs — gộp mã nguồn ES module (dev/src/js) thành script thường trong assets/js/
// để trang chạy được cả khi mở trực tiếp bằng file:// (trình duyệt cấm <script type="module"> trên file://).
// Cần esbuild:  npx esbuild  (hoặc cài toàn cục). Chạy: node dev/tools/bundle.mjs
import { createRequire } from 'node:module';
const { build } = createRequire(import.meta.url)('esbuild');
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const R = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const n of ['boot', 'landing', 'map-app']) {
  await build({ entryPoints: [join(R, 'dev/src/js', n + '.js')], outfile: join(R, 'assets/js', n + '.js'), bundle: true, format: 'iife', target: 'es2020', minify: false, loader: { '.svg': 'text' }, legalComments: 'none' });
}
console.log('ok');
