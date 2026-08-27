# wallpaper11 Windows 宿主

Tauri 2 宿主负责把 `../app/` 变成 Windows 动态壁纸程序。网页界面仍是唯一的 UI 源码。

## 已接入

- `wallpaper` 窗口嵌入 WorkerW，位于桌面图标后
- `overlay` 透明交互窗口：平时仅底部工具栏大小，面板打开时扩为全屏
- 托盘：打开设置、暂停/继续、退出
- 单实例、开机自启命令
- `SHQueryUserNotificationState` 每 2 秒检测全屏/演示/锁屏状态并暂停视频与音乐
- `w11stream://` 本机媒体协议，扫描并读取程序同级 `media/music/` 与 `media/video/`，支持 Range 请求
- HTML5 文件拖放（作业图片）
- 设置页可打开媒体文件夹、刷新媒体、手动检查更新和打开 GitHub 项目页

## Windows 构建

需要 Rust 1.77.2+、Node.js、WebView2 和 Visual Studio C++ Build Tools。

```powershell
cd host
npm install
npm run build
```

构建产物是 `host\src-tauri\target\release\wallpaper11.exe`。GitHub Actions 会把它与独立的 `media/music`、`media/video` 目录打成便携 zip，不使用 NSIS 单文件安装器。

## 本机媒体库

首次启动会在 `wallpaper11.exe` 同级创建：

```text
media/
  README.txt
  music/   # mp3、flac、wav、m4a、aac、ogg、opus；同名 .lrc 自动加载
  video/   # mp4、webm、mov、m4v；按文件名取第一支
```

复制媒体后，重启程序或在设置中点击“刷新媒体”。媒体不进入仓库、不被打包进程序，也不会因手动更新被修改。

首次构建前若图标缺失，在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
```

自动更新已取消；设置中的“检查更新”只提示用户前往 GitHub 项目页手动获取新版本。
