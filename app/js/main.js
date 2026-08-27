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
  musicApi: 'http://127.0.0.1:16311',  // 网易云 API 代理（tools/netease-api）
  musicCookie: '',             // 网易云 Cookie（MUSIC_U，VIP 用；可空）
};

const SETTINGS_KEY = 'w11-settings';
const MEDIA_KEY = 'w11-media-revision';

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

/* ---------- 角色 / 宿主桥接 ---------- */

// wallpaper=纯壁纸层 / overlay=工具条+面板层 / all=浏览器完整模式
const W11_ROLE = document.documentElement.dataset.role || 'all';

// Tauri 宿主桥（withGlobalTauri 注入；浏览器里不存在）
const TAURI = window.__TAURI__ || null;
function tInvoke(cmd, args) {
  if (!TAURI) return Promise.reject(new Error('no host'));
  return TAURI.core.invoke(cmd, args);
}

// Tauri 的透明窗口只覆盖当前控件的实际区域，不能用整屏透明窗挡住桌面点击。
function registerOverlayPanel(mode) {
  const next = mode || 'pill';
  document.documentElement.dataset.overlayMode = next;
  if (TAURI) tInvoke('set_overlay_mode', { mode: next }).catch(() => {});
}

// 面板互斥：同时只开一个（player.js 会把音乐面板也注册进来）
const panelClosers = [];   // [{ el, close }]
function closeOtherPanels(exceptEl) {
  for (const p of panelClosers) if (p.el !== exceptEl) p.close();
}

// 宿主进入全屏省电状态前收起所有交互面板，恢复时只显示低调工具栏。
window.__w11ClosePanels = () => closeOtherPanels(null);

// 省电钩子：宿主检测到全屏程序 / 托盘暂停时调用 window.__w11Power(false)
const powerHandlers = [];
let powerRunning = true;
window.__w11Power = (run) => {
  powerRunning = !!run;
  powerHandlers.forEach((fn) => fn(powerRunning));
};
window.__w11PowerRunning = () => powerRunning;

function runtimeLog(message) {
  if (TAURI) tInvoke('runtime_log', { message: W11_ROLE + ': ' + message }).catch(() => {});
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

function showHomeworkImage(blob) {
  if (hwObjUrl) URL.revokeObjectURL(hwObjUrl);
  hwObjUrl = URL.createObjectURL(blob);
  hwImg.src = hwObjUrl;
  hwImg.hidden = false;
  $('hwEmpty').style.display = 'none';
  hwBody.classList.add('has-image');
  hwDot.hidden = false;   // 工具栏按钮小红点
}

function clearHomework(silent = false) {
  if (hwObjUrl) { URL.revokeObjectURL(hwObjUrl); hwObjUrl = null; }
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
  if (W11_ROLE === 'wallpaper') return;    // 壁纸层无面板
  if (!homeworkMask.hidden) return;
  closeOtherPanels(homeworkMask);
  homeworkMask.hidden = false;
  document.body.classList.add('hw-open');
  bgVideo.pause();                    // 背景静止，减少干扰
  registerOverlayPanel('homework');
}
function closeHomework() {
  if (homeworkMask.hidden) return;
  homeworkMask.hidden = true;
  hwBody.classList.remove('dragover');
  document.body.classList.remove('hw-open');
  applyBgMode();                      // 按设置恢复视频
  registerOverlayPanel(null);
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

// 全局拖拽拦截（防止误拖导航）+ 拖图自动展开板
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  // 如果是图片拖入且面板未开，自动展开
  if (homeworkMask.hidden && e.dataTransfer.types.includes('Files')) {
    openHomework();
  }
});
window.addEventListener('drop', (e) => e.preventDefault());

