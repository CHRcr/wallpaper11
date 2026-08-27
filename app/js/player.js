/* ============================================================
   wallpaper11 · 音乐播放器（自研引擎，替代 APlayer）
   在 main.js 之后加载（共享全局词法绑定：$ / W11_ROLE /
   settings / saveSettings / toast / escapeHtml / apiBase /
   cookieParam / registerOverlayPanel / closeOtherPanels /
   panelClosers / powerHandlers）
   ============================================================ */
'use strict';

/* ---------- 常量与持久化 ---------- */

const MUSIC_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90">' +
  '<rect width="90" height="90" fill="#2b1626"/>' +
  '<path d="M36 57V26l26-5v30" stroke="#ffcf9c" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<circle cx="30" cy="57" r="6.5" fill="#ffcf9c"/><circle cx="56" cy="51" r="6.5" fill="#ffcf9c"/></svg>'
);

const PLAYER_KEY = 'w11-player';

function loadPlayerState() {
  const d = { volume: 0.45, mode: 'list', drawer: '', last: -1, nc: [], removed: [] };
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    return raw ? { ...d, ...JSON.parse(raw) } : d;
  } catch { return d; }
}

const pState = loadPlayerState();
function savePlayerState() {
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(pState)); } catch { /* 忽略 */ }
}

/* ---------- 播放列表数据 ---------- */

let tracks = [];
let localTracks = [];
let cur = -1;                 // 当前曲目下标，-1 = 未加载
let errStreak = 0;            // 连续加载失败计数（防死循环跳歌）
let debugAutoplayPending = new URLSearchParams(location.search).has('autoplay');

function rebuildTracks(keepCur = true) {
  const curTrack = keepCur && cur >= 0 ? tracks[cur] : null;
  const removed = new Set(pState.removed);
  const base = localTracks;
  tracks = base.filter(t => !removed.has(t.url))
    .map(t => ({ name: t.name, artist: t.artist || '', url: t.url, lrc: t.lrc || '', base: true }))
    .concat(pState.nc.map(t => ({ ...t, base: false })));
  if (curTrack) {
    cur = tracks.findIndex(t => t.url === curTrack.url && t.name === curTrack.name);
    if (cur === -1) { audio.removeAttribute('src'); renderMeta(null); renderLrc(''); }
  }
  renderList();
}

function applyMediaLibrary(library) {
  const music = Array.isArray(library && library.music) ? library.music : [];
  localTracks = music.map(t => ({
    name: t.name || '未命名音乐',
    artist: t.artist || '',
    url: t.url || '',
    lrc: t.lrc || '',
  })).filter(t => t.url);
  rebuildTracks();
  if (debugAutoplayPending && tracks.length) {
    debugAutoplayPending = false;
    playIndex(0);
  }
}

document.addEventListener('w11-media-library', (event) => applyMediaLibrary(event.detail));

