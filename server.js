const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const ROOT = __dirname;
const WATCH_DIR = path.join(ROOT, 'kb');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// SSE clients
const clients = new Set();

// Watch kb/ for changes, notify connected browsers
fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.md')) {
    clients.forEach(res => {
      res.write('data: reload\n\n');
    });
  }
});

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(reqUrl.pathname);

  // SSE endpoint for live reload
  if (pathname === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Static file serving
  let filePath = path.join(ROOT, pathname === '/' ? '/overview.html' : pathname);

  // Prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  filePath = resolvedPath;

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!err && stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        fs.stat(filePath, (err2, stats2) => {
          if (err2 || !stats2.isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          serveFile(filePath, stats2, res);
        });
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    serveFile(filePath, stats, res);
  });
});

function serveFile(filePath, stats, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stats.size,
  });

  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, () => {
  console.log(`知识库服务器已启动 → http://localhost:${PORT}`);
  console.log('实时监听 kb/ 目录变化，自动刷新浏览器');
});
