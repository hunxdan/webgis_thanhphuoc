#!/usr/bin/env node
// Máy chủ tĩnh cục bộ có tiêu đề bảo mật. Dùng: node tools/serve.mjs [cổng]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.argv[2]) || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://server.arcgisonline.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || /^[\\/]dev([\\/]|$)/.test(f.slice(ROOT.length))) throw new Error('x');
    if (!(await stat(f)).isFile()) throw new Error('x');
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-cache' });
    res.end(await readFile(f));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Không tìm thấy trang.'); }
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}`));
