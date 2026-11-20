#!/usr/bin/env node
/* Servidor estático mínimo para probar la web en local y en los tests de interfaz (con Range, para el audio).
   Uso: node tools/servidor.js [puerto]   (por defecto 4173) */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const PUERTO = +process.argv[2] || 4173;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const f = path.normalize(path.join(RAIZ, ruta));
  if (!f.startsWith(RAIZ) || f.includes(path.sep + '.git' + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    const cab = { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r) {
      const ini = r[1] === '' ? Math.max(0, st.size - +r[2]) : +r[1], fin = r[1] === '' || r[2] === '' ? st.size - 1 : Math.min(+r[2], st.size - 1);
      if (ini > fin || ini >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { ...cab, 'Content-Range': `bytes ${ini}-${fin}/${st.size}`, 'Content-Length': fin - ini + 1 });
      return fs.createReadStream(f, { start: ini, end: fin }).pipe(res);
    }
    res.writeHead(200, { ...cab, 'Content-Length': st.size });
    fs.createReadStream(f).pipe(res);
  });
}).listen(PUERTO, () => console.log('http://localhost:' + PUERTO));
