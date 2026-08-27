'use strict'

// Local-only bridge between the Lively web wallpaper and NetEase Cloud Music.
// Only the endpoints used by wallpaper11 are exposed.

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { execFile, spawn } = require('node:child_process')
const {
  cloudsearch,
  // The v1 endpoint currently requires a separately provisioned XEAPI key.
  // The compatible song_url module still accepts MUSIC_U and needs no key.
  song_url: songUrl,
  lyric,
  login_status: loginStatus,
} = require('@neteasecloudmusicapienhanced/api')

const HOST = '127.0.0.1'
const PORT = Number.parseInt(process.env.WALLPAPER11_MUSIC_PORT || '16311', 10)
const PID_FILE = path.join(__dirname, 'bridge.pid')
const MANAGE_TOKEN = randomBytes(24).toString('hex')
const LOCAL_ORIGIN = `http://${HOST}:${PORT}`
const APP_DATA_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'wallpaper11') : __dirname
const MUSIC_COOKIE_FILE = path.join(APP_DATA_DIR, 'music-cookie.txt')

const routes = new Map([
  ['/cloudsearch', cloudsearch],
  ['/song/url/v1', songUrl],
  ['/lyric', lyric],
  ['/login/status', loginStatus],
])

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function sendJson(res, statusCode, value) {
  setCommonHeaders(res)
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function sendPrivateJson(res, statusCode, value) {
  res.setHeader('Cache-Control', 'no-store')
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function sendHtml(res, value) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'")
  res.setHeader('X-Frame-Options', 'DENY')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(value)
}

function queryParams(url) {
  const params = Object.fromEntries(url.searchParams.entries())
  if (params.cookie && !params.cookie.includes('=')) {
    params.cookie = `MUSIC_U=${params.cookie}`
  }
  if (!params.cookie) params.cookie = readStoredMusicCookie()
  return params
}

function readStoredMusicCookie() {
  try { return fs.readFileSync(MUSIC_COOKIE_FILE, 'utf8').trim() } catch { return '' }
}

function normalizeMusicCookie(value) {
  const text = String(value || '').trim()
  const pair = text.match(/(?:^|[;\s])MUSIC_U=([^;\s]+)/i)
  if (pair) return `MUSIC_U=${pair[1]}`
  if (text.length >= 20 && !/[;\r\n\s]/.test(text)) return `MUSIC_U=${text}`
  return ''
}

function readWindowsClipboard() {
  const command = '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Get-Clipboard -Raw'
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8', maxBuffer: 64 * 1024, timeout: 5000, windowsHide: true,
    }, (error, stdout) => error ? reject(error) : resolve(stdout || ''))
  })
}

function isWallpaperRequest(req) {
  const origin = req.headers.origin || ''
  return !origin || origin === 'null' || origin === LOCAL_ORIGIN
}

async function handleCookieControl(req, res, url) {
  setCommonHeaders(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (!isWallpaperRequest(req)) {
    sendJson(res, 403, { code: 403, message: 'Invalid wallpaper origin' })
    return
  }
  if (url.pathname === '/cookie/status' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, configured: Boolean(readStoredMusicCookie()) })
    return
  }
  if (url.pathname === '/cookie/paste' && req.method === 'POST') {
    try {
      const cookie = normalizeMusicCookie(await readWindowsClipboard())
      if (!cookie) {
        sendJson(res, 422, { code: 422, message: '剪贴板中没有有效的 MUSIC_U' })
        return
      }
      fs.mkdirSync(APP_DATA_DIR, { recursive: true })
      fs.writeFileSync(MUSIC_COOKIE_FILE, cookie, { encoding: 'utf8', mode: 0o600 })
      sendJson(res, 200, { ok: true, configured: true, message: 'Cookie 已保存到 Music Bridge' })
    } catch {
      sendJson(res, 500, { code: 500, message: '无法读取 Windows 剪贴板' })
    }
    return
  }
  if (url.pathname === '/cookie/clear' && req.method === 'POST') {
    try { fs.rmSync(MUSIC_COOKIE_FILE, { force: true }) } catch { /* Already clear. */ }
    sendJson(res, 200, { ok: true, configured: false, message: 'Cookie 已清空' })
    return
  }
  sendJson(res, 405, { code: 405, message: 'Method not allowed' })
}

