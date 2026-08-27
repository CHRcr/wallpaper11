'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const MEDIA = path.join(APP, 'media');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv']);

const SOURCES = [
  [path.join(ROOT, 'local-video'), path.join(MEDIA, 'video')],
  [path.join(ROOT, 'local-music'), path.join(MEDIA, 'music')],
  [path.join(ROOT, 'local-homework'), path.join(MEDIA, 'homework')],
];

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  if (!fs.existsSync(source)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      count += copyTree(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      count += 1;
    }
  }
  return count;
}

function collectFiles(directory, extensions, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(file, extensions, result);
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) result.push(file);
  }
  return result;
}

function browserPath(file) {
  return path.relative(APP, file).split(path.sep).map(encodeURIComponent).join('/');
}

function decodeText(file) {
  if (!fs.existsSync(file)) return '';
  const bytes = fs.readFileSync(file);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('gbk').decode(bytes);
  }
}

function trackName(file) {
  const stem = path.basename(file, path.extname(file)).trim() || '未命名音乐';
  const split = stem.lastIndexOf('-');
  if (split <= 0 || split >= stem.length - 1) return { name: stem, artist: '' };
  return {
    name: stem.slice(0, split).trim(),
    artist: stem.slice(split + 1).trim(),
  };
}

for (const [, destination] of SOURCES) fs.mkdirSync(destination, { recursive: true });
const copied = SOURCES.reduce((total, [source, destination]) =>
  total + copyTree(source, destination), 0);

const musicFiles = collectFiles(path.join(MEDIA, 'music'), AUDIO_EXTENSIONS)
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { sensitivity: 'base' }));
const videoFiles = collectFiles(path.join(MEDIA, 'video'), VIDEO_EXTENSIONS)
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { sensitivity: 'base' }));

const library = {
  music: musicFiles.map((file) => {
    const names = trackName(file);
    return {
      ...names,
      url: browserPath(file),
      lrc: decodeText(file.slice(0, -path.extname(file).length) + '.lrc'),
    };
  }),
  backgroundUrl: videoFiles.length ? browserPath(videoFiles[0]) : '',
  mediaDir: 'media',
};

const output = path.join(MEDIA, 'media-library.js');
fs.writeFileSync(output,
  'window.W11_MEDIA_LIBRARY = ' + JSON.stringify(library, null, 2) + ';\n', 'utf8');

console.log(`[wallpaper11] Lively media ready: ${library.music.length} music, ${videoFiles.length} video, ${copied} copied`);
