/* ============================================================
   wallpaper11 · 主逻辑
   时钟 / 年度进度 / 高考倒计时 / 3500词卡片 / 今日作业 / 设置
   ============================================================ */
'use strict';

/* ---------- 设置（localStorage 持久化） ---------- */

const DEFAULTS = {
  examDate: '2027-06-07',      // 高考日期（占位，之后再定）
  examTitle: '距 2027 高考',
  wordInterval: 50,            // 单词切换间隔（秒）
  hour12: false,               // 12 小时制
  showSec: true,               // 显示秒
  bgMode: 'play',              // play=播放视频 / pause=冻结静态
  scale: 1,                    // 界面缩放
  musicApi: 'http://127.0.0.1:16311',  // 本机 Music Bridge（tools/netease-api）
  musicCookie: '',             // 网易云 Cookie（MUSIC_U，VIP 用；可空）
};

const SETTINGS_KEY = 'w11-settings';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

let settings = loadSettings();

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 忽略 */ }
}

const $ = (id) => document.getElementById(id);

/* ---------- 单窗口运行时 / Lively 桥接 ---------- */

// 面板互斥：同时只开一个（player.js 会把音乐面板也注册进来）
const panelClosers = [];   // [{ el, close }]
function closeOtherPanels(exceptEl) {
  for (const p of panelClosers) if (p.el !== exceptEl) p.close();
}

// Lively 暂停壁纸前收起交互面板，恢复时保留低调工具栏。
window.__w11ClosePanels = () => closeOtherPanels(null);

// Lively 的 --pause-event 会调用此钩子，同步冻结视频和音乐。
const powerHandlers = [];
let powerRunning = true;
window.__w11Power = (run) => {
  powerRunning = !!run;
  powerHandlers.forEach((fn) => fn(powerRunning));
};
window.__w11PowerRunning = () => powerRunning;

function runtimeLog(message) {
  console.debug('[wallpaper11]', message);
}

/* ---------- Toast ---------- */

const toastEl = $('toast');
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

/* ---------- 可滚动面板：约束滚轮和触屏手势 ---------- */