function responseStatus(value) {
  const status = Number(value)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 200
}

function managementPage() {
  const canUninstall = fs.existsSync(path.join(__dirname, 'uninstall.ps1'))
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>wallpaper11 Music Bridge</title><style>
:root{color-scheme:dark;font-family:"Segoe UI","Microsoft YaHei",sans-serif;background:#170f19;color:#fff8ef}
body{min-height:100vh;margin:0;display:grid;place-items:center;background:radial-gradient(circle at 70% 20%,#513343 0,transparent 42%),#170f19}
main{width:min(440px,calc(100vw - 36px));padding:28px;border:1px solid #ffffff1f;border-radius:24px;background:#392637e8;box-shadow:0 24px 70px #0008}
h1{margin:0 0 8px;font-size:24px}p{margin:8px 0;color:#d8c6ca;line-height:1.65}.status{display:flex;align-items:center;gap:9px;margin:22px 0;padding:14px;border-radius:14px;background:#ffffff0d}.dot{width:10px;height:10px;border-radius:50%;background:#8ee6a3;box-shadow:0 0 12px #8ee6a3}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}button{min-height:44px;padding:0 16px;border:1px solid #ffcf9c55;border-radius:11px;background:#fff1df12;color:#fff8ef;font:inherit;cursor:pointer}button:hover{background:#fff1df20}button:disabled{cursor:default;opacity:.45}.danger{border-color:#ff9c9c55;color:#ffc4c4}small{display:block;margin-top:18px;color:#a9959d}#message{min-height:24px;color:#ffcf9c}.progress{height:8px;overflow:hidden;border-radius:999px;background:#ffffff12}.progress>i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#f2a7b3,#ffcf9c);box-shadow:0 0 14px #ffcf9c66;transition:width .35s ease}.status.stopped .dot{background:#a9959d;box-shadow:none}[hidden]{display:none!important}
</style></head><body><main><h1>Music Bridge</h1><p>wallpaper11 的本机网易云组件</p><div class="status" id="status"><span class="dot"></span><span id="statusText">运行中 · ${require('./package.json').version}</span></div><p id="message"></p><div class="progress" id="progress" role="progressbar" aria-label="卸载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i id="progressBar"></i></div><div class="actions"><button id="openLog">打开日志目录</button>${canUninstall ? '<button class="danger" id="uninstall">卸载组件</button>' : ''}</div><small>只监听 127.0.0.1，不接受局域网连接。</small></main><script>
const token='${MANAGE_TOKEN}',message=document.getElementById('message'),progress=document.getElementById('progress'),progressBar=document.getElementById('progressBar'),status=document.getElementById('status'),statusText=document.getElementById('statusText'),openLog=document.getElementById('openLog');
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
function setProgress(value,text){const safe=Math.max(0,Math.min(100,value));progress.hidden=false;progressBar.style.width=safe+'%';progress.setAttribute('aria-valuenow',String(safe));message.textContent=text;}
async function action(name){const response=await fetch('/manage/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const body=await response.json();if(!response.ok)throw new Error(body.message||'操作失败');return body;}
openLog.onclick=()=>action('open-log').then(body=>message.textContent=body.message||'已打开').catch(error=>message.textContent=error.message);
async function waitForShutdown(){let value=28;const deadline=Date.now()+15000;while(Date.now()<deadline){await delay(350);try{const response=await fetch('/health?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw new Error('offline');value=Math.min(82,value+4);setProgress(value,'正在停止服务…');}catch{setProgress(90,'正在清理文件和自启项…');await delay(900);setProgress(100,'卸载完成，可以关闭此页面。');status.classList.add('stopped');statusText.textContent='已停止';return;}}setProgress(88,'卸载程序仍在处理，请稍候或关闭页面。');}
const uninstall=document.getElementById('uninstall');if(uninstall)uninstall.onclick=async()=>{if(!confirm('确定卸载 Music Bridge？'))return;uninstall.disabled=true;openLog.disabled=true;setProgress(8,'正在提交卸载请求…');try{const body=await action('uninstall');setProgress(28,body.message||'正在卸载…');await waitForShutdown();}catch(error){progress.hidden=true;message.textContent=error.message;uninstall.disabled=false;openLog.disabled=false;}};
</script></body></html>`
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 4096) reject(new Error('Request is too large'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

async function handleManagement(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/manage') {
    sendHtml(res, managementPage())
    return
  }

  if (req.method !== 'POST') {
    sendPrivateJson(res, 405, { code: 405, message: 'Method not allowed' })
    return
  }

  const origin = req.headers.origin || ''
  const referer = req.headers.referer || ''
  if (origin !== LOCAL_ORIGIN && !referer.startsWith(`${LOCAL_ORIGIN}/manage`)) {
    sendPrivateJson(res, 403, { code: 403, message: 'Invalid management origin' })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    sendPrivateJson(res, 400, { code: 400, message: error.message })
    return
  }
  if (body.token !== MANAGE_TOKEN) {
    sendPrivateJson(res, 403, { code: 403, message: 'Invalid management token' })
    return
  }

  if (url.pathname === '/manage/open-log') {
    const logDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'wallpaper11') : __dirname
    fs.mkdirSync(logDir, { recursive: true })
    spawn('explorer.exe', [logDir], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    sendPrivateJson(res, 200, { ok: true, message: '已打开日志目录' })
    return
  }

  if (url.pathname === '/manage/uninstall') {
    const script = path.join(__dirname, 'uninstall.ps1')
    if (!fs.existsSync(script)) {
      sendPrivateJson(res, 409, { code: 409, message: '开发模式下请运行 npm run music:uninstall' })
      return
    }
    sendPrivateJson(res, 202, { ok: true, message: '正在卸载' })
    setTimeout(() => {
      spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
        { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    }, 250)
    return
  }

  sendPrivateJson(res, 404, { code: 404, message: 'Not found' })
}

const server = http.createServer(async (req, res) => {
  let url
  try {
    url = new URL(req.url, LOCAL_ORIGIN)
  } catch {
    sendJson(res, 400, { code: 400, message: 'Invalid URL' })
    return
  }

  if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) {
    await handleManagement(req, res, url)
    return
  }

  if (url.pathname === '/cookie/status' || url.pathname === '/cookie/paste' ||
      url.pathname === '/cookie/clear') {
    await handleCookieControl(req, res, url)
    return
  }

  setCommonHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { code: 405, message: 'Method not allowed' })
    return
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'wallpaper11-music-bridge',
      version: require('./package.json').version,
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      cookieConfigured: Boolean(readStoredMusicCookie()),
    })
    return
  }

  const handler = routes.get(url.pathname)
  if (!handler) {
    sendJson(res, 404, { code: 404, message: 'Not found' })
    return
  }

  try {
    const result = await handler(queryParams(url))
    sendJson(res, responseStatus(result && result.status),
      result && Object.prototype.hasOwnProperty.call(result, 'body') ? result.body : result)
  } catch (error) {
    const status = responseStatus(error && error.status)
    sendJson(res, status === 200 ? 502 : status, {
      code: status === 200 ? 502 : status,
      message: error && error.message ? error.message : 'Upstream request failed',
    })
  }
})

function removeOwnPidFile() {
  try {
    if (fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) {
      fs.rmSync(PID_FILE, { force: true })
    }
  } catch {
    // The file may already be gone during uninstall or shutdown.
  }
}

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 3000).unref()
}

server.on('error', (error) => {
  removeOwnPidFile()
  if (error && error.code === 'EADDRINUSE') {
    console.error(`[wallpaper11] port ${PORT} is already in use`)
  } else {
    console.error(error)
  }
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8')
  console.log(`[wallpaper11] Music Bridge ready: http://${HOST}:${PORT}`)
})

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
process.once('exit', removeOwnPidFile)
