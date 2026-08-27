# wallpaper11

为教室 Windows 希沃白板（触屏一体机）设计的交互式动态壁纸，现以 [Lively Wallpaper](https://github.com/rocksdanister/lively) Web 壁纸运行。

桌面嵌入、鼠标输入、多屏适配和前台应用暂停由 Lively 负责；本项目只保留完整的 HTML/CSS/JavaScript 壁纸界面，不再包含 Tauri、WorkerW 或透明双窗口宿主。

## 功能

- 暮色暖金背景视频、大数字时钟、日期和年度进度条
- 2027 高考倒计时
- 高考 3500 词随机淡入淡出卡片（当前为示例词库）
- 低调工具栏，以及右上角音乐播放器、今日作业和设置面板
- 本机音乐歌单、同名 LRC 歌词、循环/随机、触屏进度条
- 网易云搜索（需运行本地 NeteaseCloudMusicApi）
- Lively 自定义属性：背景视频、作业图片、时钟、倒计时、缩放和音乐 API
- Lively 暂停壁纸时同步暂停背景视频与音乐

## 导入 Lively

需要 Node.js 18 或更高版本，仅用于整理本机媒体和打包；壁纸运行时不需要 Node.js。

1. 把背景视频放入 `local-video/`，音乐和同名 `.lrc` 放入 `local-music/`。
2. 在项目根目录运行：

   ```powershell
   npm run package
   ```

3. 把生成的 `dist/wallpaper11-lively.zip` 拖入 Lively。
4. 在 Lively 中将网页引擎设为 WebView2，并保持壁纸鼠标输入开启。
5. 在 Lively「性能」中把“其他应用获得焦点”设为暂停，即可满足教学时停止壁纸运行的要求。

MP4/H.264 依赖 WebView2；如果个别视频无法播放，优先转换为 WebM。多个背景视频存在时，未在 Lively 自定义面板指定的情况下按文件名选择第一支，建议命名为 `00-background.mp4`。

## 本地媒体

```text
local-video/       背景视频源，不提交 Git
local-music/       音乐与同名 LRC，不提交 Git
local-homework/    可选的作业图片源，不提交 Git
```

`npm run media` 会把这些文件同步到 `app/media/`，并生成浏览器可直接读取的歌单。歌曲文件名建议使用 `歌名 - 歌手.flac`，解析时按最后一个 `-` 分隔。

也可以从 Lively 的「自定义」面板直接添加背景视频或作业图片。音乐列表有变化时仍需运行 `npm run media` 并重新导入或重新加载壁纸。

## 开发与检查

```powershell
npm run dev
```

浏览器打开 <http://127.0.0.1:1420>。调试参数：`?hw=1` 打开作业板，`?music=1` 打开音乐播放器。

```powershell
npm run check
```

该命令验证 Lively 元数据、属性定义和 JavaScript 语法，不进行原生编译。

## 网易云代理

代理位于 `tools/netease-api/`，运行 `start.bat` 后监听 `127.0.0.1:16311`。VIP 歌曲可在壁纸设置或 Lively 自定义面板中填写 `MUSIC_U`。

## 目录

```text
wallpaper11/
├─ app/                         Lively Web 壁纸项目
│  ├─ LivelyInfo.json           壁纸元数据与暂停事件参数
│  ├─ LivelyProperties.json     Lively 持久自定义属性
│  ├─ index.html
│  ├─ css/style.css
│  ├─ js/main.js
│  ├─ js/player.js
│  └─ media/                    打包时生成的本机媒体目录
├─ tools/
│  ├─ prepare-lively-media.js   同步媒体并生成歌单
│  ├─ package-lively.ps1        生成 Lively zip
│  ├─ check-lively.js           项目静态检查
│  └─ netease-api/              网易云本地代理
└─ AGENTS.md                    项目决策与交接档案
```

仓库不保存背景视频、音乐、歌词或作业图片。
