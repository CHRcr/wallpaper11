'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'host', 'src-tauri', 'target', 'debug', 'media');
const SOURCES = [
  [path.join(ROOT, 'local-video'), path.join(TARGET, 'video')],
  [path.join(ROOT, 'local-music'), path.join(TARGET, 'music')],
];

// target/debug 是生成目录。每次启动调试前重建镜像，避免已从本地媒体源
// 删除的歌曲或视频继续残留在调试媒体库里。
fs.rmSync(TARGET, { recursive: true, force: true });

function mirror(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  if (!fs.existsSync(source)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      count += mirror(from, to);
      continue;
    }
    if (!entry.isFile()) continue;
    if (fs.existsSync(to)) {
      const a = fs.statSync(from);
      const b = fs.statSync(to);
      if (a.size === b.size && a.mtimeMs <= b.mtimeMs) {
        count += 1;
        continue;
      }
      fs.unlinkSync(to);
    }
    try {
      fs.linkSync(from, to);
    } catch {
      fs.copyFileSync(from, to);
    }
    count += 1;
  }
  return count;
}

const count = SOURCES.reduce((total, [source, destination]) =>
  total + mirror(source, destination), 0);
console.log(`[wallpaper11] dev media ready: ${count} files`);
