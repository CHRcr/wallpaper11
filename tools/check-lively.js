'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const required = [
  'index.html',
  'LivelyInfo.json',
  'LivelyProperties.json',
  'css/style.css',
  'js/main.js',
  'js/player.js',
];

for (const file of required) {
  const full = path.join(APP, file);
  if (!fs.existsSync(full)) throw new Error(`Missing Lively project file: ${file}`);
}

const info = JSON.parse(fs.readFileSync(path.join(APP, 'LivelyInfo.json'), 'utf8'));
const properties = JSON.parse(fs.readFileSync(path.join(APP, 'LivelyProperties.json'), 'utf8'));
if (info.Type !== 1 || info.FileName !== 'index.html') {
  throw new Error('LivelyInfo.json must describe a web wallpaper using index.html');
}
for (const [name, property] of Object.entries(properties)) {
  if (!name || name[0] !== name[0].toLowerCase() || !property.type || !Object.hasOwn(property, 'value')) {
    throw new Error(`Invalid Lively property: ${name}`);
  }
}

for (const file of ['js/main.js', 'js/player.js', '../tools/dev-server.js',
  '../tools/prepare-lively-media.js']) {
  const result = spawnSync(process.execPath, ['--check', path.resolve(APP, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`[wallpaper11] Lively project OK: ${Object.keys(properties).length} properties`);