function resolveUrl(url) {
  // Tauri 下本机绝对路径走自定义协议，支持音频 Range 请求与拖动进度。
  // 普通托管预览仍保留旧的 /stream 兼容入口。
  if (/^file:\/\//i.test(url)) {
    const path = decodeURIComponent(url.replace(/^file:\/\//i, ''));
    if (TAURI) return 'http://w11stream.localhost/audio?path=' + encodeURIComponent(path);
    if (location.protocol === 'http:') return '/stream?path=' + encodeURIComponent(path);
  }
  return url;
}

/* ---------- 歌词解析（合并同时间轴的翻译行） ---------- */

function parseLrc(text) {
  const map = new Map();   // key: 0.1s 精度时间 → { t, txt, sub }
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const times = [];
    let m; re.lastIndex = 0;
    while ((m = re.exec(rawLine))) {
      const frac = m[3] ? Number('0.' + m[3].padEnd(3, '0')) : 0;
      times.push(Number(m[1]) * 60 + Number(m[2]) + frac);
    }
    const txt = rawLine.replace(re, '').trim();
    if (!times.length || !txt) continue;
    for (const t of times) {
      const key = Math.round(t * 10);
      const hit = map.get(key);
      if (hit) { if (!hit.sub && hit.txt !== txt) hit.sub = txt; }
      else map.set(key, { t, txt, sub: '' });
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/* ---------- DOM ---------- */

const musicMask    = $('musicMask');
const musicPanel   = $('musicPanel');
const mpCoverWrap  = $('mpCoverWrap');
const mpCoverState = $('mpCoverState');
const mpCover      = $('mpCover');
const mpSearch     = $('mpSearch');
const mpInput      = $('mpSearchInput');
const mpResults    = $('mpResults');
const mpName       = $('mpName');
const mpArtist     = $('mpArtist');
const mpLrcPeek    = $('mpLrcPeek');
const mpLrc        = $('mpLrc');
const mpLrcInner   = $('mpLrcInner');
const mpLrcEmpty   = $('mpLrcEmpty');
const mpList       = $('mpList');
const mpListOl     = $('mpListOl');
const mpListCount  = $('mpListCount');
const mpListClear  = $('mpListClear');
const mpListRestore = $('mpListRestore');
const mpBar        = $('mpBar');
const mpBuf        = $('mpBuf');
const mpPlayed     = $('mpPlayed');
const mpCurLabel   = $('mpCur');
const mpDurLabel   = $('mpDur');
const mpPlayBtn    = $('mpPlay');
const mpModeBtn    = $('mpMode');
const mpMuteBtn    = $('mpMute');
const mpVolSlider  = $('mpVol');

const audio = new Audio();
audio.preload = 'metadata';

/* ---------- SVG 图标 ---------- */

const icoFill = (body) => '<svg viewBox="0 0 24 24" fill="currentColor">' + body + '</svg>';

const SVG = {
  play:  icoFill('<path d="M8 5.5v13a.8.8 0 0 0 1.22.68l10.5-6.5a.8.8 0 0 0 0-1.36L9.22 4.82A.8.8 0 0 0 8 5.5z"/>'),
  pause: icoFill('<rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/>'),
  prev:  icoFill('<path d="M6 5.8v12.4a.9.9 0 0 0 1.8 0V5.8a.9.9 0 0 0-1.8 0z"/><path d="M19 5.7v12.6a.8.8 0 0 1-1.24.67L8.5 12.7a.8.8 0 0 1 0-1.34l9.26-6.34A.8.8 0 0 1 19 5.7z"/>'),
  next:  icoFill('<path d="M16.2 5.8v12.4a.9.9 0 0 0 1.8 0V5.8a.9.9 0 0 0-1.8 0z"/><path d="M5 5.7v12.6a.8.8 0 0 0 1.24.67l9.26-6.33a.8.8 0 0 0 0-1.34L6.24 5.02A.8.8 0 0 0 5 5.7z"/>'),
  volOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19V5z" fill="currentColor" stroke="none"/><path d="M15 9.5a4 4 0 0 1 0 5"/><path d="M17.5 7a8 8 0 0 1 0 10"/></svg>',
  volOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19V5z" fill="currentColor" stroke="none"/><path d="m15.5 9.5 5 5m0-5-5 5"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.5 21 6.5l-4 4"/><path d="M3 12V9.5a3 3 0 0 1 3-3h15"/><path d="m7 21.5-4-4 4-4"/><path d="M21 12v2.5a3 3 0 0 1-3 3H3"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5c5 0 6 10 11 10H21"/><path d="M3 17h3.5c1.9 0 3.2-1.8 4.3-3.5"/><path d="M13.2 9.6c1-1.5 2.3-2.6 4.3-2.6H21"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>',
};

function loopOneIcon() {
  return SVG.loop.replace('</svg>',
    '<text x="12" y="15.5" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none" font-family="Bahnschrift, sans-serif">1</text></svg>');
}

const MODE_NEXT  = { list: 'one', one: 'rand', rand: 'list' };
const MODE_LABEL = { list: '列表循环', one: '单曲循环', rand: '随机播放' };

/* ---------- 小工具 ---------- */

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

/* ---------- 播放控制 ---------- */

function playIndex(i, autoplay = true) {
  if (i < 0 || i >= tracks.length) return;
  cur = i;
  pState.last = i; savePlayerState();
  const t = tracks[i];
  audio.src = resolveUrl(t.url);
  renderMeta(t);
  renderLrc(t.lrc);
  renderList();
  if (autoplay) audio.play().catch(() => {});
}

function togglePlay() {
  if (cur === -1) { if (tracks.length) playIndex(0); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

function nextTrack(manual = true) {
  if (!tracks.length) return;
  if (pState.mode === 'rand') {
    if (tracks.length === 1) { playIndex(0); return; }
    let i; do { i = Math.floor(Math.random() * tracks.length); } while (i === cur);
    playIndex(i);
  } else {
    const i = cur + 1;
    if (i >= tracks.length) {
      if (manual || pState.mode === 'list') playIndex(0);
    } else playIndex(i);
  }
}

function prevTrack() {
  if (!tracks.length) return;
  if (audio.currentTime > 4 && cur >= 0) { audio.currentTime = 0; return; }
  playIndex((cur - 1 + tracks.length) % tracks.length);
}

audio.addEventListener('ended', () => {
  errStreak = 0;
  if (pState.mode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); }
  else nextTrack(false);
});

audio.addEventListener('error', () => {
  runtimeLog('audio error code=' + (audio.error ? audio.error.code : 0) + ' src=' + audio.currentSrc);
  if (cur === -1 || !audio.src) return;
  const name = tracks[cur] ? tracks[cur].name : '';
  if (++errStreak >= 3) { errStreak = 0; toast('多首播放失败，先检查音乐文件'); return; }
  toast('无法播放：' + name);
  setTimeout(() => nextTrack(false), 800);
});
audio.addEventListener('playing', () => { errStreak = 0; });
audio.addEventListener('playing', () => runtimeLog('audio playing src=' + audio.currentSrc));

/* ---------- 渲染：曲目信息 / 播放状态 ---------- */

function renderMeta(t) {
  if (!t) {
    mpName.textContent = '未在播放';
    mpArtist.textContent = '—';
    mpLrcPeek.textContent = '选择一首歌开始播放';
    mpCover.src = MUSIC_COVER;
    document.title = 'wallpaper11';
    return;
  }
  mpName.textContent = t.name;
  mpName.title = t.name;
  mpArtist.textContent = t.artist || '未知艺术家';
  mpArtist.title = t.artist;
  mpCover.src = t.cover || MUSIC_COVER;
  document.title = t.name + ' - ' + (t.artist || '') + ' · wallpaper11';
}

function renderPlayState() {
  const playing = !audio.paused && !audio.ended;
  mpPlayBtn.innerHTML = playing ? SVG.pause : SVG.play;
  mpPlayBtn.title = playing ? '暂停' : '播放';
  mpCoverState.innerHTML = playing ? SVG.pause : SVG.play;
  musicPanel.classList.toggle('playing', playing);
}
audio.addEventListener('play', renderPlayState);
audio.addEventListener('pause', renderPlayState);

/* ---------- 渲染：歌词 ---------- */

let lrcLines = [];    // [{ t, txt, sub }]
let lrcIdx = -1;
let lrcPeekTimer = null;

function renderLrc(text) {
  lrcLines = parseLrc(text);
  lrcIdx = -1;
  if (!lrcLines.length) {
    mpLrcInner.innerHTML = '';
    mpLrcEmpty.hidden = false;
    mpLrcEmpty.textContent = cur >= 0 ? '暂无歌词' : '';
    mpLrcPeek.textContent = cur >= 0 ? '暂无歌词' : '选择一首歌开始播放';
    return;
  }
  mpLrcEmpty.hidden = true;
  mpLrcPeek.textContent = '等待歌词…';
  mpLrcInner.innerHTML = lrcLines.map((l, i) =>
    '<div class="mp-line" data-i="' + i + '"><span class="l1">' +
    escapeHtml(l.txt) + '</span>' +
    (l.sub ? '<span class="l2">' + escapeHtml(l.sub) + '</span>' : '') +
    '</div>').join('');
}

function currentLrcIndex(t) {
  let lo = 0, hi = lrcLines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lrcLines[mid].t <= t + 0.05) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function syncLrc(t) {
  if (!lrcLines.length) return;
  const i = currentLrcIndex(t);
  if (i === lrcIdx) return;
  const prev = mpLrcInner.querySelector('.mp-line.cur');
  if (prev) prev.classList.remove('cur');
  lrcIdx = i;
  if (i < 0) { mpLrcInner.style.transform = 'translateY(0px)'; return; }
  const el = mpLrcInner.children[i];
  if (!el) return;
  el.classList.add('cur');
  mpLrcPeek.classList.add('changing');
  clearTimeout(lrcPeekTimer);
  lrcPeekTimer = setTimeout(() => {
    if (lrcIdx !== i) {
      mpLrcPeek.classList.remove('changing');
      return;
    }
    const line = lrcLines[i];
    mpLrcPeek.textContent = line.sub ? line.txt + ' · ' + line.sub : line.txt;
    mpLrcPeek.classList.remove('changing');
  }, 150);
  const target = mpLrc.clientHeight / 2 - el.offsetTop - el.offsetHeight / 2;
  mpLrcInner.style.transform = 'translateY(' + target + 'px)';
}

mpLrc.addEventListener('click', (e) => {
  const line = e.target.closest('.mp-line');
  if (!line) return;
  const i = Number(line.dataset.i);
  if (lrcLines[i]) { audio.currentTime = lrcLines[i].t + 0.01; if (audio.paused) audio.play().catch(() => {}); }
});

/* ---------- 渲染：播放列表 ---------- */

function renderList() {
  mpListCount.textContent = tracks.length;
  mpListRestore.hidden = pState.removed.length === 0;
  if (!tracks.length) {
    mpListOl.innerHTML = '<li class="mp-empty">歌单为空<br>把音乐拷入媒体文件夹后，<br>在设置里点“刷新媒体”</li>';
    return;
  }
  mpListOl.innerHTML = tracks.map((t, i) =>
    '<li class="mp-item' + (i === cur ? ' playing' : '') + '" data-i="' + i + '">' +
    '<span class="mp-item-idx">' + (i + 1) + '</span>' +
    '<span class="mp-item-text"><span class="t">' + escapeHtml(t.name) + '</span>' +
    '<span class="a">' + escapeHtml(t.artist || '未知艺术家') + '</span></span>' +
    '<span class="mp-item-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
    '<button class="mp-item-del" title="从列表移除">&#10005;</button>' +
    '</li>').join('');
  const playingRow = mpListOl.querySelector('.mp-item.playing');
  if (playingRow) {
    const listH = mpListOl.clientHeight;
    if (playingRow.offsetTop < mpListOl.scrollTop ||
        playingRow.offsetTop > mpListOl.scrollTop + listH - 60) {
      mpListOl.scrollTop = playingRow.offsetTop - listH / 2;
    }
  }
}

mpListOl.addEventListener('click', (e) => {
  const del = e.target.closest('.mp-item-del');
  const row = e.target.closest('.mp-item');
  if (!row) return;
  const i = Number(row.dataset.i);
  if (del) { removeTrack(i); return; }
  playIndex(i);
});

function removeTrack(i) {
  const t = tracks[i];
  if (!t) return;
  if (t.base) pState.removed.push(t.url);
  else pState.nc = pState.nc.filter(x => !(x.ncid === t.ncid));
  savePlayerState();
  const wasCur = i === cur;
  const wasPlaying = !audio.paused;
  if (wasCur) { audio.pause(); audio.removeAttribute('src'); }
  rebuildTracks(!wasCur);
  if (wasCur) {
    cur = -1; renderMeta(null); renderLrc(''); renderPlayState();
    mpCurLabel.textContent = '0:00'; mpDurLabel.textContent = '0:00';
    mpPlayed.style.width = '0%';
    if (wasPlaying && tracks.length) playIndex(Math.min(i, tracks.length - 1));
  }
  toast('已移除：' + t.name);
}

/* 清空：第一次点击变确认态，2.5s 内再点确认 */
let clearArmed = null;
mpListClear.addEventListener('click', () => {
  if (clearArmed) {
    clearTimeout(clearArmed); clearArmed = null;
    mpListClear.textContent = '清空';
    mpListClear.classList.remove('arming');
    pState.removed = tracks.filter(t => t.base).map(t => t.url)
      .concat(pState.removed.filter(u => !tracks.some(t => t.base && t.url === u)));
    pState.nc = [];
    savePlayerState();
    audio.pause(); audio.removeAttribute('src');
    cur = -1; rebuildTracks(false);
    renderMeta(null); renderLrc(''); renderPlayState();
    mpCurLabel.textContent = '0:00'; mpDurLabel.textContent = '0:00';
    mpPlayed.style.width = '0%';
    toast('播放列表已清空');
    return;
  }
  mpListClear.textContent = '确认清空？';
  mpListClear.classList.add('arming');
  clearArmed = setTimeout(() => {
    clearArmed = null;
    mpListClear.textContent = '清空';
    mpListClear.classList.remove('arming');
  }, 2500);
});

mpListRestore.addEventListener('click', () => {
  pState.removed = [];
  savePlayerState();
  rebuildTracks();
  toast('已恢复完整歌单');
});

/* ---------- 进度条（可拖拽，触屏友好） ---------- */

let seeking = false;

function seekFracFromEvent(e) {
  const r = mpBar.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
}

mpBar.addEventListener('pointerdown', (e) => {
  if (!isFinite(audio.duration)) return;
  seeking = true;
  mpBar.classList.add('drag');
  mpBar.setPointerCapture(e.pointerId);
  updateSeekUi(seekFracFromEvent(e));
  e.preventDefault();
});
mpBar.addEventListener('pointermove', (e) => { if (seeking) updateSeekUi(seekFracFromEvent(e)); });
mpBar.addEventListener('pointerup', (e) => {
  if (!seeking) return;
  seeking = false;
  mpBar.classList.remove('drag');
  audio.currentTime = seekFracFromEvent(e) * audio.duration;
});
mpBar.addEventListener('pointercancel', () => { seeking = false; mpBar.classList.remove('drag'); });

function updateSeekUi(frac) {
  mpPlayed.style.width = (frac * 100) + '%';
  mpCurLabel.textContent = fmtTime(frac * (audio.duration || 0));
}

audio.addEventListener('timeupdate', () => {
  if (seeking) return;
  const d = audio.duration;
  if (isFinite(d) && d > 0) {
    mpPlayed.style.width = (audio.currentTime / d * 100) + '%';
    mpCurLabel.textContent = fmtTime(audio.currentTime);
    syncLrc(audio.currentTime);
  }
});

audio.addEventListener('durationchange', () => {
  mpDurLabel.textContent = fmtTime(audio.duration);
});

audio.addEventListener('progress', () => {
  try {
    const d = audio.duration;
    if (isFinite(d) && audio.buffered.length) {
      mpBuf.style.width = (audio.buffered.end(audio.buffered.length - 1) / d * 100) + '%';
    }
  } catch { /* 忽略 */ }
});

/* ---------- 控制按钮：模式 / 上下首 / 音量 / 卡片抽屉 ---------- */

function renderMode() {
  mpModeBtn.innerHTML = pState.mode === 'rand' ? SVG.shuffle
    : pState.mode === 'one' ? loopOneIcon() : SVG.loop;
  mpModeBtn.title = MODE_LABEL[pState.mode];
}

mpModeBtn.addEventListener('click', () => {
  pState.mode = MODE_NEXT[pState.mode];
  savePlayerState(); renderMode(); toast(MODE_LABEL[pState.mode]);
});

mpPlayBtn.addEventListener('click', togglePlay);
$('mpPrev').addEventListener('click', prevTrack);
$('mpNext').addEventListener('click', () => nextTrack(true));
mpCoverWrap.addEventListener('click', togglePlay);

function renderVolume() {
  const v = audio.muted ? 0 : audio.volume;
  mpVolSlider.value = Math.round(v * 100);
  mpMuteBtn.innerHTML = (v === 0) ? SVG.volOff : SVG.volOn;
  mpMuteBtn.title = audio.muted ? '取消静音' : '静音';
}

mpVolSlider.addEventListener('input', () => {
  audio.volume = Number(mpVolSlider.value) / 100;
  audio.muted = audio.volume === 0;
  pState.volume = audio.volume;
  savePlayerState(); renderVolume();
});

mpMuteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  renderVolume();
});

function setDrawer(view) {
  pState.drawer = pState.drawer === view ? '' : view;
  savePlayerState();
  applyDrawer();
  if (pState.drawer === 'lyrics') {
    // 抽屉关闭时歌词容器高度为 0，展开后强制重算一次居中位置。
    lrcIdx = -1;
    setTimeout(() => syncLrc(audio.currentTime), 30);
  }
}

$('mpLyricsToggle').addEventListener('click', () => setDrawer('lyrics'));
$('mpListToggle').addEventListener('click', () => setDrawer('list'));

function applyDrawer() {
  const open = pState.drawer === 'lyrics' || pState.drawer === 'list';
  musicPanel.classList.toggle('drawer-open', open);
  musicPanel.classList.toggle('show-lyrics', pState.drawer === 'lyrics');
  musicPanel.classList.toggle('show-list', pState.drawer === 'list');
  $('mpLyricsToggle').classList.toggle('active', pState.drawer === 'lyrics');
  $('mpListToggle').classList.toggle('active', pState.drawer === 'list');
  syncMusicOverlaySize();
}

function syncMusicOverlaySize() {
  if (musicMask.hidden) return;
  const expanded = musicPanel.classList.contains('drawer-open') ||
    musicPanel.classList.contains('search-open');
  registerOverlayPanel(expanded ? 'music-expanded' : 'music');
}

/* ---------- 面板开关 ---------- */

function openMusic() {
  if (W11_ROLE === 'wallpaper') return;    // 壁纸层无面板
  if (!musicMask.hidden) return;
  closeOtherPanels(musicMask);
  musicMask.hidden = false;
  syncMusicOverlaySize();
  if (cur === -1 && pState.last >= 0 && pState.last < tracks.length) {
    playIndex(pState.last, false);   // 恢复上次曲目但不自动播放
  }
}
function closeMusic() {
  if (musicMask.hidden) return;
  musicMask.hidden = true;
  toggleMusicSearch(false);
  registerOverlayPanel(null);
}

panelClosers.push({ el: musicMask, close: closeMusic });

$('btnMusic').addEventListener('click', () => musicMask.hidden ? openMusic() : closeMusic());
$('musicClose').addEventListener('click', closeMusic);
musicMask.addEventListener('click', (e) => { if (e.target === musicMask) closeMusic(); });

// Esc：先关搜索浮层，再关面板
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!mpSearch.hidden) { toggleMusicSearch(false); return; }
  if (!musicMask.hidden) closeMusic();
});

