use serde::Serialize;
use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};

use http::{
    header::{
        ACCEPT_RANGES, ACCESS_CONTROL_ALLOW_ORIGIN, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE,
        RANGE,
    },
    Request, Response, StatusCode,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;

// 工具栏本体约 160×60 CSS px；窗口需覆盖最高 140% 的界面缩放，避免 WebView 裁切。
const PILL_WIDTH: u32 = 240;
const PILL_HEIGHT: u32 = 104;
const MUSIC_WIDTH: u32 = 520;
const MUSIC_HEIGHT: u32 = 304;
const MUSIC_EXPANDED_HEIGHT: u32 = 640;
const SETTINGS_WIDTH: u32 = 500;
const SETTINGS_HEIGHT: u32 = 820;
const HOMEWORK_WIDTH: u32 = 920;
const HOMEWORK_HEIGHT: u32 = 900;
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mov", "m4v"];

fn media_probe_enabled() -> bool {
    cfg!(debug_assertions) && std::env::var_os("W11_MEDIA_PROBE").is_some()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaTrack {
    name: String,
    artist: String,
    url: String,
    lrc: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaLibrary {
    music: Vec<MediaTrack>,
    background_url: Option<String>,
    media_dir: String,
}

fn media_root() -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let root = executable
        .parent()
        .ok_or_else(|| "找不到程序目录".to_string())?
        .join("media");
    fs::create_dir_all(root.join("music")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("video")).map_err(|error| error.to_string())?;

    let guide = root.join("README.txt");
    if !guide.exists() {
        fs::write(&guide, include_str!("../../media/README.txt"))
            .map_err(|error| error.to_string())?;
    }
    Ok(root)
}

fn extension_in(path: &Path, allowed: &[&str]) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };
    let extension = extension.to_ascii_lowercase();
    allowed.iter().any(|candidate| *candidate == extension)
}

fn collect_media_files(dir: &Path, allowed: &[&str], files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_media_files(&path, allowed, files);
        } else if extension_in(&path, allowed) {
            files.push(path);
        }
    }
}

fn split_track_name(path: &Path) -> (String, String) {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("未命名音乐")
        .trim();
    match stem.rsplit_once('-') {
        Some((name, artist)) if !name.trim().is_empty() && !artist.trim().is_empty() => {
            (name.trim().to_string(), artist.trim().to_string())
        }
        _ => (stem.to_string(), String::new()),
    }
}

fn decode_text_file(bytes: &[u8]) -> String {
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => {
            // 教室音乐库常见由旧版 Windows 软件导出的 GBK/ANSI LRC。
            let (text, _, _) = encoding_rs::GBK.decode(bytes);
            text.into_owned()
        }
    }
}

fn media_stream_url(path: &Path, kind: &str) -> String {
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    query.append_pair("path", &path.to_string_lossy());
    #[cfg(windows)]
    return format!("http://w11stream.localhost/{kind}?{}", query.finish());
    #[cfg(not(windows))]
    format!("w11stream://localhost/{kind}?{}", query.finish())
}

fn scan_media_library() -> Result<MediaLibrary, String> {
    let root = media_root()?;
    let music_dir = root.join("music");
    let video_dir = root.join("video");
    let mut audio_files = Vec::new();
    let mut video_files = Vec::new();
    collect_media_files(&music_dir, AUDIO_EXTENSIONS, &mut audio_files);
    collect_media_files(&video_dir, VIDEO_EXTENSIONS, &mut video_files);
    audio_files.sort_by_key(|path| path.to_string_lossy().to_ascii_lowercase());
    video_files.sort_by_key(|path| path.to_string_lossy().to_ascii_lowercase());

    let music = audio_files
        .into_iter()
        .map(|path| {
            let (name, artist) = split_track_name(&path);
            let lrc_path = path.with_extension("lrc");
            let lrc = fs::read(&lrc_path)
                .map(|bytes| decode_text_file(&bytes))
                .unwrap_or_default();
            MediaTrack {
                name,
                artist,
                url: media_stream_url(&path, "audio"),
                lrc,
            }
        })
        .collect();

    Ok(MediaLibrary {
        music,
        background_url: video_files
            .first()
            .map(|path| media_stream_url(path, "video")),
        media_dir: root.to_string_lossy().to_string(),
    })
}

