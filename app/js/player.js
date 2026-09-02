/* ============================================================
   wallpaper11 · 音乐播放器（自研引擎，替代 APlayer）
   在 main.js 之后加载（共享全局词法绑定：$ /
   settings / saveSettings / toast / escapeHtml / apiBase /
   cookieParam / closeOtherPanels / panelClosers / powerHandlers）
   ============================================================ */
'use strict';

/* ---------- 常量与持久化 ---------- */

const MUSIC_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<rect width="24" height="24" fill="#2b1626"/>' +
  '<g stroke="#ffcf9c" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M9 18V5l12-2v13"/></g>' +
  '<circle cx="6" cy="18" r="3" fill="#ffcf9c"/><circle cx="18" cy="16" r="3" fill="#ffcf9c"/></svg>'
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
let playRequest = 0;          // 防止连续点歌时较慢的旧请求覆盖新曲目
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
  // Lively WebView2 直接读取壁纸项目内的相对媒体路径。
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
const mpListPageUp = $('mpListPageUp');
const mpListPageDown = $('mpListPageDown');
const mpSearchPaste = $('mpSearchPaste');
const mpResultsPageUp = $('mpResultsPageUp');
const mpResultsPageDown = $('mpResultsPageDown');
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

/* ---------- SVG 图标（Lucide） ---------- */

const ico = (body) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';