/* ---------- 网易云搜索（经本地 NeteaseCloudMusicApi 代理） ---------- */

let searchTimer = null;
let lastResults = [];

function toggleMusicSearch(open) {
  const target = open !== undefined ? open : mpSearch.hidden;
  mpSearch.hidden = !target;
  musicPanel.classList.toggle('search-open', target);
  syncMusicOverlaySize();
  if (target) mpInput.focus();
  else { mpInput.value = ''; mpResults.innerHTML = ''; lastResults = []; }
}

$('musicSearchBtn').addEventListener('click', () => toggleMusicSearch());
$('mpSearchBack').addEventListener('click', () => toggleMusicSearch(false));

mpInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const kw = mpInput.value.trim();
  if (!kw) { mpResults.innerHTML = ''; lastResults = []; return; }
  searchTimer = setTimeout(() => searchNetease(kw), 450);
});
mpInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { clearTimeout(searchTimer); searchNetease(mpInput.value.trim()); }
});

async function searchNetease(kw) {
  if (!kw) return;
  mpResults.innerHTML = '<div class="mp-tip">搜索中…</div>';
  try {
    const r = await fetch(apiBase() + '/cloudsearch?keywords=' +
      encodeURIComponent(kw) + '&limit=20' + cookieParam());
    const j = await r.json();
    lastResults = (j.result && j.result.songs) || [];
    if (!lastResults.length) {
      mpResults.innerHTML = '<div class="mp-tip">没有找到</div>';
      return;
    }
    mpResults.innerHTML = lastResults.map((s, i) => {
      const pic = s.al && s.al.picUrl
        ? s.al.picUrl.replace(/^http:/, 'https:') + '?param=44y44' : MUSIC_COVER;
      return '<div class="mp-result" data-i="' + i + '">' +
        '<img src="' + pic + '" alt="" loading="lazy" draggable="false">' +
        '<div class="r-text">' +
        '<div class="r-name">' + escapeHtml(s.name) + '</div>' +
        '<div class="r-artist">' + escapeHtml((s.ar || []).map(a => a.name).join(' / ')) + '</div>' +
        '</div></div>';
    }).join('');
  } catch {
    mpResults.innerHTML = '<div class="mp-tip">连不上 API 代理<br>先运行 tools/netease-api/start.bat</div>';
  }
}

