# wallpaper11

为教室 Windows 希沃白板（触屏一体机）设计的交互式动态壁纸，通过 [Lively Wallpaper](https://github.com/rocksdanister/lively) 运行。

![wallpaper11 桌面预览](docs/wallpaper-preview.jpg)

## 功能

- 背景视频、大数字时钟、日期、年度进度和高考倒计时
- 3423 条高考词表，随机展示中文释义、词族和常用搭配
- 底部工具栏：音乐播放器、今日作业和壁纸设置
- 本机音乐、LRC 歌词和网易云搜索
- Lively 暂停壁纸时，同步暂停背景视频和音乐

## 使用方法

### 1. 准备文件

拷贝到新电脑或 U 盘时，准备以下三项：

1. **Lively Wallpaper 安装包**
2. **`wallpaper11-lively.zip`**：壁纸本体与已打包的本机媒体
3. **`wallpaper11-music-setup.exe`**：网易云 Music Bridge；不用网易云时可不安装

普通使用不需要 Node.js、npm 或管理员权限。

### 2. 安装壁纸

1. 安装并打开 Lively Wallpaper。
2. 将 `wallpaper11-lively.zip` 拖入 Lively 完成导入，然后将它设为壁纸。
3. 在 Lively 中使用 **WebView2** 网页引擎，并保持壁纸鼠标输入开启。
4. 在 Lively「性能」设置中，将「其他应用获得焦点时」设为暂停。

需要在壁纸内键入搜索内容时，还需在 Lively「壁纸 → 交互 → 壁纸输入」中开启键盘输入。

### 3. 安装网易云组件

1. 双击 `wallpaper11-music-setup.exe`。
2. 打开壁纸底部的设置，确认 **Music Bridge** 显示「已连接」。
3. 将网易云 `MUSIC_U` 复制到剪贴板，点击「粘贴」，再点击「验证」。

Bridge 只监听 `127.0.0.1:16311`。Cookie 仅保存在当前 Windows 用户的 `%LOCALAPPDATA%\wallpaper11\music-cookie.txt`，清空 Cookie 或卸载 Bridge 时会一并删除。

### 4. 日常操作

桌面底部中间的低调工具栏包含：

- **音乐**：打开播放器，切换本机歌单或搜索网易云。
- **作业**：选择、更换或清空今日作业图片。
- **设置**：修改高考日期、时钟、背景播放、界面缩放和网易云登录。

背景视频、作业图片和其他持久选项也可在 Lively 图库中右键壁纸，选择「自定义」进行修改。

## 卸载

- **Music Bridge**：在壁纸设置中点击「管理 → 卸载组件」，或在 Windows「已安装的应用」中卸载。
- **壁纸**：在 Lively 图库中删除 wallpaper11。
- **Lively**：如果不再使用动态壁纸，可在 Windows「已安装的应用」中卸载 Lively Wallpaper。

## 本地媒体与打包

仅开发或自行制作壁纸包时需要 Node.js 18 或更高版本。将文件放入：

```text
local-video/       背景视频
local-music/       音乐与同名 LRC 歌词
local-homework/    作业图片
```

常用命令：

```powershell
npm run dev             # 启动本地预览 http://127.0.0.1:1420
npm run check           # 检查 Lively 项目和词库
npm run package         # 生成 dist/wallpaper11-lively.zip
npm run music:package   # 生成 dist/wallpaper11-music-setup.exe
npm run portable        # 生成可拷贝到 U 盘的目录
```

媒体文件、Cookie 和 `dist/` 产物不会提交到 Git。项目使用 [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 提供网易云连接，词形数据来自 MIT 许可的 [ECDICT](https://github.com/skywind3000/ECDICT)。
