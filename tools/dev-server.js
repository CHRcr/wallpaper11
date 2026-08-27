'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 1420;
const ROOT = path.resolve(__dirname, '..', 'app');
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/.wallpaper11-dev-health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('wallpaper11-dev-server');
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, relative);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[wallpaper11] dev server: http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') throw error;
  http.get(`http://${HOST}:${PORT}/.wallpaper11-dev-health`, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      if (response.statusCode === 200 && body === 'wallpaper11-dev-server') {
        console.log(`[wallpaper11] reuse dev server: http://${HOST}:${PORT}`);
      } else {
        console.error(`[wallpaper11] port ${PORT} is occupied by another program`);
        process.exitCode = 1;
      }
    });
  }).on('error', () => {
    console.error(`[wallpaper11] port ${PORT} is occupied by another program`);
    process.exitCode = 1;
  });
});
