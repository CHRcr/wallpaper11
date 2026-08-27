# wallpaper11

为教室 Windows 希沃白板（触屏一体机）打造的可交互动态壁纸。

组件采用「暮色暖金」毛玻璃风格，克制的信息密度，不影响正常教学。背景视频和本地音乐由使用者放入程序同级媒体目录管理，不随仓库或程序本体分发。

**详细设计与决策档案见 [AGENTS.md](AGENTS.md)**（谁接手先读它）。

---

## 一、当前完成进度（✅ 已可用）

`app/` 是纯网页，浏览器双击 `index.html` 即可完整预览：

- **大数字时钟**：视觉重心，Bahnschrift 半压缩字体，12/24 小时制、秒可关
- **年度进度条**：日期行 + 发光轨道（"今年过了多少"）
- **高考倒计时胶囊**：默认 2027-06-07，点胶囊直达设置改日期/标题
- **3500 词卡片**：词组形式（原形 + 变形 + 释义 + 短语），随机淡入淡出，间隔可调，悬停 ↻ 手动换
- **今日份作业（美味的小练习~）**：浮层窗口，拖图/点选导入，面板随图片比例自适应，开板冻结视频+舞台淡出，IndexedDB 持久化，可清空，有货时工具栏亮金点
- **音乐播放器（自研引擎，替代 APlayer）**：
  - 固定在**右上角的暖金毛玻璃卡片**，默认仅 470×252px，不再使用全屏遮罩或居中窗口；封面、曲目信息、当前歌词、波形进度与播放控制集中在同一层级
  - 歌词、歌单和网易云搜索均在同一张卡片内向下展开；不用时一键收回，不占用右下角希沃管家区域
  - 完整歌词当前行金色居中、上下渐隐，**点歌词行跳转**；同一时间轴的原文+译文自动合并成主/副行
  - **进度条可拖动**（pointer 事件，触屏友好，命中区 22px，拇指常驻）
  - **歌单管理**：单曲移除（×，持久记"已移除"）、一键清空（两次点击确认）、恢复完整歌单
  - **循环模式**：列表循环 / 单曲循环 / 随机播放，三态循环按钮
  - 音量滑块 + 静音；封面点击即播放/暂停
  - 网易云搜索：防抖 450ms + 回车，走本地 NeteaseCloudMusicApi 代理，点结果即播（并行取无损地址+歌词，按 `ncid` 去重），结果持久化为网易云收藏
  - 本机歌单会自动扫描 `wallpaper11.exe` 同级 `media/music/`（支持子目录）；把歌曲与同名 `.lrc` 拷入后，重启或设置中点“刷新媒体”即可识别
  - 本机音乐文件缺失会自动跳过（errStreak 保护，防死循环跳歌）
  - 持久化键 `w11-player`（音量/模式/上次歌曲/网易云收藏/已移除）
- **设置面板**：高考日期/标题、切词间隔、制式、秒、背景视频、界面缩放、音乐 API、网易云 Cookie，全部即时生效并持久化（`w11-settings`）；宿主运行时可打开媒体文件夹、刷新媒体、手动检查更新并跳转 GitHub 项目
- **低调工具栏**：平时半透明靠近浮现，44~46px 触屏按钮，含音乐/作业/设置
- **性能**：浏览器预览在页面不可见时冻结视频；设置可彻底冻结为静态帧；其他应用窗口位于前台时宿主自动暂停壁纸
- **角色拆分 + 宿主桥**：页面支持 `?role=wallpaper | overlay` 双窗口模式（wallpaper=纯壁纸层 / overlay=工具条+面板层），已为 Tauri 宿主做好接口（`set_overlay_mode`、`__w11Power` 暂停钩子、面板计数互斥、跨窗 `storage` 同步），设置面板有隐藏的宿主功能区（开机自启/检查更新/退出，宿主存在时显示）
- **Windows/Tauri 宿主基础**（`host/`）：
  - 双窗口：壁纸层嵌入 WorkerW；透明交互层只占工具栏或当前卡片的实际边界，非置顶且不会用整屏透明窗口拦截桌面点击
  - 托盘打开设置、暂停/继续、退出；官方插件实现单实例与当前用户开机自启
  - 每 2 秒检测 Windows 前台活动窗口（排除宿主自身与桌面层），普通窗口、最大化窗口或全屏窗口位于前台时收起交互层，并通过 `__w11Power(false)` 同时暂停视频与音乐
  - Tauri 自定义 `w11stream://` 协议读取 `media/` 中的本机音乐和视频，支持 HTTP Range、拖动进度和视频流播放
  - 关闭 Tauri 原生文件拖放处理，保留作业图片的 HTML5 触控/鼠标拖入逻辑
  - GitHub Actions 输出可解压的便携 zip：`wallpaper11.exe` 与独立的 `media/music`、`media/video` 文件夹，不打包版权视频或音乐