function setupContainedScroll(element) {
  if (!element) return;
  element.addEventListener('wheel', (event) => {
    if (event.ctrlKey || element.scrollHeight <= element.clientHeight + 1) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const unit = event.deltaMode === 1 ? 20
      : event.deltaMode === 2 ? element.clientHeight : 1;
    element.scrollTop += event.deltaY * unit;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
}

document.querySelectorAll('[data-scroll-surface]').forEach(setupContainedScroll);

/* ---------- 时钟 + 日期 + 年度进度 ---------- */

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
let lastDateStr = '';

function tick() {
  const now = new Date();

  // 时钟
  let h = now.getHours();
  if (settings.hour12) {
    $('ampm').hidden = false;
    $('ampm').textContent = h < 12 ? 'AM' : 'PM';
    h = h % 12 || 12;
  } else {
    $('ampm').hidden = true;
  }
  const hhStr = String(h).padStart(2, '0');
  const mmStr = String(now.getMinutes()).padStart(2, '0');
  const ssStr = String(now.getSeconds()).padStart(2, '0');
  $('hh').textContent = hhStr;
  $('mm').textContent = mmStr;
  if (settings.showSec) {
    $('ss').textContent = ':' + ssStr;
  }
  // 作业板头部的时间
  $('hwClock').textContent = hhStr + ':' + mmStr + (settings.showSec ? ':' + ssStr : '');

  // 日期 & 年度进度（每天只重算一次）
  const dateStr = now.toDateString();
  if (dateStr !== lastDateStr) {
    lastDateStr = dateStr;
    $('ybDate').textContent =
      `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]}`;

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYear  = new Date(now.getFullYear() + 1, 0, 1);
    const pct = ((now - yearStart) / (nextYear - yearStart)) * 100;
    $('ybFill').style.width = pct.toFixed(2) + '%';
    $('ybPct').textContent = pct.toFixed(1) + '%';

    updateCountdown();
  }
}

/* ---------- 高考倒计时 ---------- */

function updateCountdown() {
  const target = new Date(settings.examDate + 'T09:00:00');
  const cdDays = $('cdDays');
  if (isNaN(target)) { cdDays.textContent = '—'; return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(settings.examDate) - today) / 86400000);
  cdDays.textContent = days >= 0 ? String(days) : '0';
}

/* ---------- 3500 词卡片（词组形式，示例数据） ---------- */

const WORDS = [
  {
    word: 'abandon', pos: 'v. 放弃；抛弃；离弃',
    derivs: [
      ['abandoned', 'adj. 被遗弃的；放纵的'],
      ['abandonment', 'n. 放弃；遗弃'],
    ],
    phrase: 'abandon oneself to 沉溺于；听任',
  },
  {
    word: 'ability', pos: 'n. 能力；才能；本领',
    derivs: [
      ['able', 'adj. 能够的；有能力的'],
      ['unable', 'adj. 不能的；不会的'],
      ['enable', 'v. 使能够；使成为可能'],
    ],
    phrase: 'to the best of one’s ability 竭尽全力',
  },
  {
    word: 'absolute', pos: 'adj. 绝对的；完全的；确实的',
    derivs: [
      ['absolutely', 'adv. 绝对地；完全地'],
      ['absoluteness', 'n. 绝对；完全'],
    ],
    phrase: 'absolute zero 绝对零度',
  },
  {
    word: 'absorb', pos: 'v. 吸收；吸引；使专心',
    derivs: [
      ['absorbed', 'adj. 全神贯注的；专心的'],
      ['absorption', 'n. 吸收；全神贯注'],
    ],
    phrase: 'be absorbed in 专心于；沉浸于',
  },
  {
    word: 'academic', pos: 'adj. 学术的；学业的；理论的',
    derivs: [
      ['academy', 'n. 学院；研究院；学会'],
      ['academically', 'adv. 学术上；学业上'],
    ],
    phrase: 'academic year 学年',
  },
];

let wordIndex = 0;
let wordTimer = null;
const wcInner = $('wcInner');

function renderWord(i) {
  const w = WORDS[i];
  $('wcWord').textContent = w.word;
  $('wcPos').textContent = w.pos;
  $('wcDerivs').innerHTML = w.derivs
    .map(([dw, dm]) => `<li><span class="dw">${dw}</span><span class="dm">${dm}</span></li>`)
    .join('');
  $('wcPhrase').textContent = w.phrase;
  $('wcCount').textContent = `高考 3500 词 · ${i + 1} / ${WORDS.length}`;
}

function nextWord(immediate = false) {
  let i;
  do { i = Math.floor(Math.random() * WORDS.length); } while (WORDS.length > 1 && i === wordIndex);
  wordIndex = i;

  if (immediate) { renderWord(i); return; }
  wcInner.classList.add('fade');
  setTimeout(() => {
    renderWord(i);
    wcInner.classList.remove('fade');
  }, 460);
}

function restartWordTimer() {
  clearInterval(wordTimer);
  const sec = Math.min(600, Math.max(5, Number(settings.wordInterval) || 50));
  wordTimer = setInterval(() => nextWord(), sec * 1000);
}

$('wcNext').addEventListener('click', () => {
  nextWord();
  restartWordTimer();          // 手动切换后重新计时
});

/* ---------- 今日作业板（浮层窗口） ---------- */

const idb = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('w11-db', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async set(k, v) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const rq = db.transaction('kv').objectStore('kv').get(k);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  },
  async del(k) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(k);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },
};

const homeworkMask = $('homeworkMask');
const hwBody = $('hwBody');
const hwImg = $('hwImg');
const hwDot = $('hwDot');
let hwObjUrl = null;
let livelyHomeworkSource = '';

