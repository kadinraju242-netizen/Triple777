/* Local server for development. Not deployed — see .vercelignore.

   It does two things:
     1. serves the site's files, as Vercel does online
     2. runs the Trade Desk API behind /api, backed by MySQL (see
        local-db/server.js). Needs MySQL running and `npm install` once.

   Online, the site talks to Supabase instead (js/config.js). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const localDb = require('./local-db/server.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 4180;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4'
};

http.createServer((req, res) => {
  if (localDb.handle(req, res)) return;

  const url = new URL(req.url, 'http://localhost');
  /* Database scripts and settings are never served. */
  if (/^\/(local-db|supabase|node_modules)\//i.test(url.pathname)) { res.writeHead(404).end('Not found'); return; }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  /* Resolve inside ROOT and refuse anything that climbs out of it. */
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>' + rel + '</p>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('Triple 7 Holdings — http://localhost:' + PORT);
  localDb.start();
});