- 调试钩子：`?hw=1` 直接开作业板，`?music=1` 直接开音乐面板

---

## 二、待办路线图（按优先级）

1. **完整 3500 词库**（等你的词库文档）→ 转成 JSON 放 `app/data/words.json`，`main.js` 改用 fetch 加载（注意 `file://` 下 fetch 受限，保留内嵌 `WORDS` 兜底）
2. **Windows 实机打包与验证**：在 Windows CI/希沃白板验证 WorkerW 层级、透明窗口触控、全屏暂停、`media/` 自动扫描和便携包启动；根据实测兼容不同 Windows 11 桌面层级
3. **手动更新流程**：不再使用计划任务、静默下载或自动覆盖。用户在设置里点“检查更新”获取提示，随后通过 GitHub 项目页手动下载新版；`media/` 永远不参与更新。
4. **网易云代理宿主化**：由 Rust 宿主自动启动/转发，替代手动运行 `tools/netease-api/start.bat`

---

## 三、给接手 Agent 的交接要点

- **关键决策**（别推翻，详读 AGENTS.md）：主题暮色暖金、数字用 Bahnschrift、播放器使用右上角卡片、WorkerW 嵌入、媒体独立于程序、仅手动更新、localStorage/IndexedDB 持久化
- **本机媒体库**：运行后，`wallpaper11.exe` 同级会有 `media/music/` 和 `media/video/`。歌曲文件名推荐“歌名 - 歌手.flac”，同名 `.lrc` 会自动读取；多个视频按文件名取第一支，推荐目标背景命名为 `00-background.mp4`。
- **网易云代理**在 `tools/netease-api/`（`start.bat` 启动，端口 16311 只监听 127.0.0.1）；VIP 需要 Cookie `MUSIC_U`，**只粘贴值会自动补 `MUSIC_U=`**（已修复）
- **坑**：`[hidden]` 会被 display:grid/flex 覆盖（CSS 有 `[hidden]{display:none!important}` 别删）；`file://` 下 `fetch` 受限用 `<script>`/`<img>`；`tools/*.ps1` 必须 UTF-8 带 BOM 否则中文乱码；网易云 API 无 CORS 必须走本地代理，`?cookie=` 是它自带能力别自己转发 Cookie 头
- **改样式先看 `style.css :root` 设计令牌**，保持暮色暖金体系；性能预算：动画只用 transform/opacity；触屏优先，点击目标 ≥44px，核心功能不依赖悬停
- **测试**：浏览器直接打开 `app/index.html` 即可；宿主行为需在 Windows 实机验证

---

## 四、目录结构

```
wallpaper11/
├─ AGENTS.md            # 项目交接档案（决策/待办/坑，接手先读）
├─ README.md            # 本文件：进度 + 路线图 + 交接
├─ app/                 # 壁纸本体（纯网页，双击 index.html 预览）
│  ├─ index.html        # 支持 ?role=wallpaper/overlay
│  ├─ css/style.css     # 暮色暖金设计令牌 + 全部样式
│  ├─ js/main.js        # 时钟/进度/倒计时/词卡/作业/设置/角色桥
│  ├─ js/player.js      # 自研音乐播放器引擎
├─ tools/
│  ├─ make-icons.ps1        # 生成宿主图标（src-tauri/icons）
│  └─ netease-api/          # 网易云本地代理（start.bat，端口 16311）
├─ host/                # Tauri 2 Windows 宿主、WorkerW/托盘/暂停/便携包模板
│  └─ media/README.txt  # 运行包中媒体目录的使用说明
```

## 五、参考项目

- [ClassTools](https://github.com/clansty/ClassTools) — 班级电脑动态壁纸系统（Electron），验证教室场景可行性
- [ZongziTEK-Blackboard-Sticker](https://github.com/STBBRD/ZongziTEK-Blackboard-Sticker) — 教室大屏触屏交互与希沃生态避让
- [Lively Wallpaper](https://github.com/rocksdanister/lively) — WorkerW 嵌入与性能暂停机制的参考
- [几枝](https://github.com/unicar9/jizhi) / Momentum — 时钟居中信息层级设计参考

## 六、素材说明

仓库不保存背景视频、内置音乐或歌词。它们只由最终使用者放在本机 `media/` 目录，程序更新不会下载、覆盖或删除这些文件。