function showHomeworkImage(blob) {
  if (hwObjUrl) URL.revokeObjectURL(hwObjUrl);
  hwObjUrl = URL.createObjectURL(blob);
  hwImg.src = hwObjUrl;
  hwImg.hidden = false;
  $('hwEmpty').style.display = 'none';
  hwBody.classList.add('has-image');
  hwDot.hidden = false;   // 工具栏按钮小红点
}

function showHomeworkImageUrl(url) {
  if (hwObjUrl) { URL.revokeObjectURL(hwObjUrl); hwObjUrl = null; }
  livelyHomeworkSource = url;
  hwImg.src = url;
  hwImg.hidden = false;
  $('hwEmpty').style.display = 'none';
  hwBody.classList.add('has-image');
  hwDot.hidden = false;
}

function clearHomework(silent = false) {
  if (hwObjUrl) { URL.revokeObjectURL(hwObjUrl); hwObjUrl = null; }
  livelyHomeworkSource = '';
  hwImg.hidden = true;
  hwImg.removeAttribute('src');
  $('hwEmpty').style.display = '';
  hwBody.classList.remove('has-image');
  hwDot.hidden = true;
  hwPanel.style.width = '';           // 恢复默认尺寸
  hwPanel.style.height = '';
  idb.del('hwImage').catch(() => {});
  if (!silent) toast('已清空作业');
}

async function saveHomeworkFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('只支持图片文件'); return; }
  if (file.size > 15 * 1024 * 1024) { toast('图片太大啦（超过 15MB）'); return; }
  try {
    await idb.set('hwImage', file);
    showHomeworkImage(file);
    toast('作业已更新');
  } catch {
    toast('保存失败，存储空间可能不足');
  }
}

const hwPanel = document.querySelector('.hw-panel');

function openHomework() {
  if (!homeworkMask.hidden) return;
  closeOtherPanels(homeworkMask);
  homeworkMask.hidden = false;
  document.body.classList.add('hw-open');
  bgVideo.pause();                    // 背景静止，减少干扰
}
function closeHomework() {
  if (homeworkMask.hidden) return;
  homeworkMask.hidden = true;
  hwBody.classList.remove('dragover');
  document.body.classList.remove('hw-open');
  applyBgMode();                      // 按设置恢复视频
}

/* 面板尺寸适配图片比例 */
function fitPanelToImage(nw, nh) {
  const margin = 32;                  // hw-body 外边距 16×2
  const headerH = hwPanel.querySelector('.hw-head').offsetHeight || 62;
  const maxW = Math.min(880, window.innerWidth * 0.92) - margin;
  const maxH = window.innerHeight * 0.88 - headerH - margin;
  const s = Math.min(maxW / nw, maxH / nh, 1.15);   // 最多放大到 1.15 倍
  const bw = Math.max(280, Math.round(nw * s));
  const bh = Math.max(200, Math.round(nh * s));
  hwPanel.style.width = (bw + margin) + 'px';
  hwPanel.style.height = (bh + headerH + margin) + 'px';
}

hwImg.addEventListener('load', () => {
  if (hwImg.naturalWidth) fitPanelToImage(hwImg.naturalWidth, hwImg.naturalHeight);
});

window.addEventListener('resize', () => {
  if (!hwImg.hidden && hwImg.naturalWidth) {
    fitPanelToImage(hwImg.naturalWidth, hwImg.naturalHeight);
  }
});

// 点击空白遮罩关闭
homeworkMask.addEventListener('click', (e) => { if (e.target === homeworkMask) closeHomework(); });
$('hwClose').addEventListener('click', closeHomework);

// Esc 关闭（音乐面板的 Esc 由 player.js 自己处理）
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!homeworkMask.hidden) closeHomework();
  if (!settingsMask.hidden) closeSettings();
});