struct HostState {
    manual_paused: AtomicBool,
    system_paused: AtomicBool,
    running: AtomicBool,
}

impl Default for HostState {
    fn default() -> Self {
        Self {
            manual_paused: AtomicBool::new(false),
            system_paused: AtomicBool::new(false),
            running: AtomicBool::new(true),
        }
    }
}

fn notify_power(app: &AppHandle) {
    let state = app.state::<HostState>();
    let run = !state.manual_paused.load(Ordering::Relaxed)
        && !state.system_paused.load(Ordering::Relaxed);

    if state.running.swap(run, Ordering::Relaxed) == run {
        return;
    }

    for label in ["wallpaper", "overlay"] {
        if let Some(window) = app.get_webview_window(label) {
            let script = if label == "overlay" && !run {
                "window.__w11ClosePanels?.(); window.__w11Power?.(false);".to_string()
            } else {
                format!("window.__w11Power?.({run});")
            };
            let _ = window.eval(&script);
        }
    }

    if let Some(overlay) = app.get_webview_window("overlay") {
        // 控件窗不是置顶窗口，普通应用会自然盖住它。只收起到工具栏即可，
        // 不再因开发终端/其他前台窗口而 hide，避免回到桌面后工具栏丢失。
        let _ = resize_overlay(app, "pill");
        let _ = overlay.show();
    }
}

fn set_manual_paused(app: &AppHandle, paused: bool) {
    app.state::<HostState>()
        .manual_paused
        .store(paused, Ordering::Relaxed);
    notify_power(app);
}

#[tauri::command]
fn get_power_state(app: AppHandle) -> bool {
    let state = app.state::<HostState>();
    !state.manual_paused.load(Ordering::Relaxed) && !state.system_paused.load(Ordering::Relaxed)
}

#[tauri::command]
fn runtime_log(message: String) {
    #[cfg(debug_assertions)]
    eprintln!("[wallpaper11:web] {message}");
    #[cfg(not(debug_assertions))]
    let _ = message;
}

fn primary_monitor(app: &AppHandle) -> Result<tauri::Monitor, String> {
    let monitor = app
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "未找到主显示器".to_string())?;
    Ok(monitor)
}

