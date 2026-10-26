import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, config } from '@anime-week/core';
import { routes, HttpProblem } from './api.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const store = new Store();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 1 << 20) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpProblem(413, 'Corpo da requisição muito grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); }
      catch { reject(new HttpProblem(400, 'JSON inválido no corpo da requisição')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  // Impede escapar do diretório público.
  const target = path.resolve(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR)) { sendJson(res, 403, { error: 'Acesso negado' }); return; }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) { sendJson(res, 404, { error: 'Não encontrado' }); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(target).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const key = `${req.method} ${url.pathname}`;

  if (url.pathname.startsWith('/api/')) {
    const handler = routes[key];
    if (!handler) return sendJson(res, 404, { error: `Rota desconhecida: ${key}` });
    try {
      const body = req.method === 'POST' ? await readBody(req) : null;
      const payload = await handler({ store, query: url.searchParams, body });
      return sendJson(res, 200, payload);
    } catch (err) {
      const status = err instanceof HttpProblem ? err.status : 500;
      if (status === 500) console.error(`[api] ${key}:`, err);
      return sendJson(res, status, { error: err.message });
    }
  }

  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Método não permitido' });
  serveStatic(res, url.pathname);
});

server.listen(config.port, () => {
  const s = store.stats();
  console.log(`\n  Anime Week  ·  http://localhost:${config.port}`);
  console.log(`  ${s.releases} lançamentos · ${s.series} séries · ${s.favorites} favoritas`);
  console.log(`  fuso: ${config.tz}`);
  if (s.releases === 0) console.log('\n  Banco vazio — rode:  npm run collect\n');
  else console.log('');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => { store.close(); process.exit(0); });
  });
}