// 只在作业板内部接管文件拖拽，避免和 Windows 桌面拖放冲突。
hwBody.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  hwBody.classList.add('dragover');
});
hwBody.addEventListener('dragleave', () => hwBody.classList.remove('dragover'));
hwBody.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  hwBody.classList.remove('dragover');
  saveHomeworkFile(e.dataTransfer.files && e.dataTransfer.files[0]);
});

// 点击 hwBody 空白处 = 选图
const hwFileInput = document.createElement('input');
hwFileInput.type = 'file';
hwFileInput.accept = 'image/*';
hwFileInput.style.display = 'none';
document.body.appendChild(hwFileInput);
hwFileInput.addEventListener('change', () => {
  saveHomeworkFile(hwFileInput.files && hwFileInput.files[0]);
  hwFileInput.value = '';
});
hwBody.addEventListener('click', (e) => {
  if (hwBody.classList.contains('has-image')) return;  // 有图时不触发（避免误点）
  hwFileInput.click();
});

$('hwReplace').addEventListener('click', () => hwFileInput.click());
$('hwClear2').addEventListener('click', () => clearHomework());
$('btnHomework').addEventListener('click', openHomework);

async function loadHomework() {
  try {
    const blob = await idb.get('hwImage');
    if (blob && !livelyHomeworkSource) showHomeworkImage(blob);
  } catch { /* 首次使用无库，忽略 */ }
}

/* ---------- 网易云 API 共享辅助（player.js 使用） ---------- */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function apiBase() { return (settings.musicApi || DEFAULTS.musicApi).replace(/\/+$/, ''); }
function cookieParam() {
  let c = (settings.musicCookie || '').trim();
  if (!c) return '';
  if (!c.includes('=')) c = 'MUSIC_U=' + c;   // 只粘贴了 MUSIC_U 的值时自动补全
  return '&cookie=' + encodeURIComponent(c);
}

/* ---------- 工具栏 & 设置面板 ---------- */

const settingsMask = $('settingsMask');

function openSettings() {
  if (!settingsMask.hidden) return;
  closeOtherPanels(settingsMask);
  $('setExamDate').value = settings.examDate;
  $('setExamTitle').value = settings.examTitle;
  $('setWordInterval').value = settings.wordInterval;
  $('setHour12').value = settings.hour12 ? '1' : '0';
  $('setShowSec').checked = settings.showSec;
  $('setBg').value = settings.bgMode;
  $('setScale').value = settings.scale;
  $('setMusicCookie').value = settings.musicCookie;
  $('btnManageMusicBridge').href = apiBase() + '/manage';
  settingsMask.hidden = false;
  refreshMusicBridgeStatus();
}

function closeSettings() {
  if (settingsMask.hidden) return;
  settingsMask.hidden = true;
}

panelClosers.push({ el: homeworkMask, close: closeHomework });
panelClosers.push({ el: settingsMask, close: closeSettings });

$('btnSettings').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', closeSettings);
settingsMask.addEventListener('click', (e) => { if (e.target === settingsMask) closeSettings(); });

// 点倒计时胶囊 = 直接打开设置改日期
$('countdown').addEventListener('click', () => {
  openSettings();
  $('setExamDate').focus();
});

// 设置项即时生效
$('setExamDate').addEventListener('change', (e) => {
  settings.examDate = e.target.value || DEFAULTS.examDate;
  saveSettings(); updateCountdown();
});
$('setExamTitle').addEventListener('input', (e) => {
  settings.examTitle = e.target.value.trim() || DEFAULTS.examTitle;
  saveSettings(); applySettings();
});
$('setWordInterval').addEventListener('change', (e) => {
  settings.wordInterval = Number(e.target.value) || DEFAULTS.wordInterval;
  saveSettings(); restartWordTimer();
});
$('setHour12').addEventListener('change', (e) => {
  settings.hour12 = e.target.value === '1';
  saveSettings(); tick();
});
$('setShowSec').addEventListener('change', (e) => {
  settings.showSec = e.target.checked;
  saveSettings(); applySettings(); tick();
});
$('setBg').addEventListener('change', (e) => {
  settings.bgMode = e.target.value;
  saveSettings(); applyBgMode();
});
$('setScale').addEventListener('input', (e) => {
  settings.scale = Number(e.target.value);
  saveSettings(); applySettings();
});
$('setMusicCookie').addEventListener('input', (e) => {
  settings.musicCookie = e.target.value.trim();
  saveSettings();
});

