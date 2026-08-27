# wallpaper11

为教室 Windows 希沃白板（触屏一体机）设计的交互式动态壁纸，现以 [Lively Wallpaper](https://github.com/rocksdanister/lively) Web 壁纸运行。

桌面嵌入、鼠标输入、多屏适配和前台应用暂停由 Lively 负责；本项目只保留完整的 HTML/CSS/JavaScript 壁纸界面，不再包含 Tauri、WorkerW 或透明双窗口宿主。

## 功能

- 暮色暖金背景视频、大数字时钟、日期和年度进度条
- 2027 高考倒计时
- 高考 3500 词随机淡入淡出卡片（当前为示例词库）
- 低调工具栏，以及右上角音乐播放器、今日作业和设置面板
- 本机音乐歌单、同名 LRC 歌词、循环/随机、触屏进度条
- 网易云搜索（通过可安装的本机 Music Bridge）
- Lively 自定义属性：背景视频、作业图片、时钟、倒计时、缩放和音乐 API
- Lively 暂停壁纸时同步暂停背景视频与音乐

## 导入 Lively

构建项目需要 Node.js 18 或更高版本。导入完成后，壁纸本身不需要 Node.js；网易云组件的正式安装包也自带运行环境。

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

## 网易云 Music Bridge

网易云网页接口不允许 Lively 壁纸直接跨域调用，因此项目带有一个本机桥接组件。它基于维护中的 [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)，只监听 `127.0.0.1:16311`，并且只开放搜索、歌曲地址、歌词和健康检查四个接口。

普通使用者双击安装包即可，不需要 Node.js、npm 或管理员权限：

```text
wallpaper11-music-setup.exe
```

安装完成后，壁纸设置页会显示连接状态，并可检测组件、验证 Cookie 或打开本机管理页。管理页可查看日志目录和卸载组件，Windows 的「已安装的应用」中也会出现 `wallpaper11 Music Bridge`。

开发环境也可以在项目根目录直接安装：

```powershell
npm run music:install
```

安装程序会把组件放到 `%LOCALAPPDATA%\wallpaper11\music-bridge`，立即静默启动，并为当前用户创建登录启动项；不会弹出常驻终端。重装或升级时再次运行安装包即可。

检查状态或卸载：

```powershell
npm run music:status
npm run music:uninstall
```

诊断日志位于 `%LOCALAPPDATA%\wallpaper11\music-bridge.log`。开发时也可以双击 `tools/netease-api/start.bat` 在前台查看输出。VIP 或需登录的歌曲可在壁纸设置或 Lively 自定义面板中填写 `MUSIC_U`；壁纸设置提供粘贴、验证和清空按钮。如果 Lively WebView 拒绝网页剪贴板权限，粘贴按钮会让本机 Bridge 读取 Windows 剪贴板，并将 `MUSIC_U` 保存在当前用户的 `%LOCALAPPDATA%\wallpaper11\music-cookie.txt`；清空 Cookie 或卸载 Bridge 时会删除该文件。Cookie 不会由本项目保存到远端。

工作链路是：`Lively 壁纸 -> 127.0.0.1 Music Bridge -> 网易云接口 -> 播放地址/歌词 -> 壁纸播放器`。Music Bridge 只负责翻译请求，实际音频仍由壁纸中的浏览器音频元素播放，所以 Lively 暂停壁纸时，音乐也能沿用现有逻辑一起暂停。

生成自包含安装包：

```powershell
npm run music:package
```

产物为 `dist/wallpaper11-music-setup.exe`。它包含精简的 Node 运行时和 Music Bridge 依赖，因此文件会比网页壁纸大。安装包未做商业代码签名，Windows SmartScreen 首次运行时可能要求确认。

如果要一次准备 U 盘内容，运行：

```powershell
npm run portable
```

生成的 `dist/wallpaper11-usb/` 同时包含 Lively 壁纸 ZIP、Music Bridge 安装包和简要说明。

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
│  ├─ package-usb.ps1           生成 U 盘目录
│  ├─ check-lively.js           项目静态检查
│  └─ netease-api/              Music Bridge 与单文件安装包脚本
└─ AGENTS.md                    项目决策与交接档案
```

仓库不保存背景视频、音乐、歌词或作业图片。
