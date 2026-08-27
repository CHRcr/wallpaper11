# AGENTS.md · 项目交接档案

尽量多使用优秀的开源项目。

## 一、项目是什么

为**教室 Windows 希沃白板（触屏一体机）**制作的可交互动态壁纸，班级自用。仓库：<https://github.com/CHRcr/wallpaper11>

### 已确认需求

1. 大数字时间是视觉重心。
2. 时间下方显示日期与年度进度条。
3. 高考 3500 词以“单词 + 变形 + 中文释义 + 短语”展示，约 50 秒随机淡换，不滚动。
4. 设置可持久化。
5. 更新只由用户手动从 GitHub 获取，不做后台更新。
6. 音乐播放器藏在低调工具栏中，打开后是右上角卡片；支持本机音乐和网易云搜索。
7. 今日作业标题为「今日份作业（美味的小练习~）」，支持图片、清空和持久选择。
8. 有其他应用窗口或全屏程序时暂停壁纸。
9. 高考日期暂用 2027-06-07，可修改。
10. 触屏与鼠标交互不能破坏 Windows 桌面使用。
11. 播放器、作业和设置收进一个不显眼的工具栏。

布局继续避让桌面左侧三列图标区（舞台左留 22%）和右下角希沃管家区域。不要写鸡汤标语。

## 二、当前关键决策

- **运行载体：Lively Wallpaper Web 壁纸。** `app/` 本身是可导入项目，入口为 `app/index.html`。不再维护 Tauri、WorkerW、自定义透明浮层或独立 EXE。
- **单页面交互：** 背景、主舞台、工具栏、播放器、作业板和设置全部位于同一个网页中。桌面嵌入、鼠标转发、DPI、多屏和暂停规则交给 Lively。
- **Lively 接口：** `LivelyProperties.json` 提供持久设置和文件选择；`LivelyInfo.json` 使用 `--pause-event true`；`livelyWallpaperPlaybackChanged` 同步暂停视频和音乐。
- **媒体不进 Git：** 用户保留 `local-video/`、`local-music/`、`local-homework/`，运行 `npm run media` 同步到 `app/media/` 并生成 `media-library.js`。打包命令为 `npm run package`。
- **背景适配：** 视频使用 `object-fit: cover` 覆盖整个画布。默认按文件名选择第一支，也可在 Lively 自定义面板中指定。
- **主题：** 暮色暖金。令牌在 `app/css/style.css :root`，包括 `--gold: #ffcf9c`、`--rose: #f2a7b3`、烟熏紫玻璃和暖白文字。
- **字体：** 数字使用 Bahnschrift 半压缩字体；中文使用 Segoe UI/微软雅黑兜底。
- **播放器形态：** 右上角紧凑毛玻璃卡片，歌词、歌单和搜索只在卡片内部展开。
- **持久化：** Lively 属性是跨重载的首选设置来源；网页内设置与播放器状态仍使用 localStorage；作业拖图使用 IndexedDB，长期固定作业图优先通过 Lively 的 `homeworkImage` 属性选择。
- **更新：** GitHub 项目入口保留，更新 Lively 壁纸包时不得提交或删除本机媒体源目录。

## 三、当前状态

- `app/` 是完整的单窗口网页壁纸。
- 时钟、年度进度、倒计时、示例单词卡、作业板、设置和右上角音乐播放器均已保留。
- `window.livelyPropertyListener(name, value)` 已映射背景、时钟、倒计时、切词间隔、缩放、作业图和网易云配置。
- `window.livelyWallpaperPlaybackChanged(data)` 已映射 Lively 暂停状态。
- 本机歌单由 `tools/prepare-lively-media.js` 生成，支持子目录、同名 LRC、UTF-8 与 GBK 歌词。
- `tools/package-lively.ps1` 输出 `dist/wallpaper11-lively.zip`，Lively 元数据位于 zip 根目录。
- GitHub Actions 只做 Lively 项目静态检查，不构建 EXE，也不发布 Release。

## 四、待办

1. 等用户提供完整 3500 词库，转为可在 `file://` 环境加载的本地数据，同时保留内嵌兜底。
2. 在 Lively/Windows 11/希沃实机验证触屏、桌面输入、WebView2 MP4、IndexedDB 和“其他应用获得焦点时暂停”。
3. 根据实机结果调整 Lively 的鼠标/键盘输入说明；默认只要求鼠标输入，文本输入需要用户开启壁纸键盘输入或从 Lively 自定义面板填写。
4. 网易云搜索继续依赖 `tools/netease-api/start.bat`，以后可做独立轻量代理，但不要重新引入桌面嵌入宿主。

## 五、协作约定

- UI 文案克制，不要“修改即时生效并自动保存”一类赘述。
- 改样式先查看 `:root` 令牌，保持暮色暖金体系。
- 低配一体机优先；动画只使用 transform/opacity。
- 触屏点击目标不小于 44px，核心功能不依赖右键或悬停。
- 截图可以用于验证，但不要把测试截图写进文档或提交仓库。

## 六、已知注意事项

- `[hidden]` 可能被 `display:grid/flex` 覆盖，CSS 中的 `[hidden]{display:none!important}` 不能删除。
- `file://` 下相对 `fetch()` 受限；本机歌单使用普通 `<script>` 加载生成的 `media/media-library.js`。
- Lively `folderDropdown` 只扫描入口 HTML 下的指定目录，不递归；音乐子目录由项目脚本扫描。
- Lively 属性是单向通知，壁纸内修改不会反写 `LivelyProperties.json`；重新加载时以 Lively 保存的属性为准。
- Lively 默认启用鼠标输入；输入文字需要在 Lively 中开启壁纸键盘输入，或直接使用 Lively 自定义面板。
- 网易云官方 API 没有 CORS，必须走本地 NeteaseCloudMusicApi；不要在浏览器里手动设置 Cookie 请求头。
- PowerShell 5.1 对无 BOM UTF-8 脚本兼容较差；`package-lively.ps1` 保持 ASCII 内容。