let musicBridgeCookieConfigured = false;
function updateMusicCookiePlaceholder() {
  $('setMusicCookie').placeholder = musicBridgeCookieConfigured
    ? '已保存到 Music Bridge'
    : 'MUSIC_U 的值；可留空';
}

async function readClipboardTextFromUserGesture(input) {
  if (window.clipboardData && typeof window.clipboardData.getData === 'function') {
    return { allowed: true, text: window.clipboardData.getData('Text') || '' };
  }

  // Older WebView builds may allow the legacy paste command even when the
  // asynchronous Clipboard API is unavailable in a file:// wallpaper.
  const previous = input.value;
  let pastedText = '';
  const capturePaste = (event) => {
    if (event.clipboardData) pastedText = event.clipboardData.getData('text/plain') || '';
  };
  input.addEventListener('paste', capturePaste, { once: true });
  input.focus();
  input.select();
  try {
    if (typeof document.execCommand === 'function' && document.execCommand('paste')) {
      await Promise.resolve();
      return { allowed: true, text: pastedText || (input.value !== previous ? input.value : '') };
    }
  } catch { /* Continue with the modern API. */ }
  input.removeEventListener('paste', capturePaste);
  if (input.value !== previous) return { allowed: true, text: input.value };

  if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      return { allowed: true, text: await navigator.clipboard.readText() };
    } catch { /* Lively/WebView may deny clipboard-read permission. */ }
  }
  return { allowed: false, text: '' };
}

