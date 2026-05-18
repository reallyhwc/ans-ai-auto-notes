const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8765;
const HOST = '127.0.0.1'; // 显式只听本机
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

// 防抖：fs.watch 在保存时常触发多次事件，统一在一个窗口内只通知一次
let reloadTimer = null;
let pendingNeedsRebuild = false;
function scheduleReload(needsRebuild) {
  if (needsRebuild) pendingNeedsRebuild = true;
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    const rebuild = pendingNeedsRebuild;
    pendingNeedsRebuild = false;
    if (rebuild) {
      // md 文件增删时，先重建 manifest 再通知刷新
      const child = spawn('node', ['scripts/build-index.js'], { cwd: ROOT, stdio: 'inherit' });
      child.on('exit', () => broadcastReload());
    } else {
      broadcastReload();
    }
  }, 120);
}
function broadcastReload() {
  for (const res of clients) {
    try { res.write('data: reload\n\n'); } catch (_) { /* ignore */ }
  }
}

// 监听 kb/ 变化。md 增删 → 重建 manifest；其他变化 → 仅通知刷新
try {
  fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return;
    // 'rename' 事件覆盖新增/删除/重命名场景
    const needsRebuild = eventType === 'rename';
    scheduleReload(needsRebuild);
  });
} catch (err) {
  console.warn('[watch] 启用失败，live reload 不可用:', err.message);
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${HOST}:${PORT}`);
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

  // Prevent directory traversal: resolved path 必须严格在 ROOT 内
  const resolvedPath = path.resolve(filePath);
  if (resolvedPath !== ROOT && !resolvedPath.startsWith(ROOT + path.sep)) {
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

server.listen(PORT, HOST, () => {
  console.log(`知识库服务器已启动 → http://${HOST}:${PORT}`);
  console.log('实时监听 kb/ 目录变化，自动刷新浏览器');
});
