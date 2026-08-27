// wallpaper11 · 网易云 API 本地代理
// 基于 NeteaseCloudMusicApi（MIT, https://github.com/Binaryify/NeteaseCloudMusicApi）
// 壁纸页面请求时通过 ?cookie=MUSIC_U%3Dxxx 带上用户 Cookie，VIP 歌曲/无损音质即生效
// 启动：node server.js 或双击 start.bat
const { serveNcmApi } = require('NeteaseCloudMusicApi')

serveNcmApi({
  port: 16311,       // 163 + 11
  host: '127.0.0.1', // 只监听本机，不暴露到局域网
  checkVersion: false,
}).then(() => {
  console.log('[wallpaper11] 网易云 API 已启动: http://127.0.0.1:16311')
})