fn resize_overlay(app: &AppHandle, mode: &str) -> Result<(), String> {
    let overlay = app
        .get_webview_window("overlay")
        .ok_or_else(|| "交互窗口尚未创建".to_string())?;
    let monitor = primary_monitor(app)?;
    let work = monitor.work_area();
    let scale = monitor.scale_factor();
    let monitor_origin = monitor.position();
    let work_x = f64::from(work.position.x - monitor_origin.x) / scale;
    let work_y = f64::from(work.position.y - monitor_origin.y) / scale;
    let work_width = f64::from(work.size.width) / scale;
    let work_height = f64::from(work.size.height) / scale;
    let max_width = (work_width - 16.0).max(240.0);
    let max_height = (work_height - 16.0).max(104.0);

    let (wanted_width, wanted_height, anchor) = match mode {
        "pill" => (PILL_WIDTH, PILL_HEIGHT, "pill"),
        "music" => (MUSIC_WIDTH, MUSIC_HEIGHT, "top-right"),
        "music-expanded" => (MUSIC_WIDTH, MUSIC_EXPANDED_HEIGHT, "top-right"),
        "settings" => (SETTINGS_WIDTH, SETTINGS_HEIGHT, "center"),
        "homework" => (HOMEWORK_WIDTH, HOMEWORK_HEIGHT, "center"),
        _ => return Err("未知的交互窗口模式".to_string()),
    };
    let width = f64::from(wanted_width).min(max_width);
    let height = f64::from(wanted_height).min(max_height);
    let margin = 18.0;
    let (x, y) = match anchor {
        "pill" => {
            let center_x = work_x + work_width * 0.61;
            (
                center_x - width / 2.0,
                work_y + work_height - height - margin,
            )
        }
        "top-right" => (work_x + work_width - width - margin, work_y + margin),
        _ => (
            work_x + (work_width - width) / 2.0,
            work_y + (work_height - height) / 2.0,
        ),
    };

    overlay
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    overlay
        .set_position(LogicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;
    let _ = overlay.show();
    if mode != "pill" {
        let _ = overlay.set_focus();
    }

    Ok(())
}

#[tauri::command]
fn set_overlay_mode(app: AppHandle, mode: String) -> Result<(), String> {
    resize_overlay(&app, &mode)
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enable: bool) -> Result<(), String> {
    if enable {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_media_library() -> Result<MediaLibrary, String> {
    scan_media_library()
}

#[tauri::command]
fn open_media_folder() -> Result<(), String> {
    let root = media_root()?;
    #[cfg(windows)]
    Command::new("explorer")
        .arg(root)
        .spawn()
        .map_err(|error| error.to_string())?;
    #[cfg(not(windows))]
    let _ = root;
    Ok(())
}

#[tauri::command]
fn open_project_page() -> Result<(), String> {
    #[cfg(windows)]
    Command::new("explorer")
        .arg("https://github.com/CHRcr/wallpaper11")
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn check_update() -> String {
    format!(
        "当前版本 v{}；自动更新已关闭，请在 GitHub 项目页手动获取新版",
        env!("CARGO_PKG_VERSION")
    )
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

fn open_settings(app: &AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        let _ = overlay.eval("document.getElementById('btnSettings')?.click();");
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let settings_item = MenuItem::with_id(app, "settings", "打开设置", true, None::<&str>)?;
    let pause_item = MenuItem::with_id(app, "pause", "暂停壁纸", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&settings_item, &pause_item, &quit_item])?;
    let pause_item_for_event = pause_item.clone();

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("wallpaper11")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "settings" => open_settings(app),
            "pause" => {
                let paused = !app
                    .state::<HostState>()
                    .manual_paused
                    .load(Ordering::Relaxed);
                set_manual_paused(app, paused);
                let _ = pause_item_for_event.set_text(if paused {
                    "继续壁纸"
                } else {
                    "暂停壁纸"
                });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = resize_overlay(app, "pill");
                if let Some(overlay) = app.get_webview_window("overlay") {
                    let _ = overlay.set_focus();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn build_windows(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let wallpaper = WebviewWindowBuilder::new(
        app,
        "wallpaper",
        WebviewUrl::App("index.html?role=wallpaper".into()),
    )
    .title("wallpaper11")
    .decorations(false)
    .resizable(false)
    .focusable(false)
    .focused(false)
    .skip_taskbar(true)
    .always_on_bottom(true)
    .visible(false)
    .build()?;

    let overlay_url = if media_probe_enabled() {
        "index.html?role=overlay&music=1&autoplay=1"
    } else {
        "index.html?role=overlay"
    };
    let overlay = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App(overlay_url.into()))
        .title("wallpaper11 controls")
        .decorations(false)
        .resizable(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        // 普通应用窗口应自然盖住壁纸控件；交互层不占用系统级置顶层级。
        .always_on_top(false)
        .disable_drag_drop_handler()
        .inner_size(PILL_WIDTH as f64, PILL_HEIGHT as f64)
        .build()?;

    wallpaper.show()?;
    overlay.show()?;

    // Tauri 的 show/窗口初始化可能恢复顶层样式，因此 WorkerW 嵌入必须是
    // wallpaper 窗口创建与显示完成后的最后一步。
    #[cfg(windows)]
    {
        windows_host::embed_in_workerw(&wallpaper)?;
        windows_host::embed_overlay_in_desktop(&overlay)?;
    }
    let _ = resize_overlay(app.handle(), "pill");
    Ok(())
}

fn start_power_monitor(app: AppHandle) {
    if media_probe_enabled() {
        return;
    }
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(2));
        #[cfg(windows)]
        let paused = {
            if let Some(window) = app.get_webview_window("wallpaper") {
                let _ = windows_host::fit_wallpaper_to_desktop(&window);
            }
            windows_host::should_pause_for_foreground_window()
        };
        #[cfg(not(windows))]
        let paused = false;

        let state = app.state::<HostState>();
        if state.system_paused.swap(paused, Ordering::Relaxed) != paused {
            notify_power(&app);
        }
    });
}

fn parse_range(value: Option<&str>, file_len: u64) -> Option<(u64, u64)> {
    let value = value?.strip_prefix("bytes=")?.split(',').next()?;
    let (start, end) = value.split_once('-')?;

    if start.is_empty() {
        let suffix = end.parse::<u64>().ok()?.min(file_len);
        return Some((file_len.saturating_sub(suffix), file_len.saturating_sub(1)));
    }

    let start = start.parse::<u64>().ok()?;
    if start >= file_len {
        return None;
    }
    let end = if end.is_empty() {
        file_len - 1
    } else {
        end.parse::<u64>().ok()?.min(file_len - 1)
    };
    (start <= end).then_some((start, end))
}

fn local_media_path(request: &Request<Vec<u8>>) -> Option<PathBuf> {
    let value = url::form_urlencoded::parse(request.uri().query()?.as_bytes())
        .find_map(|(key, value)| (key == "path").then(|| value.into_owned()))?;
    let path = PathBuf::from(value).canonicalize().ok()?;
    let root = media_root().ok()?.canonicalize().ok()?;
    let music_dir = root.join("music");
    let video_dir = root.join("video");
    let audio_ok = path.starts_with(&music_dir) && extension_in(&path, AUDIO_EXTENSIONS);
    let video_ok = path.starts_with(&video_dir) && extension_in(&path, VIDEO_EXTENSIONS);
    (audio_ok || video_ok).then_some(path)
}

fn plain_response(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(message.as_bytes().to_vec())
        .expect("valid static response")
}

fn stream_local_media(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some(path) = local_media_path(&request) else {
        return plain_response(StatusCode::BAD_REQUEST, "invalid media path");
    };
    let Ok(mut file) = File::open(&path) else {
        return plain_response(StatusCode::NOT_FOUND, "audio file not found");
    };
    let Ok(metadata) = file.metadata() else {
        return plain_response(StatusCode::INTERNAL_SERVER_ERROR, "metadata unavailable");
    };
    let file_len = metadata.len();
    if file_len == 0 {
        return plain_response(StatusCode::NO_CONTENT, "empty audio file");
    }

    let requested_range = request.headers().get(RANGE).and_then(|v| v.to_str().ok());
    let (start, end, partial) = match requested_range {
        Some(_) => match parse_range(requested_range, file_len) {
            Some((start, end)) => (start, end, true),
            None => {
                return Response::builder()
                    .status(StatusCode::RANGE_NOT_SATISFIABLE)
                    .header(CONTENT_RANGE, format!("bytes */{file_len}"))
                    .header(ACCEPT_RANGES, "bytes")
                    .body(Vec::new())
                    .expect("valid range response")
            }
        },
        None => (0, file_len - 1, false),
    };

    let length = end - start + 1;
    if file.seek(SeekFrom::Start(start)).is_err() {
        return plain_response(StatusCode::INTERNAL_SERVER_ERROR, "seek failed");
    }
    let mut body = Vec::with_capacity(length.min(8 * 1024 * 1024) as usize);
    if file.take(length).read_to_end(&mut body).is_err() {
        return plain_response(StatusCode::INTERNAL_SERVER_ERROR, "read failed");
    }

    let mime = mime_guess::from_path(&path)
        .first_raw()
        .unwrap_or("application/octet-stream");
    let mut builder = Response::builder()
        .status(if partial {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        })
        .header(CONTENT_TYPE, mime)
        .header(CONTENT_LENGTH, body.len().to_string())
        .header(ACCEPT_RANGES, "bytes")
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    if partial {
        builder = builder.header(CONTENT_RANGE, format!("bytes {start}-{end}/{file_len}"));
    }
    builder.body(body).expect("valid audio response")
}

#[cfg(windows)]
mod windows_host {
    use std::{ffi::c_void, iter, ptr};

    use tauri::WebviewWindow;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, POINT, RECT},
        Graphics::Gdi::ClientToScreen,
        UI::{
            HiDpi::{GetWindowDpiAwarenessContext, SetThreadDpiAwarenessContext},
            WindowsAndMessaging::{
                EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, GetClientRect,
                GetForegroundWindow, GetParent, GetWindowLongPtrW, GetWindowRect,
                GetWindowThreadProcessId, SendMessageTimeoutW, SetParent, SetWindowLongPtrW,
                SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, HWND_TOP, SMTO_NORMAL,
                SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
                WS_CAPTION, WS_CHILD, WS_EX_CLIENTEDGE, WS_EX_DLGMODALFRAME, WS_EX_STATICEDGE,
                WS_EX_WINDOWEDGE, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU,
                WS_THICKFRAME,
            },
        },
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(iter::once(0)).collect()
    }

    unsafe extern "system" fn find_wallpaper_host(hwnd: HWND, output: LPARAM) -> i32 {
        let shell_view = FindWindowExW(
            hwnd,
            ptr::null_mut(),
            wide("SHELLDLL_DefView").as_ptr(),
            ptr::null(),
        );
        if !shell_view.is_null() {
            // Windows 动态壁纸的目标是桌面图标宿主之后的 WorkerW：它位于
            // SHELLDLL_DefView（图标）下方、系统静态壁纸上方。
            let worker =
                FindWindowExW(ptr::null_mut(), hwnd, wide("WorkerW").as_ptr(), ptr::null());
            *(output as *mut HWND) = if worker.is_null() { hwnd } else { worker };
            return 0;
        }
        1
    }

    unsafe fn desktop_host() -> Option<HWND> {
        let progman = FindWindowW(wide("Progman").as_ptr(), ptr::null());
        if progman.is_null() {
            return None;
        }

        let mut result = 0usize;
        let _ = SendMessageTimeoutW(progman, 0x052C, 0xD, 0, SMTO_NORMAL, 1000, &mut result);
        let _ = SendMessageTimeoutW(progman, 0x052C, 0xD, 1, SMTO_NORMAL, 1000, &mut result);

        // Windows 11 新版 Explorer 会把全屏 WorkerW 作为 Progman 的子窗口，
        // 而不是旧方案中的顶层兄弟窗口。它位于 SHELLDLL_DefView（桌面图标）
        // 下方，正是动态壁纸应挂载的层。
        let child_worker = FindWindowExW(
            progman,
            ptr::null_mut(),
            wide("WorkerW").as_ptr(),
            ptr::null(),
        );
        if !child_worker.is_null() {
            return Some(child_worker);
        }

        let mut host: HWND = ptr::null_mut();
        EnumWindows(Some(find_wallpaper_host), &mut host as *mut HWND as LPARAM);
        (!host.is_null()).then_some(host).or(Some(progman))
    }

    unsafe fn make_borderless_child(hwnd: HWND) -> (isize, isize) {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let frame_style =
            WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_POPUP;
        let frame_ex_style =
            WS_EX_DLGMODALFRAME | WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE;
        SetWindowLongPtrW(
            hwnd,
            GWL_STYLE,
            (style & !(frame_style as isize)) | WS_CHILD as isize,
        );
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style & !(frame_ex_style as isize));
        (style, ex_style)
    }

    unsafe fn attach_child(hwnd: HWND, parent: HWND) -> anyhow::Result<()> {
        let (style, ex_style) = make_borderless_child(hwnd);
        let parent_dpi = GetWindowDpiAwarenessContext(parent);
        let previous_dpi = if parent_dpi.is_null() {
            ptr::null_mut()
        } else {
            SetThreadDpiAwarenessContext(parent_dpi)
        };
        SetParent(hwnd, parent);
        if !previous_dpi.is_null() {
            SetThreadDpiAwarenessContext(previous_dpi);
        }
        if GetParent(hwnd) != parent {
            SetWindowLongPtrW(hwnd, GWL_STYLE, style);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);
            return Err(anyhow::anyhow!("failed to attach window to desktop host"));
        }
        Ok(())
    }

    pub fn embed_in_workerw(window: &WebviewWindow) -> anyhow::Result<()> {
        let raw = window.hwnd()?;
        let hwnd = raw.0 as *mut c_void;
        let parent =
            unsafe { desktop_host() }.ok_or_else(|| anyhow::anyhow!("desktop host not found"))?;

        unsafe { attach_child(hwnd, parent)? };
        fit_wallpaper_to_desktop(window)
    }

    pub fn embed_overlay_in_desktop(window: &WebviewWindow) -> anyhow::Result<()> {
        let raw = window.hwnd()?;
        let hwnd = raw.0 as *mut c_void;
        let progman = unsafe { FindWindowW(wide("Progman").as_ptr(), ptr::null()) };
        if progman.is_null() {
            return Err(anyhow::anyhow!("Progman not found"));
        }
        unsafe {
            attach_child(hwnd, progman)?;
            if SetWindowPos(
                hwnd,
                HWND_TOP,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
            ) == 0
            {
                return Err(anyhow::anyhow!(
                    "failed to order overlay above desktop icons"
                ));
            }
        }
        Ok(())
    }

    pub fn fit_wallpaper_to_desktop(window: &WebviewWindow) -> anyhow::Result<()> {
        let raw = window.hwnd()?;
        let hwnd = raw.0 as *mut c_void;
        unsafe {
            let parent = GetParent(hwnd);
            if parent.is_null() {
                return Err(anyhow::anyhow!("wallpaper desktop parent unavailable"));
            }

            // 父 WorkerW 与 WebView2 可能处于不同 DPI awareness。尺寸查询与
            // SetWindowPos 必须在父窗口的 DPI context 中成对执行，否则 125%/150%
            // 缩放下会因坐标虚拟化留下黑边。
            let parent_dpi = GetWindowDpiAwarenessContext(parent);
            let previous_dpi = if parent_dpi.is_null() {
                ptr::null_mut()
            } else {
                SetThreadDpiAwarenessContext(parent_dpi)
            };
            let mut rect = RECT::default();
            let measured = GetClientRect(parent, &mut rect) != 0;
            let mut window_rect = RECT::default();
            let mut child_client = RECT::default();
            let mut child_origin = POINT::default();
            let child_measured = GetWindowRect(hwnd, &mut window_rect) != 0
                && GetClientRect(hwnd, &mut child_client) != 0
                && ClientToScreen(hwnd, &mut child_origin) != 0;
            let child_width = child_client.right - child_client.left;
            let child_height = child_client.bottom - child_client.top;
            let inset_left = (child_origin.x - window_rect.left).max(0);
            let inset_top = (child_origin.y - window_rect.top).max(0);
            let inset_right = (window_rect.right - child_origin.x - child_width).max(0);
            let inset_bottom = (window_rect.bottom - child_origin.y - child_height).max(0);
            const OVERSCAN: i32 = 1;
            let positioned = measured
                && child_measured
                && SetWindowPos(
                    hwnd,
                    HWND_BOTTOM,
                    -inset_left - OVERSCAN,
                    -inset_top - OVERSCAN,
                    rect.right - rect.left + inset_left + inset_right + OVERSCAN * 2,
                    rect.bottom - rect.top + inset_top + inset_bottom + OVERSCAN * 2,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
                ) != 0;
            if !previous_dpi.is_null() {
                SetThreadDpiAwarenessContext(previous_dpi);
            }
            if !measured || !child_measured {
                return Err(anyhow::anyhow!("WorkerW size unavailable"));
            }
            if !positioned {
                return Err(anyhow::anyhow!("failed to resize wallpaper to WorkerW"));
            }
        }
        Ok(())
    }

    fn is_desktop_surface(hwnd: HWND) -> bool {
        let mut class_name = [0u16; 64];
        let len = unsafe { GetClassNameW(hwnd, class_name.as_mut_ptr(), class_name.len() as i32) };
        if len <= 0 {
            return false;
        }

        matches!(
            String::from_utf16_lossy(&class_name[..len as usize]).as_str(),
            "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
        )
    }

    pub fn should_pause_for_foreground_window() -> bool {
        let foreground = unsafe { GetForegroundWindow() };
        if foreground.is_null() || is_desktop_surface(foreground) {
            return false;
        }

        let mut process_id = 0;
        unsafe { GetWindowThreadProcessId(foreground, &mut process_id) };
        process_id != std::process::id()
    }
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = resize_overlay(app, "pill");
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(HostState::default())
        .register_uri_scheme_protocol("w11stream", |_context, request| stream_local_media(request))
        .invoke_handler(tauri::generate_handler![
            set_overlay_mode,
            get_autostart,
            get_power_state,
            set_autostart,
            get_media_library,
            open_media_folder,
            open_project_page,
            check_update,
            exit_app,
            runtime_log
        ])
        .setup(|app| {
            build_windows(app)?;
            build_tray(app)?;
            start_power_monitor(app.handle().clone());
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("wallpaper11 host failed");
}