$('btnPasteMusicCookie').addEventListener('click', async () => {
  const input = $('setMusicCookie');
  const result = await readClipboardTextFromUserGesture(input);
  if (!result.allowed) {
    try {
      const response = await fetch(apiBase() + '/cookie/paste', {
        method: 'POST', cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || '粘贴失败');
      input.value = '';
      settings.musicCookie = '';
      musicBridgeCookieConfigured = true;
      updateMusicCookiePlaceholder();
      saveSettings();
      toast(body.message || 'Cookie 已粘贴');
    } catch (error) {
      input.focus();
      input.select();
      toast(error.message || '请按 Ctrl+V，或在 Lively 自定义中填写');
    }
    return;
  }
  const value = String(result.text || '').trim();
  if (!value) {
    toast('剪贴板是空的');
    return;
  }
  input.value = value;
  settings.musicCookie = value;
  saveSettings();
  toast('Cookie 已粘贴');
});
$('btnClearMusicCookie').addEventListener('click', async () => {
  $('setMusicCookie').value = '';
  settings.musicCookie = '';
  musicBridgeCookieConfigured = false;
  updateMusicCookiePlaceholder();
  saveSettings();
  try {
    await fetch(apiBase() + '/cookie/clear', { method: 'POST', cache: 'no-store' });
  } catch { /* Local value is still cleared while the bridge is offline. */ }
  toast('Cookie 已清空');
});
$('btnTestMusicCookie').addEventListener('click', async () => {
  const cookie = settings.musicCookie.trim();
  if (!cookie && !musicBridgeCookieConfigured) {
    toast('请先填写 MUSIC_U');
    return;
  }
  toast('正在验证 Cookie…');
  try {
    const response = await fetch(apiBase() + '/login/status?t=' + Date.now() + cookieParam(),
      { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body && body.message || '验证失败');
    const profile = body && body.data && body.data.profile;
    if (!profile) {
      toast('Cookie 无效或已过期');
      return;
    }
    toast('已登录：' + (profile.nickname || profile.userId));
  } catch {
    toast('无法验证，请检查 Music Bridge');
  }
});

let musicBridgeOnline = false;
function renderMusicBridgeState(state, text) {
  const el = $('musicBridgeState');
  el.className = 'bridge-state ' + state;
  el.querySelector('span').textContent = text;
  $('btnManageMusicBridge').classList.toggle('disabled', state !== 'online');
  musicBridgeOnline = state === 'online';
}

async function refreshMusicBridgeStatus(notify = false) {
  renderMusicBridgeState('checking', '检测中');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch(apiBase() + '/health?t=' + Date.now(),
      { cache: 'no-store', signal: controller.signal });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error('Not ready');
    musicBridgeCookieConfigured = Boolean(body.cookieConfigured);
    updateMusicCookiePlaceholder();
    renderMusicBridgeState('online', '已连接 ' + body.version);
    if (notify) toast('Music Bridge 运行正常');
  } catch {
    renderMusicBridgeState('offline', '未连接');
    if (notify) toast('请运行 wallpaper11-music-setup.exe');
  } finally {
    clearTimeout(timer);
  }
}

$('btnCheckMusicBridge').addEventListener('click', () => refreshMusicBridgeStatus(true));
$('btnManageMusicBridge').addEventListener('click', (event) => {
  if (musicBridgeOnline) return;
  event.preventDefault();
  toast('请先运行 wallpaper11-music-setup.exe');
});
$('btnReset').addEventListener('click', () => {
  settings = { ...DEFAULTS };
  saveSettings();
  applySettings(); applyBgMode(); restartWordTimer(); tick(); updateCountdown();
  openSettings();   // 刷新面板里的值
  toast('已恢复默认设置');
});

/* ---------- 应用设置 ---------- */

function applySettings() {
  document.documentElement.style.setProperty('--ui-scale', settings.scale);
  $('clock').classList.toggle('hide-sec', !settings.showSec);
  document.querySelector('.cd-label').textContent = settings.examTitle;
}

const bgVideo = $('bgVideo');
let livelyBackgroundSource = '';

function updateMediaStatus(library) {
  const status = $('mediaStatus');
  if (!status || !library) return;
  const musicCount = Array.isArray(library.music) ? library.music.length : 0;
  status.textContent = '本机音乐 ' + musicCount + ' 首 · ' +
    ((livelyBackgroundSource || library.backgroundUrl) ? '背景已就绪' : '未选择背景视频');
}

function localMediaUrl(value, folder) {
  let path = String(value || '').trim().replace(/\\/g, '/');
  if (!path) return '';
  if (/^(?:https?:|file:|data:|blob:)/i.test(path)) return path;
  path = path.replace(/^\.\//, '');
  if (!path.includes('/')) path = folder + '/' + path;
  return path;
}

function setBackgroundSource(source) {
  const next = String(source || '');
  if (bgVideo.dataset.mediaSource === next) return;
  bgVideo.pause();
  bgVideo.dataset.mediaSource = next;
  if (next) bgVideo.src = next;
  else bgVideo.removeAttribute('src');
  bgVideo.load();
  applyBgMode();
}

function applyMediaLibrary(library) {
  const next = library && typeof library === 'object'
    ? library : { music: [], backgroundUrl: '', mediaDir: 'media' };
  next.music = Array.isArray(next.music) ? next.music : [];
  window.W11_MEDIA_LIBRARY = next;
  if (!livelyBackgroundSource) setBackgroundSource(next.backgroundUrl || '');
  updateMediaStatus(next);
  document.dispatchEvent(new CustomEvent('w11-media-library', { detail: next }));
}

function refreshSettingsRuntime() {
  saveSettings();
  applySettings();
  applyBgMode();
  restartWordTimer();
  tick();
  updateCountdown();
}

// Lively 持久属性回调。属性面板与壁纸内设置使用同一份运行时状态。
window.livelyPropertyListener = function livelyPropertyListener(name, value) {
  switch (name) {
    case 'backgroundVideo': {
      livelyBackgroundSource = localMediaUrl(value, 'media/video');
      setBackgroundSource(livelyBackgroundSource || window.W11_MEDIA_LIBRARY.backgroundUrl || '');
      updateMediaStatus(window.W11_MEDIA_LIBRARY);
      return;
    }
    case 'homeworkImage': {
      const source = localMediaUrl(value, 'media/homework');
      if (source) showHomeworkImageUrl(source);
      return;
    }
    case 'examDate': settings.examDate = String(value || DEFAULTS.examDate); break;
    case 'examTitle': settings.examTitle = String(value || DEFAULTS.examTitle); break;
    case 'wordInterval': settings.wordInterval = Number(value) || DEFAULTS.wordInterval; break;
    case 'hour12': settings.hour12 = !!value; break;
    case 'showSeconds': settings.showSec = !!value; break;
    case 'backgroundPlayback': settings.bgMode = value ? 'play' : 'pause'; break;
    case 'interfaceScale': settings.scale = Math.min(1.4, Math.max(0.8, Number(value) / 100 || 1)); break;
    case 'musicApi': settings.musicApi = String(value || DEFAULTS.musicApi); break;
    case 'musicCookie': {
      const nextCookie = String(value || '').trim();
      // An empty Lively property is the default, not necessarily an explicit clear.
      // Keep a Cookie entered inside the wallpaper unless Lively supplies a value.
      if (nextCookie || !settings.musicCookie) settings.musicCookie = nextCookie;
      break;
    }
    case 'lively_default_settings_reload': settings = { ...DEFAULTS }; break;
    default: return;
  }
  refreshSettingsRuntime();
};

window.livelyWallpaperPlaybackChanged = function livelyWallpaperPlaybackChanged(data) {
  try {
    const state = typeof data === 'string' ? JSON.parse(data) : data;
    const running = !(state && state.IsPaused);
    if (!running) window.__w11ClosePanels();
    window.__w11Power(running);
  } catch (error) {
    runtimeLog('pause event parse failed: ' + error.message);
  }
};

function applyBgMode() {
  if (!bgVideo.dataset.mediaSource) {
    bgVideo.pause();
    return;
  }
  if (settings.bgMode === 'pause' || document.hidden || !powerRunning) {
    bgVideo.pause();               // 冻结当前帧 = 静态壁纸，最省性能
  } else {
    bgVideo.play().catch((error) => runtimeLog('video play rejected: ' + error.message));
  }
}

bgVideo.addEventListener('loadedmetadata', () => {
  runtimeLog('video metadata duration=' + bgVideo.duration + ' src=' + bgVideo.currentSrc);
  applyBgMode();
});
bgVideo.addEventListener('loadeddata', () => {
  runtimeLog('video first frame ready');
  applyBgMode();
});
bgVideo.addEventListener('playing', () => runtimeLog('video playing'));
bgVideo.addEventListener('error', () => {
  const code = bgVideo.error ? bgVideo.error.code : 0;
  runtimeLog('video error code=' + code + ' src=' + bgVideo.currentSrc);
});

// Lively 暂停/恢复壁纸时同步视频状态。
powerHandlers.push((run) => {
  if (run) applyBgMode(); else bgVideo.pause();
});

/* ---------- 性能：页面不可见时全部停摆 ---------- */

document.addEventListener('visibilitychange', () => {
  applyBgMode();
  // setInterval 在页面隐藏时浏览器会自动限流，无需额外处理
});

/* ---------- 启动 ---------- */

applySettings();
renderWord(0);
restartWordTimer();
tick();
setInterval(tick, 250);
updateCountdown();
loadHomework();
applyMediaLibrary(window.W11_MEDIA_LIBRARY);
applyBgMode();

// 调试钩子：?hw=1 直接打开作业板（?music=1 由 player.js 处理）
const debugParams = new URLSearchParams(location.search);
if (debugParams.has('hw')) openHomework();