// 面板内拖拽高亮
hwBody.addEventListener('dragover', (e) => {
  e.preventDefault();
  hwBody.classList.add('dragover');
});
hwBody.addEventListener('dragleave', () => hwBody.classList.remove('dragover'));
hwBody.addEventListener('drop', (e) => {
  e.preventDefault();
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
    if (blob) showHomeworkImage(blob);
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
  if (W11_ROLE === 'wallpaper') return;    // 壁纸层无面板
  if (!settingsMask.hidden) return;
  closeOtherPanels(settingsMask);
  $('setExamDate').value = settings.examDate;
  $('setExamTitle').value = settings.examTitle;
  $('setWordInterval').value = settings.wordInterval;
  $('setHour12').value = settings.hour12 ? '1' : '0';
  $('setShowSec').checked = settings.showSec;
  $('setBg').value = settings.bgMode;
  $('setScale').value = settings.scale;
  $('setMusicApi').value = settings.musicApi;
  $('setMusicCookie').value = settings.musicCookie;
  settingsMask.hidden = false;
  registerOverlayPanel('settings');
}

function closeSettings() {
  if (settingsMask.hidden) return;
  settingsMask.hidden = true;
  registerOverlayPanel(null);
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
$('setMusicApi').addEventListener('input', (e) => {
  settings.musicApi = e.target.value.trim() || DEFAULTS.musicApi;
  saveSettings();
});
$('setMusicCookie').addEventListener('input', (e) => {
  settings.musicCookie = e.target.value.trim();
  saveSettings();
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

function updateMediaStatus(library) {
  const status = $('mediaStatus');
  if (!status || !library) return;
  const musicCount = Array.isArray(library.music) ? library.music.length : 0;
  status.textContent = '已识别 ' + musicCount + ' 首音乐' +
    (library.backgroundUrl ? '，背景视频已就绪' : '，未找到背景视频');
  status.hidden = false;
}

async function refreshMediaLibrary(options = {}) {
  if (!TAURI) return null;
  try {
    const library = await tInvoke('get_media_library');
    window.W11_MEDIA_LIBRARY = library;
    updateMediaStatus(library);
    runtimeLog('media scan music=' + (library.music || []).length +
      ' video=' + (library.backgroundUrl || 'none') + ' root=' + library.mediaDir);

    if (W11_ROLE !== 'overlay') {
      const source = library.backgroundUrl || '';
      if (bgVideo.dataset.mediaSource !== source) {
        bgVideo.pause();
        bgVideo.dataset.mediaSource = source;
        if (source) bgVideo.src = source;
        else bgVideo.removeAttribute('src');
        bgVideo.load();
        applyBgMode();
      }
    }

    document.dispatchEvent(new CustomEvent('w11-media-library', { detail: library }));
    if (W11_ROLE !== 'wallpaper') {
      localStorage.setItem(MEDIA_KEY, String(Date.now()));
    }
    if (!options.silent) toast('媒体库已刷新');
    return library;
  } catch (error) {
    runtimeLog('media scan failed: ' + error);
    if (!options.silent) toast('媒体库读取失败');
    return null;
  }
}

window.w11RefreshMediaLibrary = refreshMediaLibrary;

function applyBgMode() {
  if (W11_ROLE === 'overlay') return;   // 工具条层没有视频
  if (!bgVideo.dataset.mediaSource) {
    bgVideo.pause();
    return;
  }
  // WorkerW 中的 WebView2 即使肉眼可见，也可能把 document.hidden 报为 true。
  // 宿主模式只由显式 power state 控制；浏览器预览才使用 Visibility API。
  const visibilityPaused = !TAURI && document.hidden;
  if (settings.bgMode === 'pause' || visibilityPaused || !powerRunning) {
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

// overlay 角色：视频元素不加载（窗口透明，纯工具条）
if (W11_ROLE === 'overlay') {
  bgVideo.removeAttribute('src');
  bgVideo.load();
}

// 宿主要求暂停/恢复（其他应用窗口位于前台时冻结视频）
powerHandlers.push((run) => {
  if (W11_ROLE === 'overlay') return;
  if (run) applyBgMode(); else bgVideo.pause();
});

/* ---------- 跨窗同步：另一窗口改了设置 → 本窗即时应用 ---------- */

window.addEventListener('storage', (e) => {
  if (e.key === SETTINGS_KEY && W11_ROLE !== 'overlay') {
    settings = loadSettings();
    applySettings(); applyBgMode(); restartWordTimer(); tick(); updateCountdown();
  }
  if (e.key === MEDIA_KEY && W11_ROLE === 'wallpaper') {
    refreshMediaLibrary({ silent: true });
  }
});

/* ---------- 宿主功能（开机自启 / 检查更新 / 退出） ---------- */

if (TAURI) {
  document.querySelectorAll('.host-only').forEach(el => { el.hidden = false; });
  tInvoke('get_autostart').then(v => { $('setAutostart').checked = !!v; }).catch(() => {});
  $('setAutostart').addEventListener('change', (e) => {
    tInvoke('set_autostart', { enable: e.target.checked })
      .catch(() => { e.target.checked = !e.target.checked; toast('设置失败'); });
  });
  $('btnCheckUpdate').addEventListener('click', () => {
    toast('正在检查更新…');
    tInvoke('check_update').then((msg) => toast(String(msg || '已是最新')))
      .catch(() => toast('检查更新失败'));
  });
  $('btnOpenMedia').addEventListener('click', () => {
    tInvoke('open_media_folder').catch(() => toast('无法打开媒体文件夹'));
  });
  $('btnRefreshMedia').addEventListener('click', () => refreshMediaLibrary());
  $('btnExit').addEventListener('click', () => { tInvoke('exit_app').catch(() => {}); });
}

$('btnOpenProject').addEventListener('click', (e) => {
  if (!TAURI) return;
  e.preventDefault();
  tInvoke('open_project_page').catch(() => toast('无法打开项目页面'));
});

/* ---------- 性能：页面不可见时全部停摆 ---------- */

document.addEventListener('visibilitychange', () => {
  if (!TAURI) applyBgMode();
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
applyBgMode();
if (TAURI) refreshMediaLibrary({ silent: true });
if (TAURI) {
  tInvoke('get_power_state').then((run) => window.__w11Power(run)).catch(() => {});
  // 防止桌面底层 WebView2 因长期不在前台而冻结/卸载页面。
  navigator.locks?.request('wallpaper11-runtime', () => new Promise(() => {})).catch(() => {});
}

// 调试钩子：?hw=1 直接打开作业板（?music=1 由 player.js 处理）
const debugParams = new URLSearchParams(location.search);
if (debugParams.has('hw')) openHomework();
