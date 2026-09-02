'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const licenseText = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const required = [
  'index.html',
  'LivelyInfo.json',
  'LivelyProperties.json',
  'assets/theme-calm.jpg',
  'css/style.css',
  'js/main.js',
  'js/player.js',
  'js/word-data.js',
];

for (const file of required) {
  const full = path.join(APP, file);
  if (!fs.existsSync(full)) throw new Error(`Missing Lively project file: ${file}`);
}

const info = JSON.parse(fs.readFileSync(path.join(APP, 'LivelyInfo.json'), 'utf8'));
const properties = JSON.parse(fs.readFileSync(path.join(APP, 'LivelyProperties.json'), 'utf8'));
const livelyInstaller = fs.readFileSync(path.join(ROOT, 'tools', 'setup', 'lively-install.ps1'), 'utf8');
const setupInstaller = fs.readFileSync(path.join(ROOT, 'tools', 'setup', 'setup.iss'), 'utf8');
const wordImporter = fs.readFileSync(path.join(ROOT, 'tools', 'build-gaokao-words.ps1'), 'utf8');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const mainSource = fs.readFileSync(path.join(APP, 'js', 'main.js'), 'utf8');
const playerSource = fs.readFileSync(path.join(APP, 'js', 'player.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(ROOT, 'tools', 'netease-api', 'server.js'), 'utf8');
const cameraProbeSource = fs.readFileSync(path.join(ROOT, 'tools', 'netease-api', 'camera-probe.ps1'), 'utf8');
if (info.Type !== 1 || info.FileName !== 'index.html') {
  throw new Error('LivelyInfo.json must describe a web wallpaper using index.html');
}
if (rootPackage.license !== 'MIT' || info.License !== 'MIT'
  || !licenseText.startsWith('MIT License\n') || !licenseText.includes('Copyright (c) 2026 CHRcr')) {
  throw new Error('Project license metadata must match the root MIT license');
}
if (!String(info.Arguments || '').includes('--pause-event true')) {
  throw new Error('LivelyInfo.json must enable the Lively pause event');
}
for (const [name, property] of Object.entries(properties)) {
  if (!name || name[0] !== name[0].toLowerCase() || !property.type || !Object.hasOwn(property, 'value')) {
    throw new Error(`Invalid Lively property: ${name}`);
  }
}
for (const setting of ['AppFocusPause', 'AppFullscreenPause', 'ProcessMonitorAlgorithm']) {
  if (!livelyInstaller.includes(`-Name "${setting}" -Value 0`)) {
    throw new Error(`Lively installer must configure ${setting}=0`);
  }
}
for (const guard of ['wantedExact', 'spellingsByFolded', 'dictionaryExact']) {
  if (!wordImporter.includes(`$${guard}`)) {
    throw new Error(`Word importer is missing its case-safe ECDICT guard: ${guard}`);
  }
}

if ((html.match(/data-word-slot=/g) || []).length !== 2
  || !html.includes('class="settings-layout"')
  || !html.includes('id="settingsNav"')) {
  throw new Error('The Seewo layout must provide two word slots and horizontal settings navigation');
}
if (html.includes('data-scroll-surface')
  || /addEventListener\(\s*['"]wheel['"]/.test(mainSource + playerSource)
  || /addEventListener\(\s*['"](?:dragover|dragleave|drop)['"]/.test(mainSource + playerSource)
  || mainSource.includes('dataTransfer')) {
  throw new Error('Wallpaper interactions must not depend on wheel scrolling or drag-and-drop');
}
for (const control of ['mpResultsPageUp', 'mpResultsPageDown', 'mpListPageUp', 'mpListPageDown']) {
  if (!html.includes(`id="${control}"`)) {
    throw new Error(`Missing click-based paging control: ${control}`);
  }
}
if (!setupInstaller.includes('ExecAndLogOutput') || !setupInstaller.includes('InstallLogMemo')) {
  throw new Error('Unified installer must show subprocess output below its progress bar');
}
if (!mainSource.includes("'/clipboard/read'") || !bridgeSource.includes("'/clipboard/read'")) {
  throw new Error('Click-to-paste must retain its Windows clipboard bridge fallback');
}
for (const signal of ['CapabilityAccessManager', 'LastUsedTimeStart', 'LastUsedTimeStop']) {
  if (!cameraProbeSource.includes(signal)) {
    throw new Error(`Device-state probe is missing its session signal: ${signal}`);
  }
}
if (cameraProbeSource.includes('DEVPKEY_Device_PowerData') || cameraProbeSource.includes('Get-PnpDevice')) {
  throw new Error('Device-state probe must not infer activity from persistent hardware power');
}
if (!mainSource.includes('不得新增可见文字') || !mainSource.includes('提交信息中单独提及')) {
  throw new Error('The silent state-indicator constraint must remain next to its UI binding');
}

const generated = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-word-runtime.js'), '--check'], {
  encoding: 'utf8',
});
if (generated.status !== 0) {
  process.stderr.write(generated.stderr || generated.stdout);
  process.exit(generated.status || 1);
}

for (const file of [
  'js/main.js',
  'js/player.js',
  'js/word-data.js',
  '../tools/dev-server.js',
  '../tools/prepare-lively-media.js',
  '../tools/build-word-runtime.js',
  '../tools/netease-api/server.js',
  '../data/words/curation.js',
]) {
  const result = spawnSync(process.execPath, ['--check', path.resolve(APP, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const wordContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(APP, 'js/word-data.js'), 'utf8'), wordContext, {
  filename: 'app/js/word-data.js',
});
const data = wordContext.window.W11_WORD_DATA;
const words = wordContext.window.W11_WORDS;
if (!data || !Array.isArray(words) || words.length !== 3500 || data.count !== words.length) {
  throw new Error('Unified vocabulary runtime must contain exactly 3500 lexical entries');
}
if (data.sourceCount !== 3423) {
  throw new Error(`Unexpected source vocabulary record count: ${data.sourceCount}`);
}
if (data.curatedAdditionCount !== 101) {
  throw new Error(`Unexpected curated vocabulary addition count: ${data.curatedAdditionCount}`);
}
const expectedDifficultyCounts = { core: 3215, advanced: 144, challenge: 141 };
for (const [difficulty, expectedCount] of Object.entries(expectedDifficultyCounts)) {
  if (data.difficultyCounts?.[difficulty] !== expectedCount) {
    throw new Error(`Unexpected ${difficulty} vocabulary count: ${data.difficultyCounts?.[difficulty]}`);
  }
}

const ids = new Set();
const exactHeadwords = new Set();
const difficultyCounts = { core: 0, advanced: 0, challenge: 0 };
let totalWeight = 0;
for (const [index, word] of words.entries()) {
  if (!word || typeof word.id !== 'string' || !word.id.trim()
    || typeof word.word !== 'string' || !word.word.trim()
    || !Array.isArray(word.meanings) || !word.meanings.length
    || word.meanings.some((meaning) => typeof meaning !== 'string' || !meaning.trim())
    || !Array.isArray(word.forms) || !Array.isArray(word.family)
    || !Array.isArray(word.phrases) || !Array.isArray(word.confusions)
    || !Object.hasOwn(difficultyCounts, word.difficulty)
    || typeof word.studyGroupId !== 'string' || !word.studyGroupId.trim()
    || !Number.isFinite(word.weight) || word.weight <= 0) {
    throw new Error(`Invalid unified vocabulary entry at index ${index}`);
  }
  if (ids.has(word.id)) throw new Error(`Duplicate vocabulary id: ${word.id}`);
  if (exactHeadwords.has(word.word)) throw new Error(`Unmerged exact headword: ${word.word}`);
  ids.add(word.id);
  exactHeadwords.add(word.word);
  difficultyCounts[word.difficulty] += 1;
  totalWeight += word.weight;

  const minimumDifficultyWeight = { core: 1, advanced: 2, challenge: 3 }[word.difficulty];
  if (word.weight < minimumDifficultyWeight) {
    throw new Error(`Difficulty bonus is missing from vocabulary entry: ${word.id}`);
  }

  for (const form of word.forms) {
    if (!form || typeof form.label !== 'string' || typeof form.value !== 'string'
      || !form.label.trim() || !form.value.trim()) {
      throw new Error(`Invalid inflection in vocabulary entry: ${word.id}`);
    }
  }

  const familyWords = new Set();
  for (const member of word.family) {
    if (!member || typeof member.word !== 'string' || !member.word.trim()
      || typeof member.meaning !== 'string' || !member.meaning.trim()) {
      throw new Error(`Invalid family item in vocabulary entry: ${word.id}`);
    }
    const memberKey = member.word.trim().toLowerCase();
    if (memberKey === word.word.trim().toLowerCase()) {
      throw new Error(`Vocabulary entry contains itself as a family item: ${word.id}`);
    }
    if (familyWords.has(memberKey)) throw new Error(`Duplicate family item in vocabulary entry: ${word.id}`);
    familyWords.add(memberKey);
  }
  for (const phrase of word.phrases) {
    if (typeof phrase !== 'string' || !phrase.trim()) throw new Error(`Invalid phrase in vocabulary entry: ${word.id}`);
  }
  for (const confusion of word.confusions) {
    if (typeof confusion !== 'string' || !confusion.trim()) throw new Error(`Invalid confusion in vocabulary entry: ${word.id}`);
  }
}

for (const [difficulty, expectedCount] of Object.entries(expectedDifficultyCounts)) {
  if (difficultyCounts[difficulty] !== expectedCount) {
    throw new Error(`Runtime ${difficulty} count does not match metadata`);
  }
}
if (!Number.isFinite(data.totalWeight) || Math.abs(data.totalWeight - totalWeight) > 1e-9) {
  throw new Error(`Runtime total weight does not match metadata: ${data.totalWeight} vs ${totalWeight}`);
}

function entry(displayWord) {
  return words.find((word) => word.word === displayWord);
}

const adEra = entry('AD');
const adAdvertisement = entry('ad');
if (!adEra || adEra.id !== 'AD_anno_domini' || adEra.forms.length !== 0
  || !adAdvertisement || adAdvertisement.id !== 'ad_advertisement') {
  throw new Error('AD/ad lexical entries must remain separate and correctly inflected');
}

const charge = entry('charge');
if (!charge || !charge.meanings.join('').includes('指控') || !charge.meanings.join('').includes('猛冲')) {
  throw new Error('charge must include its reviewed extended meanings');
}

const successful = entry('successful');
if (!successful || !successful.family.some((member) => member.word === 'success')) {
  throw new Error('A family member card must include its root');
}

const careful = entry('careful');
if (!careful || !careful.phrases.includes('be careful with 小心对待')
  || careful.phrases.some((phrase) => phrase.startsWith('care about') || phrase.startsWith('take care of'))) {
  throw new Error('careful must own its relevant phrase instead of inheriting care phrases');
}

for (const displayWord of ['abolish', 'ambition', 'detective', 'acquire', 'consequence', 'distinguish', 'persuade', 'acknowledge', 'transform']) {
  const reviewed = entry(displayWord);
  if (!reviewed || reviewed.family.length === 0 || reviewed.phrases.length === 0 || reviewed.weight <= 1) {
    throw new Error(`Reviewed advanced entry is incomplete: ${displayWord}`);
  }
}

for (const displayWord of ['hypothesis', 'interpret', 'strategy', 'virtual']) {
  const reviewed = entry(displayWord);
  if (!reviewed || reviewed.difficulty !== 'challenge'
    || reviewed.family.length === 0 || reviewed.phrases.length === 0 || reviewed.weight < 3) {
    throw new Error(`Qingbei challenge entry is incomplete: ${displayWord}`);
  }
}

console.log(`[wallpaper11] Lively project OK: ${Object.keys(properties).length} properties; ${data.sourceCount} source records + ${data.curatedAdditionCount} curated additions -> ${words.length} unified lexical entries; ${difficultyCounts.advanced + difficultyCounts.challenge} advanced/challenge entries; every entry has positive draw weight`);
