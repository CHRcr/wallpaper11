use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use serde::Serialize;

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
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;

const PILL_WIDTH: u32 = 168;
const PILL_HEIGHT: u32 = 72;
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mov", "m4v"];

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
    let Ok(entries) = fs::read_dir(dir) else { return };
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

fn media_stream_url(path: &Path, kind: &str) -> String {
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    query.append_pair("path", &path.to_string_lossy());
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
                .map(|bytes| String::from_utf8_lossy(&bytes).trim_start_matches('\u{feff}').to_string())
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
        if run {
            let _ = resize_overlay(app, "pill");
        } else {
            let _ = overlay.hide();
        }
    }
}

fn set_manual_paused(app: &AppHandle, paused: bool) {
    app.state::<HostState>()
        .manual_paused
        .store(paused, Ordering::Relaxed);
    notify_power(app);
}

fn primary_geometry(app: &AppHandle) -> Result<(PhysicalPosition<i32>, PhysicalSize<u32>), String> {
    let monitor = app
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "未找到主显示器".to_string())?;
    Ok((*monitor.position(), *monitor.size()))
}

fn resize_overlay(app: &AppHandle, mode: &str) -> Result<(), String> {
    let overlay = app
        .get_webview_window("overlay")
        .ok_or_else(|| "交互窗口尚未创建".to_string())?;
    let (origin, size) = primary_geometry(app)?;

    match mode {
        "panel" => {
            overlay
                .set_position(origin)
                .map_err(|error| error.to_string())?;
            overlay
                .set_size(size)
                .map_err(|error| error.to_string())?;
            let _ = overlay.show();
            let _ = overlay.set_focus();
        }
        "pill" => {
            let center_x = origin.x + (f64::from(size.width) * 0.61).round() as i32;
            let x = center_x - PILL_WIDTH as i32 / 2;
            let y = origin.y + size.height as i32 - PILL_HEIGHT as i32 - 22;
            overlay
                .set_size(PhysicalSize::new(PILL_WIDTH, PILL_HEIGHT))
                .map_err(|error| error.to_string())?;
            overlay
                .set_position(PhysicalPosition::new(x, y))
                .map_err(|error| error.to_string())?;
            let _ = overlay.show();
        }
        _ => return Err("未知的交互窗口模式".to_string()),
    }

    Ok(())
}

#[tauri::command]
fn set_overlay_mode(app: AppHandle, mode: String) -> Result<(), String> {
    resize_overlay(&app, &mode)
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|error| error.to_string())
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
    let _ = resize_overlay(app, "panel");
    if let Some(overlay) = app.get_webview_window("overlay") {
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

    let overlay = WebviewWindowBuilder::new(
        app,
        "overlay",
        WebviewUrl::App("index.html?role=overlay".into()),
    )
    .title("wallpaper11 controls")
    .decorations(false)
    .resizable(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .disable_drag_drop_handler()
    .inner_size(PILL_WIDTH as f64, PILL_HEIGHT as f64)
    .build()?;

    #[cfg(windows)]
    windows_host::embed_in_workerw(&wallpaper)?;

    wallpaper.show()?;
    let _ = resize_overlay(app.handle(), "pill");
    let _ = overlay.show();
    Ok(())
}

fn start_power_monitor(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(2));
        #[cfg(windows)]
        let paused = windows_host::should_pause_for_windows();
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
        Foundation::{HWND, LPARAM, RECT},
        UI::{
            Shell::{
                SHQueryUserNotificationState, QUNS_BUSY, QUNS_NOT_PRESENT,
                QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
            },
            WindowsAndMessaging::{
                EnumWindows, FindWindowExW, FindWindowW, GetClientRect, GetForegroundWindow,
                GetWindowLongPtrW, GetWindowThreadProcessId, SendMessageTimeoutW, SetParent,
                SetWindowLongPtrW, SetWindowPos, GWL_STYLE, HWND_BOTTOM, SMTO_NORMAL,
                SWP_NOACTIVATE, SWP_SHOWWINDOW, WS_CHILD, WS_POPUP,
            },
        },
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(iter::once(0)).collect()
    }

    unsafe extern "system" fn find_worker(hwnd: HWND, output: LPARAM) -> i32 {
        let shell_view = FindWindowExW(
            hwnd,
            ptr::null_mut(),
            wide("SHELLDLL_DefView").as_ptr(),
            ptr::null(),
        );
        if !shell_view.is_null() {
            let worker = FindWindowExW(
                ptr::null_mut(),
                hwnd,
                wide("WorkerW").as_ptr(),
                ptr::null(),
            );
            if !worker.is_null() {
                *(output as *mut HWND) = worker;
                return 0;
            }
        }
        1
    }

    unsafe fn workerw() -> Option<HWND> {
        let progman = FindWindowW(wide("Progman").as_ptr(), ptr::null());
        if progman.is_null() {
            return None;
        }

        let mut result = 0usize;
        let _ = SendMessageTimeoutW(progman, 0x052C, 0xD, 0, SMTO_NORMAL, 1000, &mut result);
        let _ = SendMessageTimeoutW(progman, 0x052C, 0xD, 1, SMTO_NORMAL, 1000, &mut result);

        let mut worker: HWND = ptr::null_mut();
        EnumWindows(Some(find_worker), &mut worker as *mut HWND as LPARAM);
        (!worker.is_null()).then_some(worker).or(Some(progman))
    }

    pub fn embed_in_workerw(window: &WebviewWindow) -> anyhow::Result<()> {
        let raw = window.hwnd()?;
        let hwnd = raw.0 as *mut c_void;
        let parent = unsafe { workerw() }.ok_or_else(|| anyhow::anyhow!("WorkerW not found"))?;

        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let child_style = (style & !(WS_POPUP as isize)) | WS_CHILD as isize;
            SetWindowLongPtrW(hwnd, GWL_STYLE, child_style);
            SetParent(hwnd, parent);

            let mut rect = RECT::default();
            if GetClientRect(parent, &mut rect) == 0 {
                return Err(anyhow::anyhow!("WorkerW size unavailable"));
            }
            SetWindowPos(
                hwnd,
                HWND_BOTTOM,
                0,
                0,
                rect.right - rect.left,
                rect.bottom - rect.top,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
        Ok(())
    }

    pub fn should_pause_for_windows() -> bool {
        let foreground = unsafe { GetForegroundWindow() };
        if !foreground.is_null() {
            let mut process_id = 0;
            unsafe { GetWindowThreadProcessId(foreground, &mut process_id) };
            if process_id == std::process::id() {
                return false;
            }
        }

        let mut state = 0;
        let result = unsafe { SHQueryUserNotificationState(&mut state) };
        result >= 0
            && matches!(
                state,
                QUNS_NOT_PRESENT
                    | QUNS_BUSY
                    | QUNS_RUNNING_D3D_FULL_SCREEN
                    | QUNS_PRESENTATION_MODE
            )
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
            set_autostart,
            get_media_library,
            open_media_folder,
            open_project_page,
            check_update,
            exit_app
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
