'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
  'js/word-data.js',
  'js/word-phrases.js',
  'js/word-families.js',
  'js/word-confusions.js',
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
  '../tools/prepare-lively-media.js', 'js/word-data.js', 'js/word-phrases.js', 'js/word-families.js', 'js/word-confusions.js']) {
  const result = spawnSync(process.execPath, ['--check', path.resolve(APP, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const wordContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/word-data.js'), 'utf8'), wordContext, {
  filename: 'app/js/word-data.js',
});
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/word-phrases.js'), 'utf8'), wordContext, {
  filename: 'app/js/word-phrases.js',
});
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/word-families.js'), 'utf8'), wordContext, {
  filename: 'app/js/word-families.js',
});
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/word-confusions.js'), 'utf8'), wordContext, {
  filename: 'app/js/word-confusions.js',
});
const words = wordContext.window.W11_WORDS;
const phrases = wordContext.window.W11_WORD_PHRASES;
const families = wordContext.window.W11_WORD_FAMILIES;
const confusions = wordContext.window.W11_WORD_CONFUSIONS;
if (!Array.isArray(words) || words.length < 3000) {
  throw new Error('Vocabulary data must contain at least 3000 local entries');
}
for (const [index, word] of words.entries()) {
  if (!word || typeof word.word !== 'string' || !word.word.trim()
    || typeof word.pos !== 'string' || !word.pos.trim() || !Array.isArray(word.forms)) {
    throw new Error(`Invalid vocabulary entry at index ${index}`);
  }
  for (const form of word.forms) {
    if (!form || typeof form.label !== 'string' || typeof form.value !== 'string'
      || !form.label.trim() || !form.value.trim()) {
      throw new Error(`Invalid inflection in vocabulary entry at index ${index}`);
    }
  }
}
if (!phrases || typeof phrases !== 'object' || Object.keys(phrases).length < 100) {
  throw new Error('Curated phrase map must contain at least 100 entries');
}
if (!families || typeof families !== 'object' || Object.keys(families).length < 100) {
  throw new Error('Curated word-family map must contain at least 100 groups');
}
if (!confusions || typeof confusions !== 'object' || Object.keys(confusions).length < 40) {
  throw new Error('Confusing-word map must contain at least 40 reminders');
}
for (const [word, reminder] of Object.entries(confusions)) {
  if (!word.trim() || typeof reminder !== 'string' || !reminder.trim()) {
    throw new Error(`Invalid confusing-word reminder: ${word}`);
  }
}
for (const [root, family] of Object.entries(families)) {
  if (!root || !family || !Array.isArray(family.family) || !Array.isArray(family.phrases)) {
    throw new Error(`Invalid word-family group: ${root}`);
  }
  for (const member of family.family) {
    if (!Array.isArray(member) || member.length !== 2 || member.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new Error(`Invalid family member in group: ${root}`);
    }
  }
  for (const phrase of family.phrases) {
    if (typeof phrase !== 'string' || !phrase.trim()) throw new Error(`Invalid family phrase in group: ${root}`);
  }
}
const successFamily = families.success;
if (!successFamily || successFamily.family.length < 3 || successFamily.phrases.length < 2) {
  throw new Error('The initial success card must include a complete family and phrases');
}

console.log(`[wallpaper11] Lively project OK: ${Object.keys(properties).length} properties; ${words.length} vocabulary entries; ${Object.keys(families).length} word families; ${Object.keys(confusions).length} confusing-word reminders`);