const SVG = {
  play:  ico('<path d="M6 3l14 9-14 9V3z"/>'),
  pause: ico('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  prev:  ico('<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>'),
  next:  ico('<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>'),
  volOn: ico('<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>'),
  volOff: ico('<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>'),
  loop:  ico('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  loopOne: ico('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>'),
  shuffle: ico('<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>'),
  list:  ico('<path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/>'),
};

const MODE_NEXT  = { list: 'one', one: 'rand', rand: 'list' };
const MODE_LABEL = { list: '列表循环', one: '单曲循环', rand: '随机播放' };

/* ---------- 小工具 ---------- */

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

/* ---------- 播放控制 ---------- */

async function playIndex(i, autoplay = true) {
  if (i < 0 || i >= tracks.length) return;
  const request = ++playRequest;
  cur = i;
  pState.last = i; savePlayerState();
  const t = tracks[i];
  audio.pause();
  audio.removeAttribute('src');
  renderMeta(t);
  renderLrc(t.lrc);
  renderList();

  if (t.ncid) {
    toast('正在获取网易云播放地址…');
    try {
      await refreshNeteaseTrack(t);
      if (request !== playRequest) return;
      renderLrc(t.lrc);
    } catch {
      if (request !== playRequest) return;
      if (!t.url) {
        toast(settings.musicCookie ? 'Cookie 无效或歌曲不可用' : 'VIP 歌曲需要 Cookie');
        return;
      }
      toast('直链刷新失败，尝试缓存地址');
    }
  }

  if (request !== playRequest || !t.url) return;
  audio.src = resolveUrl(t.url);
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
    mpListOl.innerHTML = '<li class="mp-empty">歌单为空<br>把音乐放入 local-music 后，<br>运行 npm run media</li>';
    updateListPageButtons();
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
  requestAnimationFrame(updateListPageButtons);
}

function updateListPageButtons() {
  const max = Math.max(0, mpListOl.scrollHeight - mpListOl.clientHeight);
  mpListPageUp.disabled = mpListOl.scrollTop <= 1;
  mpListPageDown.disabled = max <= 1 || mpListOl.scrollTop >= max - 1;
}

function scrollListPage(direction) {
  const distance = Math.max(160, Math.round(mpListOl.clientHeight * 0.78));
  mpListOl.scrollBy({ top: direction * distance, behavior: 'smooth' });
}

mpListPageUp.addEventListener('click', () => scrollListPage(-1));
mpListPageDown.addEventListener('click', () => scrollListPage(1));
mpListOl.addEventListener('scroll', updateListPageButtons, { passive: true });

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
    : pState.mode === 'one' ? SVG.loopOne : SVG.loop;
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
  if (pState.drawer === 'list') requestAnimationFrame(updateListPageButtons);
}

/* ---------- 面板开关 ---------- */

function openMusic() {
  if (!musicMask.hidden) return;
  closeOtherPanels(musicMask);
  musicMask.hidden = false;
  if (cur === -1 && pState.last >= 0 && pState.last < tracks.length) {
    playIndex(pState.last, false);   // 恢复上次曲目但不自动播放
  }
}
function closeMusic() {
  if (musicMask.hidden) return;
  musicMask.hidden = true;
  toggleMusicSearch(false);
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

/* ---------- 网易云搜索（经本地 Music Bridge） ---------- */

let lastResults = [];

function toggleMusicSearch(open) {
  const target = open !== undefined ? open : mpSearch.hidden;
  mpSearch.hidden = !target;
  musicPanel.classList.toggle('search-open', target);
  if (!target) {
    mpInput.value = '';
    mpResults.innerHTML = '';
    lastResults = [];
    updateResultsPageButtons();
  }
}

$('musicSearchBtn').addEventListener('click', () => toggleMusicSearch());
$('mpSearchBack').addEventListener('click', () => toggleMusicSearch(false));
mpSearchPaste.addEventListener('click', async () => {
  const result = await readClipboardTextFromUserGesture();
  const keyword = String(result.text || '').trim();
  if (!result.allowed) {
    toast('剪贴板不可用，请确认 Music Bridge 已连接');
    return;
  }
  if (!keyword) {
    toast('剪贴板是空的');
    return;
  }
  mpInput.value = keyword;
  searchNetease(keyword);
});

function updateResultsPageButtons() {
  const max = Math.max(0, mpResults.scrollHeight - mpResults.clientHeight);
  mpResultsPageUp.disabled = mpResults.scrollTop <= 1;
  mpResultsPageDown.disabled = max <= 1 || mpResults.scrollTop >= max - 1;
}

function scrollResultsPage(direction) {
  const distance = Math.max(160, Math.round(mpResults.clientHeight * 0.78));
  mpResults.scrollBy({ top: direction * distance, behavior: 'smooth' });
}

mpResultsPageUp.addEventListener('click', () => scrollResultsPage(-1));
mpResultsPageDown.addEventListener('click', () => scrollResultsPage(1));
mpResults.addEventListener('scroll', updateResultsPageButtons, { passive: true });

async function searchNetease(kw) {
  if (!kw) return;
  mpResults.scrollTop = 0;
  mpResults.innerHTML = '<div class="mp-tip">搜索中…</div>';
  updateResultsPageButtons();
  try {
    const r = await fetch(apiBase() + '/cloudsearch?keywords=' +
      encodeURIComponent(kw) + '&limit=20' + cookieParam());
    const j = await r.json();
    lastResults = (j.result && j.result.songs) || [];
    if (!lastResults.length) {
      mpResults.innerHTML = '<div class="mp-tip">没有找到</div>';
      updateResultsPageButtons();
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
    requestAnimationFrame(updateResultsPageButtons);
  } catch {
    mpResults.innerHTML = '<div class="mp-tip">Music Bridge 未运行<br>请先完成网易云组件安装</div>';
    updateResultsPageButtons();
  }
}

mpResults.addEventListener('click', (e) => {
  const row = e.target.closest('.mp-result');
  if (!row) return;
  const song = lastResults[Number(row.dataset.i)];
  if (song) playNetease(song);
});

async function fetchNeteaseMedia(id) {
  const urlRequest = fetch(apiBase() + '/song/url/v1?id=' + id +
    '&level=lossless' + cookieParam()).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body && body.message || '播放地址请求失败');
    return body;
  });
  const lyricRequest = fetch(apiBase() + '/lyric?id=' + id + cookieParam())
    .then(response => response.ok ? response.json() : null).catch(() => null);
  const [urlData, lyricData] = await Promise.all([urlRequest, lyricRequest]);
  const media = urlData.data && urlData.data[0];
  if (!media || !media.url) throw new Error('没有可用的播放地址');
  return {
    url: media.url.replace(/^http:/, 'https:'),
    lrc: (lyricData && lyricData.lrc && lyricData.lrc.lyric) || '',
  };
}

async function refreshNeteaseTrack(track) {
  const media = await fetchNeteaseMedia(track.ncid);
  track.url = media.url;
  track.lrc = media.lrc;
  const saved = pState.nc.find(item => item.ncid === track.ncid);
  if (saved) {
    saved.url = media.url;
    saved.lrc = media.lrc;
    savePlayerState();
  }
}

function playNetease(song) {
  const track = {
    name: song.name,
    artist: (song.ar || []).map(a => a.name).join(' / '),
    url: '',
    cover: song.al && song.al.picUrl
      ? song.al.picUrl.replace(/^http:/, 'https:') + '?param=120y120' : '',
    lrc: '',
    ncid: song.id,
  };
  pState.nc = pState.nc.filter(x => x.ncid !== song.id);
  pState.nc.push(track);
  savePlayerState();
  rebuildTracks();
  const idx = tracks.findIndex(t => t.ncid === song.id);
  toggleMusicSearch(false);
  if (idx >= 0) playIndex(idx);
}

/* ---------- 省电：Lively 暂停/恢复壁纸时同步音乐 ---------- */

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