mpResults.addEventListener('click', (e) => {
  const row = e.target.closest('.mp-result');
  if (!row) return;
  const song = lastResults[Number(row.dataset.i)];
  if (song) playNetease(song);
});

async function playNetease(song) {
  toast('获取播放地址…');
  try {
    const [u, l] = await Promise.all([
      fetch(apiBase() + '/song/url/v1?id=' + song.id + '&level=lossless' + cookieParam()).then(r => r.json()),
      fetch(apiBase() + '/lyric?id=' + song.id + cookieParam()).then(r => r.json()).catch(() => null),
    ]);
    const d = u.data && u.data[0];
    if (!d || !d.url) { toast('拿不到播放地址：VIP 歌曲请在设置里填 Cookie'); return; }
    const track = {
      name: song.name,
      artist: (song.ar || []).map(a => a.name).join(' / '),
      url: d.url.replace(/^http:/, 'https:'),
      cover: song.al && song.al.picUrl
        ? song.al.picUrl.replace(/^http:/, 'https:') + '?param=120y120' : '',
      lrc: (l && l.lrc && l.lrc.lyric) || '',
      ncid: song.id,
    };
    pState.nc = pState.nc.filter(x => x.ncid !== song.id);
    pState.nc.push({ name: track.name, artist: track.artist, url: track.url,
      cover: track.cover, lrc: track.lrc, ncid: track.ncid });
    savePlayerState();
    rebuildTracks();
    const idx = tracks.findIndex(t => t.ncid === song.id);
    if (idx >= 0) playIndex(idx);
    toggleMusicSearch(false);
  } catch { toast('播放失败'); }
}

/* ---------- 省电：宿主要求暂停/恢复（全屏程序时静音） ---------- */

let powerWasPlaying = false;

powerHandlers.push((run) => {
  if (!run) {
    powerWasPlaying = !audio.paused && !audio.ended;
    if (powerWasPlaying) audio.pause();
  } else if (powerWasPlaying) {
    powerWasPlaying = false;
    audio.play().catch(() => {});
  }
});
if (!window.__w11PowerRunning()) powerHandlers[powerHandlers.length - 1](false);

/* ---------- 初始化 ---------- */

$('mpPrev').innerHTML = SVG.prev;
$('mpNext').innerHTML = SVG.next;
$('mpListToggle').innerHTML = SVG.list;
renderMode();
applyDrawer();
audio.volume = pState.volume;
renderVolume();
if (window.W11_MEDIA_LIBRARY) applyMediaLibrary(window.W11_MEDIA_LIBRARY);
rebuildTracks(false);
renderMeta(null);
renderLrc('');
renderPlayState();

/* 调试钩子：?music=1 直接打开面板 */
if (new URLSearchParams(location.search).has('music')) openMusic();
