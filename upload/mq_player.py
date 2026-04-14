import customtkinter as ctk
import tkinter as tk
from ytmusicapi import YTMusic
from PIL import Image, ImageDraw, ImageFilter
from io import BytesIO
import requests
import threading
import vlc
import yt_dlp
import json
import os
import sys
import time
import random
import re
import math
import hashlib
import urllib.parse
import logging
from collections import OrderedDict, defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, List, Any, Tuple, Set
import atexit
import subprocess
import shutil

# ─── Логирование ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler('mq_player.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger('mq_player')

# ═══ PATCH: CTkScrollableFrame убивает ВСЕ mousewheel-обработчики
# через unbind_all при Leave. Автодетект имён методов для разных версий CTk.
_player_ref = [None]  # ссылка на экземпляр MusicPlayer

def _find_attr(cls, *candidates):
    for name in candidates:
        if hasattr(cls, name):
            return name
    return None

_MW_ATTR  = _find_attr(ctk.CTkScrollableFrame, "_mousewheel_event", "_mouse_wheel_all")
_UB_ATTR  = _find_attr(ctk.CTkScrollableFrame, "_unbind_mousewheel", "_unbind_mouse_wheel", "_remove_mousewheel_all")
_BD_ATTR  = _find_attr(ctk.CTkScrollableFrame, "_bind_mousewheel", "_bind_mouse_wheel", "_add_mousewheel_all")

_orig_ctk_mw = getattr(ctk.CTkScrollableFrame, _MW_ATTR) if _MW_ATTR else None
_orig_ctk_ub = getattr(ctk.CTkScrollableFrame, _UB_ATTR) if _UB_ATTR else None
_orig_ctk_bd = getattr(ctk.CTkScrollableFrame, _BD_ATTR) if _BD_ATTR else None


def _patched_ctk_mw(self, event):
    """CTk-скролл по всей странице через winfo_containing (а не event.widget).
    Если курсор на player_bar — громкость."""
    app = _player_ref[0]
    if app is None:
        if _orig_ctk_mw:
            return _orig_ctk_mw(self, event)
        return None
    try:
        w = app.winfo_containing(event.x_root, event.y_root)
        # 1) Громкость на player_bar
        if w is not None and app._is_widget_inside(w, app.player_bar):
            delta = 3
            if hasattr(event, 'num') and event.num == 5:
                delta = -3
            elif hasattr(event, 'delta') and event.delta < 0:
                delta = -3
            new_vol = max(0, min(100, app.vol_slider.get() + delta))
            app.vol_slider.set(new_vol)
            app._vol_change(new_vol)
            return "break"
        # 2) Скролл если курсор над _parent_frame этого ScrollableFrame
        #    (включая canvas, дочерние виджеты И полосу прокрутки)
        parent_frame = getattr(self, '_parent_frame', None)
        canvas = getattr(self, '_parent_canvas', None)
        if w is not None and parent_frame is not None:
            if app._is_widget_inside(w, parent_frame):
                if canvas is None:
                    return "break"
                # Определяем направление: Shift = горизонтально
                shifted = getattr(self, '_shift_pressed', False)
                if shifted:
                    if canvas.xview() != (0.0, 1.0):
                        if sys.platform.startswith("win"):
                            canvas.xview("scroll", -int(event.delta / 6), "units")
                        elif sys.platform == "darwin":
                            canvas.xview("scroll", -event.delta, "units")
                        else:
                            canvas.xview("scroll", -event.delta, "units")
                else:
                    if canvas.yview() != (0.0, 1.0):
                        if sys.platform.startswith("win"):
                            canvas.yview("scroll", -int(event.delta / 6), "units")
                        elif sys.platform == "darwin":
                            canvas.yview("scroll", -event.delta, "units")
                        else:
                            canvas.yview("scroll", -event.delta, "units")
                return "break"
    except Exception:
        pass
    return None


def _patched_ctk_ub(self):
    """После того как CTk убил все обработчики, сразу ставим наш fallback."""
    if _orig_ctk_ub:
        _orig_ctk_ub(self)
    app = _player_ref[0]
    if app is not None:
        try:
            app.bind_all("<MouseWheel>", app._mw_fallback)
        except Exception:
            pass


def _patched_ctk_bd(self):
    if _orig_ctk_bd:
        _orig_ctk_bd(self)


if _MW_ATTR:
    setattr(ctk.CTkScrollableFrame, _MW_ATTR, _patched_ctk_mw)
if _UB_ATTR:
    setattr(ctk.CTkScrollableFrame, _UB_ATTR, _patched_ctk_ub)
if _BD_ATTR:
    setattr(ctk.CTkScrollableFrame, _BD_ATTR, _patched_ctk_bd)
# ═══ END PATCH ════════════════════════════════════════════════════

# ─── Цветовые темы ───────────────────────────────────────────────
THEMES = {
    "red_black": {
        "bg": "#0e0e0e", "fg": "#1a1a1a", "card": "#222222",
        "accent": "#e03131", "text": "#ffffff", "text_secondary": "#b0b0b0",
        "progress_bg": "#3d3d3d", "button": "#333333", "button_hover": "#4d4d4d",
        "divider": "#3a3a3a", "sidebar": "#141414",
        "accent_soft": "#3a1515", "card_border": "#333333",
    },
    "dark": {
        "bg": "#0a0a0a", "fg": "#141414", "card": "#1c1c1c",
        "accent": "#1DB954", "text": "#ffffff", "text_secondary": "#a0a0a0",
        "progress_bg": "#333333", "button": "#282828", "button_hover": "#363636",
        "divider": "#2a2a2a", "sidebar": "#0e0e0e",
        "accent_soft": "#0f2a1a", "card_border": "#2a2a2a",
    },
    "midnight": {
        "bg": "#0b0d17", "fg": "#12152a", "card": "#161a2e",
        "accent": "#818cf8", "text": "#e2e8f0", "text_secondary": "#94a3b8",
        "progress_bg": "#1e2440", "button": "#1a1f35", "button_hover": "#252b45",
        "divider": "#1e2440", "sidebar": "#0a0c15",
        "accent_soft": "#1a1d3a", "card_border": "#252b45",
    },
    "sunset": {
        "bg": "#110f0c", "fg": "#1e1a14", "card": "#28221a",
        "accent": "#f59e0b", "text": "#fef3c7", "text_secondary": "#c4956a",
        "progress_bg": "#332a1e", "button": "#2a2318", "button_hover": "#3a3020",
        "divider": "#332a1e", "sidebar": "#0e0c09",
        "accent_soft": "#2a2010", "card_border": "#3a3020",
    },
    "forest": {
        "bg": "#090f0b", "fg": "#0f1a13", "card": "#152819",
        "accent": "#4ade80", "text": "#dcfce7", "text_secondary": "#6db88a",
        "progress_bg": "#1a3020", "button": "#162818", "button_hover": "#1e3522",
        "divider": "#1a3020", "sidebar": "#070c08",
        "accent_soft": "#102218", "card_border": "#1e3522",
    },
    "lavender": {
        "bg": "#0f0c18", "fg": "#18142a", "card": "#211b35",
        "accent": "#a78bfa", "text": "#ede9fe", "text_secondary": "#a594c8",
        "progress_bg": "#261f40", "button": "#1e1830", "button_hover": "#2a2345",
        "divider": "#261f40", "sidebar": "#0c0a14",
        "accent_soft": "#1a1530", "card_border": "#2a2345",
    },
}

# ─── LRU-кэш обложек ─────────────────────────────────────────────
class LRUImageCache:
    def __init__(self, capacity=200):
        self._cache = OrderedDict()
        self._cap = capacity

    def get(self, key):
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def put(self, key, value):
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        while len(self._cache) > self._cap:
            self._cache.popitem(last=False)

    def __contains__(self, key):
        return key in self._cache


class MusicPlayer(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("mq")
        self.geometry("1280x800")
        self.minsize(960, 640)
        # Иконка окна — ищем в нескольких местах
        self._app_dir = os.path.dirname(os.path.abspath(__file__)) or os.getcwd()
        icon_paths = [
            os.path.join(self._app_dir, 'mq_logo_small.png'),
            os.path.join(self._app_dir, 'download', 'mq_logo_small.png'),
            os.path.join(os.path.dirname(self._app_dir), 'download', 'mq_logo_small.png'),
            '/home/z/my-project/download/mq_logo_small.png',
        ]
        icon_loaded = False
        for icon_path in icon_paths:
            try:
                icon_img = Image.open(icon_path)
                self.iconphoto(True, tk.PhotoImage(icon_img))
                self._icon_path = icon_path
                icon_loaded = True
                log.info("Icon loaded from: %s", icon_path)
                break
            except Exception:
                pass
        if not icon_loaded:
            log.warning("Icon not found in any of the searched paths")
            self._icon_path = None

        self.settings_file = "settings.json"
        self.playlists_file = "playlists.json"
        self.history_file = "history.json"
        self.liked_file = "liked_playlist.json"
        self.disliked_file = "disliked.json"

        self.settings  = self._load_json(self.settings_file,  {"theme": "red_black", "volume": 80})
        self.playlists = self._load_json(self.playlists_file, {})
        self.history   = self._load_json(self.history_file,   {})
        if isinstance(self.history, list):
            self.history = {str(i.get("videoId", idx)): i for idx, i in enumerate(self.history)}

        self.liked_playlist = self._load_json(self.liked_file, [])
        self.disliked = set(self._load_json(self.disliked_file, []))
        self._liked_ids = {t.get("videoId") for t in self.liked_playlist if t.get("videoId")}

        self.image_cache  = LRUImageCache(400)
        self.orig_cache   = LRUImageCache(100)
        self.search_cache = OrderedDict()
        self.search_cache_file = "search_cache.json"
        loaded_cache = self._load_json(self.search_cache_file, {})
        if isinstance(loaded_cache, dict):
            for k, v in loaded_cache.items():
                self.search_cache[k] = v
            # Limit to 150 entries
            while len(self.search_cache) > 150:
                self.search_cache.popitem(last=False)
        self.executor     = ThreadPoolExecutor(max_workers=8)
        self.http         = requests.Session()
        self.http.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

        # Thread safety locks
        self._lock_player    = threading.Lock()   # VLC player access
        self._lock_cache     = threading.Lock()    # stream_cache / search_cache
        self._lock_playlists = threading.Lock()    # playlists / liked / history
        self._lock_tracks    = threading.Lock()    # self.tracks list mutations

        self.theme = THEMES.get(self.settings.get("theme", "red_black"), THEMES["red_black"])
        self._apply_appearance()

        self.placeholders = {}
        self._build_placeholders()

        # Восстановить shuffle/repeat из настроек
        self.is_shuffle = self.settings.get("shuffle", False)
        self.repeat_mode = self.settings.get("repeat_mode", 0)

        self.ytmusic = None
        try:
            self.ytmusic = YTMusic()
        except Exception:
            pass

        self.vlc_instance = None
        self.player = None
        self.player_b = None
        self._init_vlc()

        self.tracks            = []
        self.current_track     = None
        self.current_playlist  = None
        self.current_duration  = 0
        # is_shuffle и repeat_mode инициализируются ниже из self.settings
        self.is_muted          = False
        self.is_dragging       = False
        self.previous_volume   = self.settings.get("volume", 80)
        self.is_crossfade      = self.settings.get("crossfade", True)
        self.crossfade_duration = self.settings.get("crossfade_duration", 3.0)
        self.crossfade_active  = False
        self.crossfade_started = False
        self._next_track_data  = None
        self.shuffle_order     = []
        self.current_view      = "main"
        self.recommendations_cache = []
        self.sleep_timer_minutes = 0
        self.sleep_deadline     = None
        self.running           = True
        self.stream_cache      = {}
        self._download_cancel  = threading.Event()
        self._is_prefetching   = False
        self.ambient_color_current = THEMES[self.settings.get("theme", "red_black")]["sidebar"]
        self.ambient_color_target  = self.ambient_color_current
        self.eq_phases         = [random.random() * 2 * math.pi for _ in range(5)]
        self._inline_pl_panel  = None
        self._ctx_menu         = None
        self._cover_accent     = None  # Доминирующий цвет обложки для микшера

        _player_ref[0] = self          # для monkey-patch

        # Loading state for spinner (до _build_ui, т.к. _tick_progress использует)
        self._is_loading = False

        self._resize_job = None
        self._build_ui()
        self._tick_progress()
        self._setup_bindings()
        self.bind("<Configure>", self._on_resize)
        self.after(1000, self._sleep_timer_tick)
        self.after(300000, self._auto_cleanup_cache)  # every 5 min

        # Radio mode
        self.radio_mode = self.settings.get("radio_mode", False)

        # Last.fm scrobbling
        self.lastfm_api_key = "d5bf2e5b9c72d08e4a3e30df6be84e72"
        self.lastfm_api_secret = ""
        self.lastfm_session_key = self.settings.get("lastfm_session_key", "")
        self.lastfm_username = self.settings.get("lastfm_username", "")
        self._lastfm_scrobbled_file = "lastfm_scrobbled.json"
        self._lastfm_scrobbled = set(self._load_json(self._lastfm_scrobbled_file, []))

        # Downloaded tracks tracking for offline mode
        self.downloads_dir = os.path.join(os.path.expanduser("~"), "Music", "mq_downloads")
        os.makedirs(self.downloads_dir, exist_ok=True)
        self.downloaded_tracks_file = "downloaded_tracks.json"
        self.downloaded_tracks: Dict[str, str] = self._load_json(self.downloaded_tracks_file, {})
        # Validate existing files
        self.downloaded_tracks = {vid: path for vid, path in self.downloaded_tracks.items()
                                   if os.path.isfile(path)}

        # Playback state persistence
        self.playback_state_file = "playback_state.json"
        saved_state = self._load_json(self.playback_state_file, {})
        self._saved_track = None
        self._saved_position = 0
        if isinstance(saved_state, dict) and saved_state.get("videoId"):
            self._saved_track = saved_state.get("track")
            self._saved_position = saved_state.get("position", 0)

        atexit.register(self._cleanup)

    # ──── Утилиты ─────────────────────────────────────────────────
    @staticmethod
    def _load_json(path, default):
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        if isinstance(default, (dict, list)):
            return default.copy()
        return default

    @staticmethod
    def _save_json(path, data):
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _lighten(self, color, d=35):
        if not color.startswith("#") or len(color) != 7:
            return color
        r = min(255, int(color[1:3], 16) + d)
        g = min(255, int(color[3:5], 16) + d)
        b = min(255, int(color[5:7], 16) + d)
        return f"#{r:02x}{g:02x}{b:02x}"

    def _darken(self, color, d=25):
        if not color.startswith("#") or len(color) != 7:
            return color
        r = max(0, int(color[1:3], 16) - d)
        g = max(0, int(color[3:5], 16) - d)
        b = max(0, int(color[5:7], 16) - d)
        return f"#{r:02x}{g:02x}{b:02x}"

    def _lerp_color(self, c1, c2, t):
        """Плавная интерполяция между двумя цветами (t: 0.0–1.0).
        Поддерживает 'transparent' как первый цвет — берёт цвет sidebar."""
        if c1 == "transparent":
            c1 = self.theme["sidebar"]
        if c2 == "transparent":
            c2 = self.theme["sidebar"]
        r1, g1, b1 = self._hex_to_rgb(c1)
        r2, g2, b2 = self._hex_to_rgb(c2)
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        return f"#{max(0,min(255,r)):02x}{max(0,min(255,g)):02x}{max(0,min(255,b)):02x}"

    def _animate_color(self, widget, attr, target_color, steps=12, delay=16, callback=None):
        """Плавная анимация цвета виджета."""
        try:
            if not widget.winfo_exists():
                return
            current = widget.cget(attr)
            if current == target_color:
                if callback:
                    callback()
                return
            step = [0]
            def _tick():
                step[0] += 1
                t = step[0] / steps
                if t > 1.0:
                    t = 1.0
                try:
                    if not widget.winfo_exists():
                        return
                    c = self._lerp_color(current, target_color, t)
                    widget.configure(**{attr: c})
                    if t < 1.0:
                        self.after(delay, _tick)
                    elif callback:
                        callback()
                except Exception:
                    pass
            _tick()
        except Exception:
            pass

    def _animate_opacity_label(self, label, target_alpha, steps=10, delay=20, callback=None):
        """Анимация прозрачности CTkLabel через текстовый цвет."""
        try:
            if not label.winfo_exists():
                return
            base_color = self.theme["accent"]
            bg = self.theme["bg"]
            step = [0]
            def _tick():
                step[0] += 1
                t = step[0] / steps
                if t > 1.0:
                    t = 1.0
                try:
                    if not label.winfo_exists():
                        return
                    c = self._lerp_color(bg, base_color, target_alpha if target_alpha > 0.5 else 1.0 - t)
                    label.configure(text_color=c)
                    if t < 1.0:
                        self.after(delay, _tick)
                    elif callback:
                        callback()
                except Exception:
                    pass
            _tick()
        except Exception:
            pass

    @staticmethod
    def _hex_to_rgb(color):
        if not color.startswith("#") or len(color) != 7:
            return (0, 0, 0)
        return tuple(int(color[i:i+2], 16) for i in (1, 3, 5))

    @staticmethod
    def _rgb_to_hex(rgb):
        r, g, b = rgb
        return f"#{r:02x}{g:02x}{b:02x}"

    @staticmethod
    def _blend_colors(base_rgb, top_rgb, alpha):
        br, bg, bb = base_rgb
        tr, tg, tb = top_rgb
        r = int(br * (1 - alpha) + tr * alpha)
        g = int(bg * (1 - alpha) + tg * alpha)
        b = int(bb * (1 - alpha) + tb * alpha)
        return (r, g, b)

    def _set_ambient_from_image(self, img):
        try:
            small = img.resize((32, 32)).convert("RGB")
            pixels = list(small.getdata())
            if not pixels:
                return
            r = sum(p[0] for p in pixels) // len(pixels)
            g = sum(p[1] for p in pixels) // len(pixels)
            b = sum(p[2] for p in pixels) // len(pixels)
            base = self._hex_to_rgb(self.theme["sidebar"])
            blended = self._blend_colors(base, (r, g, b), 0.15)
            col = self._rgb_to_hex(blended)
            self.ambient_color_target = col
            self.ambient_color_current = col
            if hasattr(self, "player_bar"):
                self.player_bar.configure(fg_color=col)
            # Сохраняем доминирующий цвет обложки для микшера
            cover_col = self._rgb_to_hex((r, g, b))
            self._cover_accent = cover_col
            self._apply_cover_color_to_mixer(cover_col)
        except Exception:
            pass

    def _apply_cover_color_to_mixer(self, color):
        """Обновить цвета микшера громкости под цвет обложки."""
        try:
            if not hasattr(self, 'vol_slider') or not self.vol_slider.winfo_exists():
                return
            r, g, b = self._hex_to_rgb(color) if color and color.startswith("#") else (0, 0, 0)
            base_rgb = self._hex_to_rgb(self.theme["sidebar"])
            # Прогресс слайдера — приглушённый цвет обложки
            progress_rgb = self._blend_colors(base_rgb, (r, g, b), 0.55)
            progress_col = self._rgb_to_hex(progress_rgb)
            # Кнопка слайдера — ярче
            btn_rgb = self._blend_colors(base_rgb, (r, g, b), 0.75)
            btn_col = self._rgb_to_hex(btn_rgb)
            btn_hover = self._lighten(btn_col, 25)
            self.vol_slider.configure(
                progress_color=progress_col,
                button_color=btn_col,
                button_hover_color=btn_hover,
            )
        except Exception:
            pass

    def _reset_mixer_to_theme(self):
        """Сбросить цвета микшера к цветам темы."""
        try:
            if not hasattr(self, 'vol_slider') or not self.vol_slider.winfo_exists():
                return
            self.vol_slider.configure(
                progress_color=self.theme["accent"],
                button_color=self.theme["accent"],
                button_hover_color=self._lighten(self.theme["accent"]),
            )
        except Exception:
            pass

    def _sleep_timer_tick(self):
        try:
            if self.sleep_deadline and self.player:
                remaining = int(self.sleep_deadline - time.time())
                if remaining <= 0:
                    self.sleep_deadline = None
                    self.sleep_timer_minutes = 0
                    self.player.stop()
                    if hasattr(self, "btn_play"):
                        self.btn_play.configure(text="▶")
                    self._toast("Таймер сна: воспроизведение остановлено")
                    # Обновить индикатор в player bar
                    self._update_sleep_indicator("")
                else:
                    mins = remaining // 60
                    sec = remaining % 60
                    timer_str = f"💤 {mins}:{sec:02d}"
                    # Обновить индикатор в player bar
                    self._update_sleep_indicator(timer_str)
                    # Статус-бар — только если не показывает другой тост
                    if hasattr(self, "status_label"):
                        cur = ""
                        try:
                            cur = self.status_label.cget("text")
                        except Exception:
                            pass
                        if not cur or "💤" in cur:
                            self.status_label.configure(text=timer_str,
                                                        text_color=self.theme["accent"])
            else:
                # Скрыть индикатор если таймер выключен
                self._update_sleep_indicator("")
        finally:
            if self.running:
                self.after(1000, self._sleep_timer_tick)

    def _update_sleep_indicator(self, text):
        """Обновить индикатор таймера сна — стильный бейдж в player bar."""
        try:
            if hasattr(self, "sleep_timer_badge") and self.sleep_timer_badge.winfo_exists():
                if text:
                    # Вычисляем ширину на основе длины текста (≈7px на символ)
                    w = max(60, len(text) * 9 + 16)
                    self.sleep_timer_badge.configure(width=w)
                    self.sleep_timer_label.configure(text=text)
                else:
                    self.sleep_timer_badge.configure(width=0)
                    self.sleep_timer_label.configure(text="")
        except Exception:
            pass

    def _toast(self, msg, duration=2500):
        if hasattr(self, 'status_label'):
            self.status_label.configure(text=msg, text_color=self.theme["accent"])
            self.after(duration, self._fade_out_toast)

    def _fade_out_toast(self):
        try:
            if hasattr(self, 'status_label') and self.status_label.cget("text"):
                self._animate_opacity_label(self.status_label, 0.0, steps=15, delay=30,
                                              callback=lambda: self.status_label.configure(text=""))
            else:
                if hasattr(self, 'status_label'):
                    self.status_label.configure(text="")
        except Exception:
            pass

    # ──── VLC ─────────────────────────────────────────────────────
    def _init_vlc(self):
        try:
            self.vlc_instance = vlc.Instance("--no-video", "--quiet")
            self.player = self.vlc_instance.media_player_new()
            self.player_b = self.vlc_instance.media_player_new()
            em = self.player.event_manager()
            em.event_attach(vlc.EventType.MediaPlayerEndReached, self._on_track_ended)
            self.vlc_available = True
            log.info("VLC initialized successfully")
        except Exception as exc:
            self.vlc_available = False
            log.error("VLC initialization failed: %s", exc)
            print("VLC error:", exc)
            self.after(200, lambda: self._toast("⚠️ VLC не найден! Воспроизведение недоступно."))

    def _check_vlc(self):
        """Проверить доступность VLC. Возвращает True/False."""
        return getattr(self, 'vlc_available', False) and self.player is not None

    def _auto_cleanup_cache(self):
        """Удалить истёкшие записи из stream_cache (TTL=1ч)."""
        try:
            now = time.time()
            with self._lock_cache:
                expired = [vid for vid, entry in self.stream_cache.items()
                           if len(entry) > 2 and (now - entry[2]) > 3600]
                for vid in expired:
                    del self.stream_cache[vid]
                if expired:
                    log.info("Auto-cleaned %d expired stream cache entries", len(expired))
        except Exception as e:
            log.debug("Auto cache cleanup error: %s", e)
        finally:
            if self.running:
                self.after(300000, self._auto_cleanup_cache)

    def _on_track_ended(self, event):
        self.after(0, self._handle_track_end)

    def _handle_track_end(self):
        if self.crossfade_active:
            self._finish_crossfade()
            return
        if self.repeat_mode == 1 and self.current_track:
            self.play(self.current_track)
            return
        next_idx = self._get_next_track_index()
        if next_idx < 0 and self.radio_mode and self.current_track:
            # Radio mode: find similar tracks
            self.executor.submit(self._bg_radio_next)
            return
        self.next_track()

    def _cleanup(self):
        """Сохранить состояние и освободить ресурсы при выходе."""
        self.running = False
        # Save playback state
        self._save_playback_state()
        # Save search cache (limit to 150 entries)
        try:
            with self._lock_cache:
                cache_to_save = dict(list(self.search_cache.items())[:150])
            self._save_json(self.search_cache_file, cache_to_save)
        except Exception:
            pass
        # Save downloaded tracks index
        self._save_json(self.downloaded_tracks_file, self.downloaded_tracks)
        # Stop VLC
        if self.player:
            self.player.stop()
        if self.player_b:
            self.player_b.stop()
        if self.vlc_instance:
            self.vlc_instance.release()
        self.executor.shutdown(wait=False)
        self.http.close()

    def _save_playback_state(self):
        """Сохранить текущий трек и позицию для восстановления при запуске."""
        if not self.current_track or not self._check_vlc():
            return
        try:
            vid = self.current_track.get("videoId", "")
            if not vid:
                return
            ms = 0
            if self.player:
                try:
                    ms = self.player.get_time()
                except Exception:
                    pass
            # Only save if played > 10 seconds
            if ms < 10000:
                return
            state = {
                "videoId": vid,
                "track": self.current_track,
                "position": ms,
                "timestamp": time.time(),
            }
            self._save_json(self.playback_state_file, state)
        except Exception as e:
            log.debug("Failed to save playback state: %s", e)

    def _restore_playback_state(self):
        """Восстановить позицию воспроизведения из сохранённого состояния."""
        if not self._saved_track or not self._check_vlc():
            return
        try:
            self.play(self._saved_track)
            # Restore position after a short delay to let stream load
            def _restore_pos():
                if self._saved_position > 0 and self.player:
                    try:
                        self.player.set_time(int(self._saved_position))
                        log.info("Restored playback position: %d ms", int(self._saved_position))
                    except Exception as e:
                        log.debug("Failed to restore position: %s", e)
            self.after(2000, _restore_pos)
        except Exception as e:
            log.debug("Failed to restore playback state: %s", e)

    # ──── Горячие клавиши ─────────────────────────────────────────
    def _setup_bindings(self):
        self.bind_all("<space>", self._on_space)
        self.bind_all("<Left>", self._on_left)
        self.bind_all("<Right>", self._on_right)
        self.bind_all("<Up>", lambda e: self._change_vol_kbd(5))
        self.bind_all("<Down>", lambda e: self._change_vol_kbd(-5))
        # M — mute/unmute
        self.bind_all("<m>", self._on_mute_key)
        self.bind_all("<M>", self._on_mute_key)
        # Shift+Left/Right — перемотка ±10 сек
        self.bind_all("<Shift-Left>", self._on_seek_back)
        self.bind_all("<Shift-Right>", self._on_seek_fwd)
        # N — следующий трек, P — предыдущий
        self.bind_all("<n>", lambda e: self.next_track())
        self.bind_all("<N>", lambda e: self.next_track())
        # Ctrl+R — toggle radio mode
        self.bind_all("<Control-r>", self._toggle_radio_key)
        self.bind_all("<Control-R>", self._toggle_radio_key)
        # Mousewheel обрабатывается через monkey-patch CTkScrollableFrame
        # (см. начало файла). Fallback для случаев, когда ни один
        # ScrollableFrame не активен (курсор на player_bar и т.п.):
        self.bind_all("<MouseWheel>", self._mw_fallback)
        self.bind_all("<Button-1>", self._on_any_click, add="+")
        # Drag-and-drop support (tkinter dnd)
        self._setup_drag_and_drop()

        # System tray icon
        self._tray_icon = None
        self.after(500, self._setup_tray)

        # Close to tray
        self.protocol("WM_DELETE_WINDOW", self._on_window_close)

    def _on_any_click(self, event):
        """Закрыть контекстное меню при клике в любом месте.
        Игнорирует клик, который только что открыл меню (защита от мгновенного закрытия)."""
        # Защита: если меню только что открыто — не закрываем
        if getattr(self, '_ctx_menu_just_opened', False):
            return
        if hasattr(self, '_ctx_menu') and self._ctx_menu:
            try:
                if not self._ctx_menu.winfo_exists():
                    self._ctx_menu = None
                    return
                # Если клик был не внутри меню — закрыть
                mx, my = event.x_root, event.y_root
                cx = self._ctx_menu.winfo_rootx()
                cy = self._ctx_menu.winfo_rooty()
                cw = self._ctx_menu.winfo_width()
                ch = self._ctx_menu.winfo_height()
                if not (cx <= mx <= cx + cw and cy <= my <= cy + ch):
                    self._close_context_menu()
            except Exception:
                self._ctx_menu = None

    def _mw_fallback(self, event):
        """Fallback: громкость на player_bar, скролл основного контента на остальной области."""
        try:
            w = self.winfo_containing(event.x_root, event.y_root)
            if w is not None and self._is_widget_inside(w, self.player_bar):
                delta = 3
                if hasattr(event, 'num') and event.num == 5:
                    delta = -3
                elif hasattr(event, 'delta') and event.delta < 0:
                    delta = -3
                new_vol = max(0, min(100, self.vol_slider.get() + delta))
                self.vol_slider.set(new_vol)
                self._vol_change(new_vol)
                return "break"
            # Скролл основного контента (self.scroll) если курсор над ним
            scroll_parent = getattr(self.scroll, '_parent_frame', None)
            scroll_canvas = getattr(self.scroll, '_parent_canvas', None)
            if w is not None and scroll_parent is not None and scroll_canvas is not None:
                if self._is_widget_inside(w, scroll_parent):
                    if scroll_canvas.yview() != (0.0, 1.0):
                        if sys.platform.startswith("win"):
                            scroll_canvas.yview("scroll", -int(event.delta / 6), "units")
                        elif sys.platform == "darwin":
                            scroll_canvas.yview("scroll", -event.delta, "units")
                        else:
                            scroll_canvas.yview("scroll", -event.delta, "units")
                    return "break"
        except Exception:
            pass
        return None

    def _is_widget_inside(self, widget, parent):
        """Проверяет, является ли widget потомком parent (включая сам parent)."""
        try:
            w = widget
            depth = 0
            while w and depth < 30:
                if w is parent:
                    return True
                w = w.master
                depth += 1
        except Exception:
            pass
        return False

    def _on_space(self, event):
        focus = self.focus_get()
        if isinstance(focus, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        self._toggle_play()

    def _on_left(self, event):
        focus = self.focus_get()
        if isinstance(focus, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        self.prev_track()

    def _on_right(self, event):
        focus = self.focus_get()
        if isinstance(focus, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        self.next_track()

    def _on_mute_key(self, event):
        focus = self.focus_get()
        if isinstance(focus, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        self._toggle_mute()

    def _on_seek_back(self, event):
        """Перемотка назад на 10 секунд."""
        focus = self.focus_get()
        if isinstance(focus, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        if self.player and self.current_duration > 0:
            try:
                ms = self.player.get_time()
                new_ms = max(0, ms - 10000)
                self.player.set_time(new_ms)
                self._toast(f"⟵ {new_ms // 1000 // 60}:{new_ms // 1000 % 60:02d}", duration=800)
            except Exception:
                pass

    def _on_seek_fwd(self, event):
        """Перемотка вперёд на 10 секунд."""
        focus = self.focus_get()
        if isinstance(focus, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        if self.player and self.current_duration > 0:
            try:
                ms = self.player.get_time()
                new_ms = min(self.current_duration * 1000, ms + 10000)
                self.player.set_time(new_ms)
                self._toast(f"⟶ {new_ms // 1000 // 60}:{new_ms // 1000 % 60:02d}", duration=800)
            except Exception:
                pass

    def _change_vol_kbd(self, delta):
        new_vol = max(0, min(100, self.vol_slider.get() + delta))
        self.vol_slider.set(new_vol)
        self._vol_change(new_vol)
        # Update volume icon
        if new_vol == 0:
            self.btn_vol.configure(text="\U0001f507")
        elif new_vol < 50:
            self.btn_vol.configure(text="\U0001f509")
        else:
            self.btn_vol.configure(text="\U0001f50a")
        if hasattr(self, 'vol_pct_label') and self.vol_pct_label.winfo_exists():
            self.vol_pct_label.configure(text=f"{new_vol}%")

    def _setup_drag_and_drop(self):
        """Настройка drag-and-drop для файлов и плейлистов."""
        self._dnd_available = False
        try:
            if not hasattr(self, 'drop_target_register'):
                log.info("Drag-and-drop: tkinterdnd2 not installed")
                return
            self.drop_target_register('DND_Files')
            self.dnd_bind('<<Drop>>', self._on_drop)
            self._dnd_available = True
            log.info("tkinterdnd2 drag-and-drop enabled")
        except Exception as e:

            log.info("Drag-and-drop unavailable: %s", e)

    def _setup_tray(self):
        """Настроить системный трей с управлением плеером."""
        try:
            from pystray import Icon, Menu, MenuItem
            from PIL import Image as PILImage
            img = PILImage.new('RGBA', (64, 64), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            accent_rgb = self._hex_to_rgb(self.theme.get("accent", "#e03131"))
            d.ellipse([12, 30, 30, 48], fill=accent_rgb)
            d.rectangle([26, 10, 30, 34], fill=accent_rgb)
            d.ellipse([26, 8, 46, 26], fill=accent_rgb)

            def _toggle_play(icon, item):
                self.after(0, self._toggle_play)
            def _next_track(icon, item):
                self.after(0, self.next_track)
            def _prev_track(icon, item):
                self.after(0, self.prev_track)
            def _vol_up(icon, item):
                self.after(0, lambda: self._change_vol_kbd(10))
            def _vol_down(icon, item):
                self.after(0, lambda: self._change_vol_kbd(-10))
            def _show_win(icon, item):
                self.after(0, self._show_and_raise)
            def _exit_app(icon, item):
                self.after(0, self._on_close_from_tray)

            menu = Menu(
                MenuItem('Play/Pause', _toggle_play, default=True),
                MenuItem('Next', _next_track),
                MenuItem('Prev', _prev_track),
                Menu.SEPARATOR,
                MenuItem('Vol +', _vol_up),
                MenuItem('Vol -', _vol_down),
                Menu.SEPARATOR,
                MenuItem('Show', _show_win),
                Menu.SEPARATOR,
                MenuItem('Exit', _exit_app),
            )
            self._tray_icon = Icon('mq', img, 'mq Music Player', menu)
            self._tray_thread = threading.Thread(target=self._tray_icon.run, daemon=True)
            self._tray_thread.start()
            log.info("System tray icon initialized")
        except ImportError:
            log.info("pystray not installed - tray disabled")
        except Exception as e:
            log.debug("Tray setup error: %s", e)

    def _show_and_raise(self):
        """Показать и поднять окно."""
        try:
            self.deiconify()
            self.lift()
            self.focus_force()
        except Exception:
            pass

    def _on_window_close(self):
        """Свернуть в трей вместо закрытия."""
        if self._tray_icon:
            self.withdraw()
        else:
            self._cleanup()
            self.destroy()

    def _on_close_from_tray(self):
        """Закрыть приложение из трея."""
        try:
            if self._tray_icon:
                self._tray_icon.stop()
        except Exception:
            pass
        self._cleanup()
        self.destroy()
        sys.exit(0)

    def _on_drop(self, event):
        """Обработка drag-and-drop файлов."""
        self._process_dropped_paths(event.data)

    def _on_drop_tkdnd(self, event):
        """Обработка drag-and-drop через tkdnd."""
        self._process_dropped_paths(event.data)

    def _process_dropped_paths(self, data: str):
        """Обработать перетащённые файлы/папки. Корректно разбирает пути с пробелами."""
        try:
            raw = data.strip()
            if not raw:
                return
            paths = []
            if '\n' in raw or '\r' in raw:
                paths = [p.strip().strip('{}') for p in raw.replace('\r', '\n').split('\n') if p.strip()]
            else:
                import shlex
                try:
                    paths = shlex.split(raw, posix=(sys.platform != "win32"))
                except ValueError:
                    paths = [p.strip().strip('{}') for p in raw.split()]
            for path in paths:
                path = path.strip().strip('{}').strip('"')
                if not path or not os.path.exists(path):
                    continue
                if os.path.isfile(path):
                    ext = os.path.splitext(path)[1].lower()
                    if ext in ('.m3u', '.m3u8'):
                        self._handle_dropped_m3u(path)
                    elif ext in ('.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.wma', '.aac'):
                        self._play_local_file(path)
                elif os.path.isdir(path):
                    self._scan_folder_for_music(path)
        except Exception as e:
            log.error("Drop processing error: %s", e)
            self._toast(f"Ошибка при обработке: {str(e)[:40]}")

    def _handle_dropped_m3u(self, path: str):
        """Импортировать M3U файл из drag-and-drop. Поддерживает относительные пути."""
        try:
            base_dir = os.path.dirname(os.path.abspath(path))
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            entries = []
            current_title = ""
            for line in lines:
                line = line.strip()
                if line.startswith("#EXTINF:"):
                    parts = line.split(",", 1)
                    if len(parts) > 1:
                        current_title = parts[1].strip()
                elif line and not line.startswith("#"):
                    url = line
                    # Resolve relative paths
                    if not url.startswith(('http://', 'https://', 'ftp://')) and not url.startswith('/'):
                        abs_path = os.path.normpath(os.path.join(base_dir, url))
                        if os.path.isfile(abs_path):
                            url = abs_path
                    entries.append({"title": current_title, "url": url})
                    current_title = ""
            if not entries:
                self._toast("M3U файл пуст")
                return
            # Check if all local — play directly
            if all(os.path.isfile(e.get("url", "")) for e in entries):
                tracks = []
                for entry in entries:
                    fpath = entry["url"]
                    filename = os.path.splitext(os.path.basename(fpath))[0]
                    parts = filename.split(" - ", 1) if " - " in filename else [filename, ""]
                    artist = parts[0].strip()
                    title = parts[1].strip() if len(parts) > 1 else artist
                    tracks.append({
                        "title": title or filename, "artists": [{"name": artist}],
                        "videoId": f"local_{hashlib.md5(fpath.encode()).hexdigest()[:12]}",
                        "duration_seconds": 0, "thumbnails": [], "_local_path": fpath,
                    })
                if tracks:
                    self.tracks = tracks
                    self.current_view = "m3u"
                    self.nav_title.configure(text=f"🎵 {os.path.basename(path)}")
                    self._clear()
                    ctk.CTkLabel(self.scroll, text=f"🎵  {os.path.basename(path)}",
                                 font=("Arial", 16, "bold"), text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(8, 4))
                    ctk.CTkLabel(self.scroll, text=f"{len(tracks)} треков",
                                 font=("Arial", 13), text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 12))
                    for t in tracks:
                        self._track_row(t)
                    self._toast(f"🎵 Загружено {len(tracks)} треков из M3U")
                    return
            self._toast(f"📁 Импорт M3U: {len(entries)} треков...")
            self.executor.submit(self._bg_import_m3u, entries)
        except Exception as e:
            log.error("M3U drop error: %s", e)

    def _play_local_file(self, path: str):
        """Воспроизвести локальный аудиофайл."""
        if not self._check_vlc():
            self._toast("VLC недоступен")
            return
        try:
            filename = os.path.splitext(os.path.basename(path))[0]
            # Try to parse "artist - title" from filename
            parts = filename.split(" - ", 1) if " - " in filename else [filename, ""]
            artist = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else artist
            track = {
                "title": title or filename,
                "artists": [{"name": artist}],
                "videoId": f"local_{hashlib.md5(path.encode()).hexdigest()[:12]}",
                "duration_seconds": 0,
                "thumbnails": [],
                "_local_path": path,
            }
            # Stop current playback
            if self.player:
                try:
                    self.player.stop()
                except Exception:
                    pass
            self.current_track = track
            self.current_playlist = None
            self.pb_title.configure(text=title[:40])
            self.pb_artist.configure(text=artist[:40])
            self.btn_play.configure(text="⏸")
            self._add_to_history(track)
            # Play via VLC
            with self._lock_player:
                m = self.vlc_instance.media_new(path)
                self.player.set_media(m)
                self.player.play()
                self.player.audio_set_volume(int(self.vol_slider.get()))
            self.current_duration = 0
            # Restore position for local files
            saved_state = self._load_json(self.playback_state_file, {})
            if isinstance(saved_state, dict) and saved_state.get("videoId") == track.get("videoId"):
                pos_ms = saved_state.get("position", 0)
                if pos_ms > 1000:
                    def _restore_local_pos():
                        try:
                            if self.player and self.player.is_playing():
                                self.player.set_time(int(pos_ms))
                                log.info("Restored local file position: %d ms", int(pos_ms))
                        except Exception:
                            pass
                    self.after(1000, _restore_local_pos)
            self._toast(f"▶ {title[:30]}")
        except Exception as e:
            log.error("Local file playback error: %s", e)
            self._toast(f"Ошибка воспроизведения: {str(e)[:40]}")

    def _scan_folder_for_music(self, folder_path: str):
        """Рекурсивно сканировать папку на наличие аудиофайлов."""
        audio_exts = {'.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.wma', '.aac'}
        files = []
        try:
            for root, dirs, fnames in os.walk(folder_path):
                dirs.sort()
                for fname in sorted(fnames):
                    if os.path.splitext(fname)[1].lower() in audio_exts:
                        files.append(os.path.join(root, fname))
        except Exception as e:
            log.error("Folder scan error: %s", e)
            return
        if not files:
            self._toast("Аудиофайлы не найдены в папке")
            return
        files.sort()
        # Build tracks list from files
        tracks = []
        for fpath in files:
            filename = os.path.splitext(os.path.basename(fpath))[0]
            parts = filename.split(" - ", 1) if " - " in filename else [filename, ""]
            artist = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else artist
            tracks.append({
                "title": title or filename,
                "artists": [{"name": artist}],
                "videoId": f"local_{hashlib.md5(fpath.encode()).hexdigest()[:12]}",
                "duration_seconds": 0,
                "thumbnails": [],
                "_local_path": fpath,
            })
        self.tracks = tracks
        self.current_view = "folder"
        self.nav_title.configure(text=f"📁 {os.path.basename(folder_path)}")
        self._clear()
        ctk.CTkLabel(self.scroll, text=f"📁  {os.path.basename(folder_path)}",
                     font=("Arial", 16, "bold"), text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(8, 4))
        ctk.CTkLabel(self.scroll, text=f"{len(tracks)} аудиофайлов",
                     font=("Arial", 13), text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 12))
        for t in tracks:
            self._track_row(t)
        self._toast(f"📁 Загружено {len(tracks)} треков из папки")

    # ──── Плейсхолдеры ────────────────────────────────────────────
    def _draw_music_note(self, draw, cx, cy, size):
        """Draw a music note icon (♪) centered at (cx, cy) for given size."""
        s = min(size) / 160.0  # scale factor based on 160px reference
        accent_rgb = self._hex_to_rgb(self.theme["accent"])
        # Blend accent with button bg for low opacity look
        btn_rgb = self._hex_to_rgb(self.theme["button"])
        note_color = self._rgb_to_hex(self._blend_colors(btn_rgb, accent_rgb, 0.45))
        lw = max(2, int(3 * s))
        # Note head (filled ellipse)
        hx, hy = cx - int(18 * s), cy + int(20 * s)
        rx, ry = int(14 * s), int(10 * s)
        draw.ellipse([hx - rx, hy - ry, hx + rx, hy + ry], fill=note_color)
        # Stem (vertical line going up)
        sx = hx + int(13 * s)
        draw.line([(sx, hy - int(2 * s)), (sx, cy - int(35 * s))], fill=note_color, width=lw)
        # Flag (curved tail at top of stem)
        flag_pts = [
            (sx, cy - int(35 * s)),
            (sx + int(16 * s), cy - int(22 * s)),
            (sx + int(8 * s), cy - int(12 * s)),
        ]
        draw.line(flag_pts, fill=note_color, width=lw)

    def _build_placeholders(self):
        for tag, size in [("sm", (50, 50)), ("lg", (64, 64)), ("card", (165, 165))]:
            img = Image.new("RGB", size, self.theme["button"])
            d = ImageDraw.Draw(img)
            cx, cy = size[0] // 2, size[1] // 2
            self._draw_music_note(d, cx, cy, size)
            self.placeholders[tag] = ctk.CTkImage(light_image=img, dark_image=img, size=size)

    # ──── Тема ────────────────────────────────────────────────────
    def _apply_appearance(self):
        ctk.set_appearance_mode("dark")  # все темы тёмные
        self.configure(fg_color=self.theme["bg"])
        # Пересоздать placeholders под новую тему
        if hasattr(self, 'placeholders') and self.placeholders:
            self._build_placeholders()

    def _get_cached_stream(self, vid: str) -> Optional[Tuple[str, float]]:
        """Get cached stream with TTL check (1 hour). Returns (url, duration) or None.
        Thread-safe: grabs _lock_cache internally."""
        with self._lock_cache:
            entry = self.stream_cache.get(vid)
            if not entry:
                return None
            if len(entry) > 2 and (time.time() - entry[2]) > 3600:
                del self.stream_cache[vid]
                log.info("Stream cache expired for %s", vid)
                return None
            return entry[0], entry[1]

    # ──── Лайки и дизлайки ────────────────────────────────────────
    def _is_liked(self, track: dict) -> bool:
        return track.get("videoId") in self._liked_ids

    def _toggle_like(self, track: dict) -> None:
        vid = track.get("videoId")
        if not vid: return
        with self._lock_playlists:
            if self._is_liked(track):
                self.liked_playlist = [t for t in self.liked_playlist if t.get("videoId") != vid]
                self._liked_ids.discard(vid)
            else:
                self.liked_playlist.append(track)
                self._liked_ids.add(vid)
            self._save_json(self.liked_file, self.liked_playlist)
        # Обновить liked-экран если открыт
        if self.current_view == "liked":
            self.after_idle(self._show_liked)

    def _dislike(self, track):
        vid = track.get("videoId")
        if not vid: return
        self.disliked.add(vid)
        self._save_json(self.disliked_file, list(self.disliked))
        self.recommendations_cache = []
        if self.current_view == "main":
            self.show_main()

    # ──── История ─────────────────────────────────────────────────
    def _add_to_history(self, track: dict) -> None:
        vid = track.get("videoId")
        if not vid: return
        with self._lock_playlists:
            key = str(vid)
            entry = self.history.get(key, {
                "videoId": vid,
                "title": track.get("title", ""),
                "artist": track.get("artists", [{}])[0].get("name", ""),
                "thumbnails": track.get("thumbnails", []),
                "play_count": 0,
            })
            entry["play_count"] = entry.get("play_count", 0) + 1
            entry["last_played"] = time.time()
            entry["track"] = track
            self.history[key] = entry
            self._save_json(self.history_file, self.history)

    # ──── Экраны ──────────────────────────────────────────────────
    def _show_liked(self):
        self.current_view = "liked"
        self.nav_title.configure(text="Любимое")
        self._update_nav_for_view()
        self._clear()
        tracks = self.liked_playlist or []
        self.tracks = tracks[:]
        # Сбросить shuffle_order при смене списка треков
        if self.is_shuffle:
            self.shuffle_order = self._smart_shuffle()
        if not tracks:
            ctk.CTkLabel(self.scroll, text="💔", font=("Arial", 40), text_color=self.theme["text_secondary"]).pack(pady=(30, 8))
            ctk.CTkLabel(self.scroll, text="Пока нет понравившихся треков",
                         font=("Arial", 14), text_color=self.theme["text_secondary"]).pack(pady=(0, 30))
            return
        ctk.CTkLabel(self.scroll, text=f"{len(tracks)} треков", font=("Arial", 13),
                     text_color=self.theme["text_secondary"], anchor="w").pack(fill="x", padx=4, pady=(4, 8))
        for t in tracks:
            self._track_row(t)

    def _show_offline(self):
        """Показать скачанные треки (офлайн-режим)."""
        self.current_view = "offline"
        self.nav_title.configure(text="Офлайн")
        self._update_nav_for_view()
        self._clear()

        if not self.downloaded_tracks:
            ctk.CTkLabel(self.scroll, text="💾", font=("Arial", 40),
                         text_color=self.theme["text_secondary"]).pack(pady=(30, 8))
            ctk.CTkLabel(self.scroll, text="Нет скачанных треков",
                         font=("Arial", 14), text_color=self.theme["text_secondary"]).pack(pady=(0, 6))
            ctk.CTkLabel(self.scroll, text="Скачайте треки через контекстное меню → 💾 Скачать",
                         font=("Arial", 12), text_color=self.theme["text_secondary"]).pack(pady=(0, 6))
            ctk.CTkLabel(self.scroll, text=f"📁 Папка загрузок: {self.downloads_dir}",
                         font=("Arial", 11), text_color=self.theme["text_secondary"]).pack(pady=(0, 6))
            # Open folder button
            def open_folder():
                try:
                    if sys.platform == "win32":
                        os.startfile(self.downloads_dir)
                    elif sys.platform == "darwin":
                        os.system(f'open "{self.downloads_dir}"')
                    else:
                        os.system(f'xdg-open "{self.downloads_dir}"')
                except Exception:
                    pass
            ctk.CTkButton(self.scroll, text="📂  Открыть папку", command=open_folder,
                          fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                          text_color=self.theme["text"], corner_radius=10, height=36,
                          font=("Arial", 12)).pack(pady=(10, 30))
            return

        tracks = []
        for vid, path in self.downloaded_tracks.items():
            if not os.path.isfile(path):
                continue
            filename = os.path.splitext(os.path.basename(path))[0]
            parts = filename.split(" - ", 1) if " - " in filename else [filename, ""]
            artist = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else artist
            # Get file size
            size_mb = os.path.getsize(path) / (1024 * 1024)
            tracks.append({
                "title": title or filename,
                "artists": [{"name": artist}],
                "videoId": vid,
                "duration_seconds": 0,
                "thumbnails": [],
                "_local_path": path,
                "_file_size": f"{size_mb:.1f} MB",
            })

        ctk.CTkLabel(self.scroll, text=f"💾  Скачанные треки",
                     font=("Arial", 16, "bold"), text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(8, 4))
        ctk.CTkLabel(self.scroll, text=f"{len(tracks)} треков • {self.downloads_dir}",
                     font=("Arial", 12), text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 12))

        # Open folder button
        offline_btn_row = ctk.CTkFrame(self.scroll, fg_color="transparent")
        offline_btn_row.pack(fill="x", padx=4, pady=(0, 8))

        def open_folder():
            try:
                if sys.platform == "win32":
                    os.startfile(self.downloads_dir)
                elif sys.platform == "darwin":
                    os.system(f'open "{self.downloads_dir}"')
                else:
                    os.system(f'xdg-open "{self.downloads_dir}"')
            except Exception:
                pass

        ctk.CTkButton(offline_btn_row, text="📂  Открыть папку", command=open_folder,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], corner_radius=8, height=32,
                      font=("Arial", 12)).pack(side="left", padx=(0, 8))

        def refresh_offline():
            # Re-validate files
            self.downloaded_tracks = {vid: path for vid, path in self.downloaded_tracks.items()
                                       if os.path.isfile(path)}
            self._save_json(self.downloaded_tracks_file, self.downloaded_tracks)
            self._show_offline()

        ctk.CTkButton(offline_btn_row, text="🔄  Обновить", command=refresh_offline,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], corner_radius=8, height=32,
                      font=("Arial", 12)).pack(side="left")

        # Track rows with size info
        self.tracks = tracks[:]
        if self.is_shuffle:
            self.shuffle_order = self._smart_shuffle()
        for t in tracks:
            self._offline_track_row(t)

    def _offline_track_row(self, track):
        """Строка скачанного трека с информацией о файле."""
        row = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=10, height=64,
                           cursor="hand2", border_width=1,
                           border_color=self.theme.get("card_border", self.theme["divider"]))
        row.pack(fill="x", pady=2, padx=4)
        row.pack_propagate(False)

        # File icon instead of cover
        ctk.CTkLabel(row, text="🎵", font=("Segoe UI Emoji", 20), width=48, height=48,
                     text_color=self.theme["accent"]).pack(side="left", padx=(14, 12), pady=8)

        info = ctk.CTkFrame(row, fg_color="transparent")
        info.pack(side="left", fill="both", expand=True, pady=8)
        ctk.CTkLabel(info, text=track.get("title", "?")[:55], font=("Arial", 13, "bold"),
                     text_color=self.theme["text"], anchor="w").pack(fill="x")
        artist = track.get("artists", [{}])[0].get("name", "")
        size = track.get("_file_size", "")
        ext = os.path.splitext(track.get("_local_path", ""))[1].upper().strip(".")
        subtitle = f"{artist}  •  {ext}  •  {size}" if artist else f"{ext}  •  {size}"
        ctk.CTkLabel(info, text=subtitle, font=("Arial", 11),
                     text_color=self.theme["text_secondary"], anchor="w").pack(fill="x")

        # Buttons
        bf = ctk.CTkFrame(row, fg_color="transparent")
        bf.pack(side="right", padx=12)
        ctk.CTkButton(bf, text="▶", width=28, height=28, corner_radius=14,
                      fg_color="transparent", hover_color=self.theme["button_hover"],
                      text_color=self.theme["accent"], font=("Segoe UI Emoji", 13),
                      command=lambda t=track: self._play_local_file(t.get("_local_path"))).pack(side="left", padx=2)

        # Delete button
        ctk.CTkButton(bf, text="🗑", width=28, height=28, corner_radius=14,
                      fg_color="transparent", hover_color=self.theme["button_hover"],
                      text_color=self.theme["text_secondary"], font=("Segoe UI Emoji", 12),
                      command=lambda t=track, r=row: self._delete_downloaded(t, r)).pack(side="left", padx=2)

        # Context menu button (⋮) — через command, не bind
        def _show_ctx_offline(t=track, r=row):
            try:
                x = ctx_btn.winfo_rootx() + ctx_btn.winfo_width()
                y = ctx_btn.winfo_rooty() + ctx_btn.winfo_height() // 2
            except Exception:
                x, y = 100, 100
            event = type('Event', (), {'x_root': x, 'y_root': y})()
            self._show_offline_context_menu(event, t, r)
        ctx_btn = ctk.CTkButton(bf, text="⋮", width=26, height=26, corner_radius=13,
                                fg_color="transparent", hover_color=self.theme["button_hover"],
                                text_color=self.theme["text_secondary"], font=("Arial", 14, "bold"),
                                cursor="hand2", command=_show_ctx_offline)
        ctx_btn.pack(side="left", padx=2)

        # Hover effect
        bg_orig = self.theme["card"]
        border_orig = self.theme.get("card_border", self.theme["divider"])
        def on_enter(e, r=row, bgo=bg_orig):
            try:
                if r.winfo_exists():
                    r.configure(border_color=self.theme["accent"], fg_color=self._darken(bgo, 8))
            except Exception: pass
        def on_leave(e, r=row, bgo=bg_orig, bo=border_orig):
            try:
                if r.winfo_exists():
                    r.configure(border_color=bo, fg_color=bgo)
            except Exception: pass
        self._bind_hover_recursive(row, on_enter, on_leave)

        # Double-click to play
        row.bind("<Double-Button-1>", lambda e, t=track: self._play_local_file(t.get("_local_path")))

    def _delete_downloaded(self, track, row_widget):
        """Удалить скачанный файл и убрать из списка."""
        vid = track.get("videoId", "")
        path = track.get("_local_path", "")
        if vid:
            self.downloaded_tracks.pop(vid, None)
            self._save_json(self.downloaded_tracks_file, self.downloaded_tracks)
        try:
            if row_widget.winfo_exists():
                row_widget.destroy()
        except Exception:
            pass
        self._toast("🗑 Трек удалён")
        # Refresh if list is empty
        if not self.downloaded_tracks:
            self.after(500, self._show_offline)

    def _show_offline_context_menu(self, event, track, row_widget):
        """Контекстное меню для скачанного трека."""
        self._close_context_menu()

        self._ctx_menu_just_opened = True
        path = track.get("_local_path", "")

        self._ctx_menu = tk.Toplevel(self)
        self._ctx_menu.overrideredirect(True)
        try:
            self._ctx_menu.attributes("-topmost", True)
            if sys.platform == "win32":
                try:
                    self._ctx_menu.attributes("-alpha", 0.97)
                except Exception: pass
        except Exception: pass
        self._ctx_menu.configure(bg=self.theme["bg"])

        shadow = tk.Frame(self._ctx_menu, bg=self._darken(self.theme["bg"], 20), padx=4, pady=4)
        shadow.pack(fill="both", expand=True)
        main = ctk.CTkFrame(shadow, fg_color=self.theme["card"], corner_radius=12,
                            border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        main.pack(fill="both", expand=True)

        # Header
        header = ctk.CTkFrame(main, fg_color=self.theme["accent_soft"], corner_radius=10, height=42)
        header.pack(fill="x", padx=8, pady=(8, 2))
        header.pack_propagate(False)
        ctk.CTkLabel(header, text=f"💾  {track.get('title', '?')[:35]}",
                     font=("Arial", 12, "bold"), text_color=self.theme["text"]).pack(fill="x", padx=8, pady=(4, 0))

        items = [
            ("▶  Воспроизвести", lambda: (self._play_local_file(path), self._close_context_menu())),
            None,
            ("📂  Открыть в проводнике", lambda: (self._open_file_explorer(path), self._close_context_menu())),
            None,
            ("🗑  Удалить файл", lambda: (self._delete_downloaded(track, row_widget), self._close_context_menu())),
        ]

        for item in items:
            if item is None:
                ctk.CTkFrame(main, height=1, fg_color=self.theme["divider"]).pack(fill="x", padx=12, pady=4)
                continue
            label, cmd = item
            btn = ctk.CTkButton(main, text=label, fg_color="transparent",
                               hover_color=self.theme["button_hover"],
                               text_color=self.theme["text"], font=("Arial", 12),
                               height=34, corner_radius=8, anchor="w", command=cmd, cursor="hand2")
            btn.pack(fill="x", padx=8, pady=1)

        self._ctx_menu.update_idletasks()
        w = self._ctx_menu.winfo_reqwidth()
        h = self._ctx_menu.winfo_reqheight()
        x, y = event.x_root, event.y_root
        sw = self._ctx_menu.winfo_screenwidth()
        sh = self._ctx_menu.winfo_screenheight()
        if x + w > sw - 5: x = sw - w - 5
        if y + h > sh - 5: y = sh - h - 5
        self._ctx_menu.geometry(f"+{x}+{y}")
        self._ctx_menu.bind("<FocusOut>", lambda e: self.after(50, self._close_context_menu))
        self._ctx_menu.focus_set()
        self.after(150, lambda: setattr(self, '_ctx_menu_just_opened', False))

    def _open_file_explorer(self, path):
        """Открыть файл в системном проводнике."""
        if not path or not os.path.isfile(path):
            return
        try:
            folder = os.path.dirname(path)
            if sys.platform == "win32":
                os.startfile(folder)
            elif sys.platform == "darwin":
                os.system(f'open -R "{path}"')
            else:
                os.system(f'xdg-open "{folder}"')
        except Exception:
            pass

    def _show_history(self):
        self.current_view = "history"
        self.nav_title.configure(text="История")
        self._update_nav_for_view()
        self._clear()
        if not self.history:
            ctk.CTkLabel(self.scroll, text="📜", font=("Arial", 40), text_color=self.theme["text_secondary"]).pack(pady=(30, 8))
            ctk.CTkLabel(self.scroll, text="История пока пуста",
                         font=("Arial", 14), text_color=self.theme["text_secondary"]).pack(pady=(0, 30))
            return
        items = sorted(self.history.values(), key=lambda x: x.get("last_played", 0), reverse=True)
        ctk.CTkLabel(self.scroll, text=f"{len(items)} треков", font=("Arial", 13),
                     text_color=self.theme["text_secondary"], anchor="w").pack(fill="x", padx=4, pady=(4, 8))
        ordered_tracks = []
        for entry in items:
            track = entry.get("track") or entry
            ordered_tracks.append(track)
            self._track_row(track)
        self.tracks = ordered_tracks

    def _show_settings(self):
        self.current_view = "settings"
        self.nav_title.configure(text="Настройки")
        self._update_nav_for_view()
        self._clear()

        # Автосохранение с debounce
        _auto_save_job = [None]

        def _auto_save():
            """Сохраняет все настройки и применяет их мгновенно."""
            # Тема
            self.settings["theme"] = theme_var.get()
            # Кроссфейд
            self.is_crossfade = crossfade_var.get()
            self.settings["crossfade"] = self.is_crossfade
            self.btn_crossfade.configure(text_color=self.theme["accent"] if self.is_crossfade else self.theme["text_secondary"])
            # Длительность кроссфейда
            try:
                dur = max(1, min(15, int(cf_dur_var.get())))
            except ValueError:
                dur = 3
            self.crossfade_duration = float(dur)
            self.settings["crossfade_duration"] = self.crossfade_duration
            # Громкость
            vol = int(vol_var.get())
            self.settings["volume"] = vol
            if self.player:
                self.player.audio_set_volume(vol)
            self.vol_slider.set(vol)
            # Таймер сна
            val = sleep_var.get()
            mins = 0
            if "15" in val: mins = 15
            elif "30" in val: mins = 30
            elif "45" in val: mins = 45
            elif "60" in val: mins = 60
            self.sleep_timer_minutes = mins
            self.sleep_deadline = time.time() + mins * 60 if mins > 0 else None
            self._save_json(self.settings_file, self.settings)

        def _schedule_save():
            """Debounced автосохранение (500мс после последнего изменения)."""
            if _auto_save_job[0]:
                self.after_cancel(_auto_save_job[0])
            _auto_save_job[0] = self.after(500, _auto_save)

        def _divider(parent):
            ctk.CTkFrame(parent, height=1, fg_color=self.theme["divider"]).pack(fill="x", padx=18, pady=(0, 14))

        def _section_title(parent, text):
            ctk.CTkLabel(parent, text=text, font=("Arial", 14, "bold"),
                         text_color=self.theme["text"]).pack(anchor="w", padx=18, pady=(0, 6))

        def _hint(parent, text):
            ctk.CTkLabel(parent, text=text, font=("Arial", 11),
                         text_color=self.theme["text_secondary"], justify="left").pack(anchor="w", padx=18, pady=(0, 4))

        # ═══ Блок 1: Оформление ═══
        frame1 = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16,
                              border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        frame1.pack(fill="x", padx=10, pady=(10, 6))

        _section_title(frame1, "🎨  Оформление")
        _hint(frame1, "Тема применяется мгновенно. Настройки сохраняются автоматически.")

        theme_var = tk.StringVar(value=self.settings.get("theme", "red_black"))

        def _on_theme_change(selected_theme):
            """Мгновенное применение темы при выборе."""
            self.settings["theme"] = selected_theme
            self.theme = THEMES.get(selected_theme, THEMES["red_black"])
            self._apply_appearance()
            self._build_placeholders()
            # Сбросить цвет обложки к новой теме
            if hasattr(self, "player_bar"):
                self.player_bar.configure(fg_color=self.theme["sidebar"])
            self._reset_mixer_to_theme()
            # Перезапустить настройки чтобы отобразить новые цвета
            self.after_idle(self._show_settings)
            _schedule_save()

        theme_cb = ctk.CTkComboBox(frame1, values=list(THEMES.keys()), variable=theme_var, width=240,
                                   fg_color=self.theme["fg"], text_color=self.theme["text"],
                                   button_color=self.theme["button"],
                                   button_hover_color=self.theme["button_hover"],
                                   command=_on_theme_change)
        theme_cb.pack(anchor="w", padx=18, pady=(0, 16))

        # ═══ Блок 2: Воспроизведение ═══
        frame2 = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16,
                              border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        frame2.pack(fill="x", padx=10, pady=6)

        _section_title(frame2, "🎵  Воспроизведение")

        # Кроссфейд
        _hint(frame2, "Кроссфейд — плавный переход между треками.")
        crossfade_var = tk.BooleanVar(value=self.is_crossfade)
        cf_row = ctk.CTkFrame(frame2, fg_color="transparent")
        cf_row.pack(fill="x", padx=18, pady=(0, 8))
        ctk.CTkSwitch(cf_row, text="Кроссфейд", variable=crossfade_var, width=44,
                      fg_color=self.theme["button"], progress_color=self.theme["accent"],
                      text_color=self.theme["text"], font=("Arial", 13),
                      command=lambda: _schedule_save()).pack(side="left")

        cf_dur_var = tk.StringVar(value=str(int(self.crossfade_duration)))
        ctk.CTkLabel(cf_row, text="Длительность (сек):", font=("Arial", 12),
                     text_color=self.theme["text_secondary"]).pack(side="left", padx=(20, 6))
        cf_entry = ctk.CTkEntry(cf_row, textvariable=cf_dur_var, width=50, height=32,
                                fg_color=self.theme["fg"], text_color=self.theme["text"],
                                font=("Arial", 13))
        cf_entry.pack(side="left")
        cf_entry.bind("<Return>", lambda _: _schedule_save())
        cf_entry.bind("<FocusOut>", lambda _: _schedule_save())

        _divider(frame2)

        # Громкость при запуске
        _section_title(frame2, "🔊  Громкость при запуске")
        _hint(frame2, "Установите громкость, которая будет при открытии плеера.")
        vol_var = tk.DoubleVar(value=self.settings.get("volume", 80))
        vol_row = ctk.CTkFrame(frame2, fg_color="transparent")
        vol_row.pack(fill="x", padx=18, pady=(0, 8))
        ctk.CTkSlider(vol_row, from_=0, to=100, variable=vol_var, width=220, height=16,
                      fg_color=self.theme["progress_bg"], progress_color=self.theme["accent"],
                      button_color=self.theme["accent"],
                      button_hover_color=self._lighten(self.theme["accent"]),
                      command=lambda v: _schedule_save()).pack(side="left")
        vol_val_lbl = ctk.CTkLabel(vol_row, text=f"{int(vol_var.get())}%", width=40,
                                   font=("Arial", 12), text_color=self.theme["text"])
        vol_val_lbl.pack(side="left", padx=(10, 0))
        def _update_vol_lbl(*_):
            try:
                vol_val_lbl.configure(text=f"{int(vol_var.get())}%")
            except Exception:
                pass
        vol_var.trace_add("write", _update_vol_lbl)

        _divider(frame2)

        # Таймер сна
        _section_title(frame2, "💤  Таймер сна")
        _hint(frame2, "Автоматическая остановка воспроизведения через заданное время.")
        sleep_options = ["Выкл", "15 минут", "30 минут", "45 минут", "60 минут"]
        current_sleep = "Выкл"
        if self.sleep_timer_minutes in (15, 30, 45, 60):
            current_sleep = f"{self.sleep_timer_minutes} минут"
        sleep_var = tk.StringVar(value=current_sleep)
        ctk.CTkComboBox(frame2, values=sleep_options, variable=sleep_var, width=240,
                        fg_color=self.theme["fg"], text_color=self.theme["text"],
                        button_color=self.theme["button"],
                        button_hover_color=self.theme["button_hover"],
                        command=lambda _: _schedule_save()).pack(anchor="w", padx=18, pady=(0, 16))

        _divider(frame2)

        # Радио-режим
        _section_title(frame2, "📻  Радио-режим")
        _hint(frame2, "Автоматически подбирать похожие треки когда плейлист заканчивается.")
        radio_var = tk.BooleanVar(value=self.radio_mode)
        ctk.CTkSwitch(frame2, text="Радио-режим", variable=radio_var, width=44,
                      fg_color=self.theme["button"], progress_color=self.theme["accent"],
                      text_color=self.theme["text"], font=("Arial", 13),
                      command=lambda: (setattr(self, 'radio_mode', radio_var.get()),
                                      self.settings.__setitem__("radio_mode", radio_var.get()),
                                      _schedule_save())).pack(anchor="w", padx=18, pady=(0, 16))

        # ═══ Блок 3: Кэш и данные ═══
        frame3 = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16,
                              border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        frame3.pack(fill="x", padx=10, pady=6)

        _section_title(frame3, "🗄  Кэш и данные")
        cache_tracks = len(self.stream_cache)
        cache_images = len(self.image_cache)
        _hint(frame3, f"Кэш потоков: {cache_tracks} | Кэш изображений: {cache_images} | История: {len(self.history)} записей")

        btn_row = ctk.CTkFrame(frame3, fg_color="transparent")
        btn_row.pack(fill="x", padx=18, pady=(0, 16))
        ctk.CTkButton(btn_row, text="Очистить кэш", width=160, height=36, corner_radius=18,
                      fg_color=self.theme["accent_soft"], hover_color=self.theme["accent"],
                      text_color=self.theme["accent"], font=("Arial", 12, "bold"),
                      command=self._clear_cache).pack(side="left", padx=(0, 10))
        ctk.CTkButton(btn_row, text="Очистить историю", width=160, height=36, corner_radius=18,
                      fg_color=self.theme["accent_soft"], hover_color=self.theme["accent"],
                      text_color=self.theme["accent"], font=("Arial", 12, "bold"),
                      command=self._clear_history).pack(side="left")

        # ═══ Блок 4: Горячие клавиши ═══
        frame4 = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16,
                              border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        frame4.pack(fill="x", padx=10, pady=6)

        _section_title(frame4, "⌨  Горячие клавиши")
        hotkeys = [
            ("Пробел", "Пауза / Воспроизведение", 160),
            ("←", "Предыдущий трек", 160),
            ("→", "Следующий трек", 160),
            ("↑", "Громкость +5%", 160),
            ("↓", "Громкость −5%", 160),
            ("M", "Mute / Unmute", 160),
            ("Shift+←", "Перемотка −10 сек", 160),
            ("Shift+→", "Перемотка +10 сек", 160),
            ("N", "Следующий трек", 160),
            ("Колёсико", "Громкость ±3% / Перемотка", 200),
            ("Enter", "Начать поиск", 160),
            ("ПКМ", "Контекстное меню трека", 200),
        ]
        hk_frame = ctk.CTkFrame(frame4, fg_color="transparent")
        hk_frame.pack(fill="x", padx=18, pady=(0, 16))
        for key, desc, kbd_w in hotkeys:
            row = ctk.CTkFrame(hk_frame, fg_color="transparent")
            row.pack(fill="x", pady=2)
            kbd_f = ctk.CTkFrame(row, fg_color=self.theme["button"], corner_radius=6, width=kbd_w)
            kbd_f.pack(side="left", padx=(0, 12))
            kbd_f.pack_propagate(False)
            ctk.CTkLabel(kbd_f, text=key, font=("Consolas", 11, "bold"), text_color=self.theme["accent"],
                         anchor="center").pack(expand=True)
            ctk.CTkLabel(row, text=desc, font=("Arial", 12),
                         text_color=self.theme["text_secondary"], anchor="w").pack(side="left", fill="x", expand=True)

        # ═══ Блок 5: О программе ═══
        frame5 = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16,
                              border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        frame5.pack(fill="x", padx=10, pady=(6, 20))

        _section_title(frame5, "ℹ  О программе")
        ctk.CTkLabel(frame5, text="mq Music Player", font=("Arial", 16, "bold"),
                     text_color=self.theme["accent"]).pack(anchor="w", padx=18, pady=(0, 2))
        ctk.CTkLabel(frame5, text="Версия 2.3", font=("Arial", 12),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=18, pady=(0, 4))
        _hint(frame5, "Музыкальный плеер на Python с поддержкой YouTube Music, VLC и кроссфейда.\n"
                      "Использует customtkinter для современного интерфейса.")

        # Пустое пространство снизу для скролла
        ctk.CTkFrame(self.scroll, fg_color="transparent", height=30).pack()

    def _clear_cache(self):
        """Очистить все кэши включая файлы."""
        with self._lock_cache:
            self.stream_cache.clear()
            self.image_cache._cache.clear()
            self.orig_cache._cache.clear()
            self.search_cache.clear()
        for cache_file in [self.search_cache_file]:
            try:
                if os.path.exists(cache_file):
                    os.remove(cache_file)
            except Exception:
                pass
        self._toast("Кэш полностью очищен")

    def _clear_history(self):
        """Очистить историю воспроизведения."""
        self.history.clear()
        self._save_json(self.history_file, self.history)
        self.recommendations_cache = []
        self._toast("История очищена")

    # ─── Кнопки Player Bar ────────────────────────────────────────
    def _pb_toggle_like(self):
        """Лайк/дизлайк текущего трека из player bar."""
        if not self.current_track:
            return
        self._toggle_like(self.current_track)
        liked = self._is_liked(self.current_track)
        self.pb_btn_like.configure(text="❤️" if liked else "🤍",
                                  text_color=self.theme["accent"] if liked else self.theme["text_secondary"])
        # Обновить строки треков если на экране liked
        if self.current_view == "liked":
            self._show_liked()

    def _pb_add_to_playlist(self):
        """Добавить текущий трек в плейлист из player bar."""
        if not self.current_track:
            self._toast("Сначала выберите трек")
            return
        self._add_to_pl_dialog(self.current_track)

    def _show_similar_tracks(self):
        """Показать похожие треки на основе текущего исполнителя."""
        if not self.current_track:
            self._toast("Сначала выберите трек")
            return
        artist = self.current_track.get("artists", [{}])[0].get("name", "")
        if not artist:
            self._toast("Не удалось определить исполнителя")
            return
        self._show_similar_tracks_for_artist(artist)

    def _bg_similar(self, artist):
        """Фоновый поиск похожих треков."""
        query = f"{artist} best songs"
        results = self._api_search(query, limit=20)
        # Фильтруем: убираем текущий трек и уже disliked
        filtered = []
        seen = set()
        cur_vid = self.current_track.get("videoId") if self.current_track else None
        for t in results:
            vid = t.get("videoId")
            if vid and vid != cur_vid and vid not in self.disliked and vid not in seen:
                # Проверяем что artist совпадает (похоже)
                t_artists = t.get("artists", [])
                t_name = t_artists[0].get("name", "") if t_artists else ""
                if t_name.lower() == artist.lower() or artist.lower() in t_name.lower() or t_name.lower() in artist.lower():
                    filtered.append(t)
                    seen.add(vid)
        if not filtered:
            # Если не нашли по artist, берем первые 12 результатов
            for t in results:
                vid = t.get("videoId")
                if vid and vid != cur_vid and vid not in self.disliked and vid not in seen:
                    filtered.append(t)
                    seen.add(vid)
                if len(filtered) >= 12:
                    break
        with self._lock_tracks:
            self.tracks = filtered[:20]
        self.after(0, self._render_similar, artist)

    def _render_similar(self, artist):
        """Отрисовать результаты похожих треков."""
        self._clear()
        ctk.CTkLabel(self.scroll, text=f"🎵  Похожие на {artist}", font=("Arial", 16, "bold"),
                     text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(8, 4))
        if not self.tracks:
            ctk.CTkLabel(self.scroll, text="😕  Не удалось найти похожие треки", font=("Arial", 14),
                         text_color=self.theme["text_secondary"]).pack(pady=30)
            return
        ctk.CTkLabel(self.scroll, text=f"{len(self.tracks)} треков", font=("Arial", 13),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 10))
        for t in self.tracks:
            self._track_row(t)

    def _show_lyrics(self):
        """Показать текст песни (lyrics) для текущего трека."""
        if not self.current_track:
            self._toast("Сначала выберите трек")
            return
        title = self.current_track.get("title", "")
        artist = self.current_track.get("artists", [{}])[0].get("name", "")
        self.current_view = "lyrics"
        self.nav_title.configure(text=f"Текст: {title[:30]}")
        self._clear()
        ctk.CTkLabel(self.scroll, text=title, font=("Arial", 18, "bold"),
                     text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(10, 2))
        ctk.CTkLabel(self.scroll, text=artist, font=("Arial", 13),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 8))
        ctk.CTkLabel(self.scroll, text="⏳  Ищем текст…", font=("Arial", 13),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4)
        self.executor.submit(self._bg_lyrics, title, artist)

    def _bg_lyrics(self, title, artist):
        """Фоновый поиск текста песни."""
        lyrics = ""
        try:
            query = f"{artist} {title} lyrics"
            url = f"https://itunes.apple.com/search?term={query}&media=music&limit=1"
            r = self.http.get(url, timeout=10)
            data = r.json()
            results = data.get("results", [])
            if results:
                # iTunes doesn't provide lyrics directly, but we can try a simple approach
                # Use a placeholder message
                track_name = results[0].get("trackName", title)
                artist_name = results[0].get("artistName", artist)
                lyrics = f"Найдено: {track_name} — {artist_name}\n\nТекст песни временно недоступен.\n"
                lyrics += "Функция текстов будет улучшена в будущих обновлениях.\n\n"
                lyrics += f"Альбом: {results[0].get('collectionName', '—')}\n"
                lyrics += f"Год: {results[0].get('releaseDate', '—')[:4]}"
        except Exception:
            lyrics = "Не удалось загрузить текст песни."
        self.after(0, self._render_lyrics, lyrics)

    def _render_lyrics(self, lyrics):
        """Отрисовать текст песни."""
        self._clear()
        title = self.current_track.get("title", "") if self.current_track else ""
        artist = self.current_track.get("artists", [{}])[0].get("name", "") if self.current_track else ""
        ctk.CTkLabel(self.scroll, text=title, font=("Arial", 18, "bold"),
                     text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(10, 2))
        ctk.CTkLabel(self.scroll, text=artist, font=("Arial", 13),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 8))

        lyrics_frame = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=14,
                                     border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        lyrics_frame.pack(fill="x", padx=4, pady=(8, 20))
        ctk.CTkLabel(lyrics_frame, text=lyrics, font=("Arial", 13),
                     text_color=self.theme["text_secondary"], justify="left",
                     wraplength=600, anchor="nw").pack(padx=20, pady=18, fill="both")

    # ═════════════════════════ U I ════════════════════════════════
    def _build_ui(self):
        self.root = ctk.CTkFrame(self, fg_color="transparent")
        self.root.pack(fill="both", expand=True)
        self._build_sidebar()
        self.right = ctk.CTkFrame(self.root, fg_color="transparent")
        self.right.pack(side="left", fill="both", expand=True)
        self._build_topbar()
        self._build_content()
        self._build_player_bar()
        self.show_main()
        self.after(1500, self._restore_playback_state)

    # ─── Sidebar ──────────────────────────────────────────────────
    def _build_sidebar(self):
        self.nav_btns = []
        self.nav_indicators = []
        self.nav_item_frames = []
        self.nav_icon_labels = []
        self.nav_text_labels = []
        self.nav_hover_jobs = []  # hover animation job IDs per nav item
        self.nav_hover_entering = []  # entering state per nav item
        self._active_nav_idx = 0
        self.sidebar = ctk.CTkFrame(self.root, width=250, fg_color=self.theme["sidebar"], corner_radius=0)
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        # ── Логотип ──
        hdr = ctk.CTkFrame(self.sidebar, fg_color="transparent", height=60)
        hdr.pack(fill="x", pady=(12, 0))
        hdr.pack_propagate(False)
        logo_f = ctk.CTkFrame(hdr, fg_color="transparent")
        logo_f.pack(expand=True)

        # MQ иконка (из PNG)
        logo_loaded = False
        for icon_path in (getattr(self, '_icon_path', None),):
            if icon_path:
                try:
                    mq_img = Image.open(icon_path)
                    self.logo_ctk_img = ctk.CTkImage(light_image=mq_img, dark_image=mq_img, size=(32, 32))
                    self.logo_icon = ctk.CTkLabel(logo_f, text="", image=self.logo_ctk_img, width=32, height=32)
                    logo_loaded = True
                    break
                except Exception:
                    pass
        if not logo_loaded:
            self.logo_icon = ctk.CTkLabel(logo_f, text="mq", font=("Arial", 20, "bold"),
                                          text_color=self.theme["accent"])        
        self.logo_icon.pack(side="left", padx=(0, 8))
        self.logo_text = ctk.CTkLabel(logo_f, text="mq", font=("Arial", 18, "bold"),
                                      text_color=self.theme["accent"])
        self.logo_text.pack(side="left")

        # ── Навигация ──
        nav_items = [
            ("Главная",   "🏠", self.show_main),
            ("Поиск",     "🔍", self._show_search_view),
            ("Офлайн",    "💾", self._show_offline),
            ("Плейлисты", "📁", self.show_playlists),
            ("Любимое",   "♥",  self._show_liked),
            ("История",   "📜", self._show_history),
            ("Настройки", "⚙",  self._show_settings),
        ]
        for idx, (text, icon, cmd) in enumerate(nav_items):
            item_f = ctk.CTkFrame(self.sidebar, fg_color="transparent", height=42, cursor="hand2",
                                  corner_radius=10)
            item_f.pack(fill="x", padx=8, pady=1)
            item_f.pack_propagate(False)
            self.nav_item_frames.append(item_f)
            # Запоминаем индекс для навигации
            ni = idx

            # Индикатор (height=0, анимируется при активации)
            indicator = ctk.CTkFrame(item_f, width=4, fg_color=self.theme["accent"], corner_radius=2, height=0)
            indicator.place(x=0, rely=0.1, relheight=0.8)
            self.nav_indicators.append(indicator)

            # Иконка — фиксированная ширина для выравнивания
            icon_lbl = ctk.CTkLabel(item_f, text=icon, font=("Segoe UI Emoji", 14),
                                    text_color=self.theme["text_secondary"], width=36, anchor="center")
            icon_lbl.place(x=12, rely=0.5, anchor="w")
            self.nav_icon_labels.append(icon_lbl)

            # Текст
            txt_lbl = ctk.CTkLabel(item_f, text=text, font=("Arial", 13),
                                   text_color=self.theme["text_secondary"], anchor="w")
            txt_lbl.place(x=50, rely=0.5, anchor="w")
            self.nav_text_labels.append(txt_lbl)

            # Фоновый слой для hover/active (обычный Frame, не Button)
            bg_layer = ctk.CTkFrame(item_f, fg_color="transparent", corner_radius=10)
            bg_layer.place(relx=0.0, rely=0.0, relwidth=1.0, relheight=1.0)
            bg_layer.lower()
            self.nav_btns.append(bg_layer)

            # ── Hover-эффекты: фон + текст + индикатор ──
            self.nav_hover_jobs.append(None)
            self.nav_hover_entering.append(False)

            def _make_hover(nav_i):
                def on_enter(e):
                    if nav_i == self._active_nav_idx:
                        return
                    self.nav_hover_entering[nav_i] = True
                    if self.nav_hover_jobs[nav_i]:
                        self.after_cancel(self.nav_hover_jobs[nav_i])
                    # Анимация фона
                    self._nav_animate_bg(nav_i, self.theme["button_hover"])
                    # Текст и иконка → белый
                    if nav_i < len(self.nav_icon_labels):
                        self.nav_icon_labels[nav_i].configure(text_color=self.theme["text"])
                    if nav_i < len(self.nav_text_labels):
                        self.nav_text_labels[nav_i].configure(text_color=self.theme["text"])
                    # Показать полупрозрачный индикатор
                    if nav_i < len(self.nav_indicators):
                        ind = self.nav_indicators[nav_i]
                        ind.configure(fg_color=self.theme["text_secondary"])
                        self._animate_indicator(ind, target_h=18, steps=4, delay=16)

                def on_leave(e):
                    self.nav_hover_entering[nav_i] = False
                    if self.nav_hover_jobs[nav_i]:
                        self.after_cancel(self.nav_hover_jobs[nav_i])
                    if nav_i == self._active_nav_idx:
                        return
                    # Анимация фона обратно
                    self._nav_animate_bg(nav_i, "transparent")
                    # Текст и иконка → вторичный
                    if nav_i < len(self.nav_icon_labels):
                        self.nav_icon_labels[nav_i].configure(text_color=self.theme["text_secondary"])
                    if nav_i < len(self.nav_text_labels):
                        self.nav_text_labels[nav_i].configure(text_color=self.theme["text_secondary"])
                    # Скрыть индикатор
                    if nav_i < len(self.nav_indicators):
                        ind = self.nav_indicators[nav_i]
                        self._animate_indicator(ind, target_h=0, steps=3, delay=14)

                return on_enter, on_leave

            on_enter, on_leave = _make_hover(idx)
            for w in (item_f, icon_lbl, txt_lbl, bg_layer):
                w.bind("<Enter>", on_enter)
                w.bind("<Leave>", on_leave)

            # Клик — обновляем активную вкладку
            for w in (item_f, icon_lbl, txt_lbl, bg_layer):
                w.bind("<Button-1>", lambda e, c=cmd, i=ni: (self._set_active_nav(i), c()))

        # Начальное состояние
        self._active_nav_idx = 0
        self._set_active_nav(0)

        # ── Разделитель секций ──
        sep_f = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        sep_f.pack(fill="x", padx=16, pady=(12, 8))
        ctk.CTkFrame(sep_f, height=1, fg_color=self.theme["divider"]).pack(fill="x")
        pl_hdr = ctk.CTkFrame(sep_f, fg_color="transparent")
        pl_hdr.pack(fill="x", pady=(6, 0))
        ctk.CTkLabel(pl_hdr, text="ПЛЕЙЛИСТЫ", font=("Arial", 10, "bold"),
                     text_color=self.theme["text_secondary"], anchor="w").pack(side="left", padx=(2, 0))
        self.sb_pl_count = ctk.CTkLabel(pl_hdr, text="0", font=("Arial", 10),
                                        text_color=self.theme["text_secondary"], anchor="e")
        self.sb_pl_count.pack(side="right")
        self._update_pl_count()

        # ── Список плейлистов ──
        self.sb_playlists = ctk.CTkScrollableFrame(self.sidebar, fg_color="transparent")
        self.sb_playlists.pack(fill="both", expand=True, padx=6, pady=(2, 4))
        self._refresh_sidebar_playlists()

        # ── Версия внизу ──
        ctk.CTkLabel(self.sidebar, text="v2.3", font=("Arial", 9),
                     text_color=self._darken(self.theme["text_secondary"], 20)).pack(side="bottom", pady=(0, 10))

    def _nav_animate_bg(self, nav_i, target_color, steps=6, delay=18):
        """Анимация фона кнопки навигации."""
        try:
            bg = self.nav_btns[nav_i]
            if not bg.winfo_exists():
                return
            current = bg.cget("fg_color")
            if current == target_color:
                self.nav_hover_jobs[nav_i] = None
                return
            step = [0]
            def _tick():
                step[0] += 1
                t = step[0] / steps
                if t > 1.0:
                    t = 1.0
                try:
                    if not bg.winfo_exists():
                        return
                    entering = self.nav_hover_entering[nav_i]
                    # Прервать если состояние изменилось
                    if not entering and target_color != "transparent":
                        self.nav_hover_jobs[nav_i] = None
                        return
                    if entering and target_color == "transparent":
                        self.nav_hover_jobs[nav_i] = None
                        return
                    c = self._lerp_color(current, target_color, t)
                    bg.configure(fg_color=c)
                    if t < 1.0:
                        self.nav_hover_jobs[nav_i] = self.after(delay, _tick)
                    else:
                        self.nav_hover_jobs[nav_i] = None
                except Exception:
                    self.nav_hover_jobs[nav_i] = None
            _tick()
        except Exception:
            self.nav_hover_jobs[nav_i] = None

    def _update_pl_count(self):
        if hasattr(self, "sb_pl_count") and self.sb_pl_count.winfo_exists():
            try:
                self.sb_pl_count.configure(text=str(len(self.playlists)))
            except Exception:
                pass

    def _set_active_nav(self, index):
        """Highlight the active navigation item with animated indicator."""
        self._active_nav_idx = index
        for i in range(len(self.nav_btns)):
            btn = self.nav_btns[i]
            is_active = (i == index)
            if is_active:
                # Плавная анимация фона к активному цвету
                self._animate_color(btn, "fg_color", self.theme["accent_soft"], steps=8, delay=22)
                if i < len(self.nav_text_labels):
                    self.nav_text_labels[i].configure(text_color=self.theme["text"])
                if i < len(self.nav_icon_labels):
                    self.nav_icon_labels[i].configure(text_color=self.theme["accent"])
                if i < len(self.nav_indicators):
                    self.nav_indicators[i].configure(fg_color=self.theme["accent"])
                    self._animate_indicator(self.nav_indicators[i], target_h=28, steps=6, delay=20)
            else:
                self._animate_color(btn, "fg_color", "transparent", steps=6, delay=22)
                if i < len(self.nav_text_labels):
                    self.nav_text_labels[i].configure(text_color=self.theme["text_secondary"])
                if i < len(self.nav_icon_labels):
                    self.nav_icon_labels[i].configure(text_color=self.theme["text_secondary"])
                if i < len(self.nav_indicators):
                    self.nav_indicators[i].configure(fg_color=self.theme["text_secondary"])
                    self._animate_indicator(self.nav_indicators[i], target_h=0, steps=4, delay=16)

    def _animate_indicator(self, indicator, target_h, steps=6, delay=20):
        """Анимация высоты индикатора навигации."""
        try:
            if not indicator.winfo_exists():
                return
            current_h = indicator.cget("height")
            if current_h == target_h:
                return
            step = [0]
            def _tick():
                step[0] += 1
                t = step[0] / steps
                if t > 1.0:
                    t = 1.0
                try:
                    if not indicator.winfo_exists():
                        return
                    h = int(current_h + (target_h - current_h) * t)
                    indicator.configure(height=h)
                    if t < 1.0:
                        self.after(delay, _tick)
                except Exception:
                    pass
            _tick()
        except Exception:
            pass

    def _get_nav_index(self, view_name):
        """Return nav button index for current_view."""
        mapping = {"main": 0, "search": 1, "results": 1, "offline": 2, "playlists": 3, "pl_view": 3,
                   "new_playlist": 3, "import": 3, "liked": 4, "history": 5, "settings": 6}
        return mapping.get(view_name, -1)

    def _update_nav_for_view(self):
        """Обновляет подсветку активной вкладки при смене вида."""
        idx = self._get_nav_index(self.current_view)
        if idx >= 0:
            self._set_active_nav(idx)

    def _refresh_sidebar_playlists(self):
        for w in self.sb_playlists.winfo_children():
            w.destroy()
        self._update_pl_count()
        for name in self.playlists:
            # Контейнер строки плейлиста
            pl_row = ctk.CTkFrame(self.sb_playlists, fg_color="transparent", height=38, cursor="hand2")
            pl_row.pack(fill="x", pady=1)
            pl_row.pack_propagate(False)

            btn = ctk.CTkButton(pl_row, text=f"  📀  {name}", anchor="w", height=38,
                               font=("Arial", 12), corner_radius=8,
                               fg_color="transparent", hover_color=self.theme["button_hover"],
                               text_color=self.theme["text_secondary"],
                               command=lambda n=name: self._view_playlist(n))
            btn.pack(fill="x")
            self._bind_hover_recursive(pl_row,
                                      lambda e, b=btn: b.configure(fg_color=self.theme["button_hover"], text_color=self.theme["text"]),
                                      lambda e, b=btn: b.configure(fg_color="transparent", text_color=self.theme["text_secondary"]))

    # ─── Top bar ──────────────────────────────────────────────────
    def _build_topbar(self):
        bar = ctk.CTkFrame(self.right, fg_color="transparent", height=52)
        bar.pack(fill="x", padx=28, pady=(14, 0))
        bar.pack_propagate(False)
        self.nav_title = ctk.CTkLabel(bar, text="Главная", font=("Arial", 20, "bold"), text_color=self.theme["text"])
        self.nav_title.pack(side="left", pady=(8, 0))
        # Разделитель убран

    # ─── Content ──────────────────────────────────────────────────
    def _build_content(self):
        wrap = ctk.CTkFrame(self.right, fg_color="transparent")
        wrap.pack(fill="both", expand=True, padx=30, pady=8)
        self.scroll = ctk.CTkScrollableFrame(wrap, fg_color="transparent")
        self.scroll.pack(fill="both", expand=True)

        self.status_label = ctk.CTkLabel(self.right, text="", font=("Arial", 11), text_color=self.theme["accent"])
        self.status_label.pack(side="bottom", pady=4)

    def _on_resize(self, event):
        """Плавная обработка изменения размера окна (debounce)."""
        if self._resize_job is not None:
            self.after_cancel(self._resize_job)
        self._resize_job = self.after(30, self._apply_resize)

    def _apply_resize(self):
        self._resize_job = None
        try:
            if not self.prog_bg.winfo_exists():
                return
            w = self.prog_bg.winfo_width()
            if w <= 0:
                return
            if self.current_duration > 0 and self.player:
                ms = self.player.get_time()
                if ms >= 0:
                    sec = ms // 1000
                    pct = sec / self.current_duration
                    fw = int(pct * w)
                    if fw < 1:
                        fw = 0
                    self.prog_fill.place_configure(width=fw)
                    self.prog_dot.place(x=max(0, fw - 7), y=-4)
        except Exception:
            pass

    def _bind_hover_recursive(self, parent, on_enter, on_leave):
        """Привязать hover-обработчики к виджету и ВСЕМ его потомкам рекурсивно.
        Пропускает CTkButton — не ломает их клик-обработчики."""
        parent.bind("<Enter>", on_enter)
        parent.bind("<Leave>", on_leave)
        for child in parent.winfo_children():
            if isinstance(child, ctk.CTkButton):
                continue  # Не перехватываем события кнопок
            self._bind_hover_recursive(child, on_enter, on_leave)

    def _clear(self):
        for w in self.scroll.winfo_children():
            w.destroy()

    # ═══════════════ ГЛАВНЫЙ ЭКРАН ════════════════════════════════
    def show_main(self):
        self.current_view = "main"
        self.nav_title.configure(text="Главная")
        self._update_nav_for_view()
        self._clear()

        # Поиск — кнопка ПЕРВАЯ (side=right), поле ВТОРОЕ (expand=True)
        sf = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=25, height=50)
        sf.pack(fill="x", pady=(0, 25))
        sf.pack_propagate(False)
        ctk.CTkButton(sf, text="🔍", width=40, height=40, corner_radius=20,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 18), command=self._do_search).pack(side="right", padx=(0, 6))
        self.search_entry = ctk.CTkEntry(sf, height=46, border_width=0, font=("Arial", 14),
                                         placeholder_text="🔍  Песни, исполнители, альбомы…",
                                         placeholder_text_color=self.theme["text_secondary"],
                                         fg_color="transparent", text_color=self.theme["text"])
        self.search_entry.pack(side="left", fill="both", expand=True, padx=(16, 8))
        self.search_entry.bind("<Return>", lambda _: self._do_search())

        # Рекомендации
        self._section("🎯  Рекомендации для вас")
        self.rec_frame = ctk.CTkFrame(self.scroll, fg_color="transparent")
        self.rec_frame.pack(fill="x", pady=(0, 28))
        self._load_personal_recommendations()

        # Недавние
        if self.history:
            self._section("⏱️  Недавно прослушанные")
            recent = sorted(self.history.values(), key=lambda x: x.get("last_played", 0), reverse=True)[:8]
            rg = ctk.CTkFrame(self.scroll, fg_color="transparent")
            rg.pack(fill="x", pady=(0, 28))
            for i in range(4):
                rg.columnconfigure(i, weight=1, uniform="rec")
            for idx, entry in enumerate(recent):
                self._track_card(rg, entry.get("track", entry), idx // 4, idx % 4)

    def _section(self, text):
        frame = ctk.CTkFrame(self.scroll, fg_color="transparent")
        frame.pack(fill="x", pady=(8, 14))
        # Left accent bar
        accent_bar = ctk.CTkFrame(frame, width=3, fg_color=self.theme["accent"], corner_radius=2)
        accent_bar.pack(side="left", fill="y", padx=(0, 10), pady=2)
        accent_bar.pack_propagate(False)
        ctk.CTkLabel(frame, text=text, font=("Arial", 18, "bold"),
                     text_color=self.theme["text"], anchor="w").pack(side="left")

    def _track_card(self, parent, track, row, col):
        card = ctk.CTkFrame(parent, fg_color=self.theme["card"], corner_radius=14, cursor="hand2",
                             border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")

        # Обложка
        cvr = ctk.CTkLabel(card, text="", image=self.placeholders["card"], width=165, height=165, corner_radius=12)
        cvr.pack(padx=10, pady=(10, 4))
        best_url = self._get_best_thumbnail(track)
        if best_url:
            self._load_cover(best_url, cvr, (165, 165))

        # Текст
        title = track.get("title", "?")[:22]
        artist = track.get("artists", [{}])[0].get("name", "")[:24]
        ctk.CTkLabel(card, text=title, font=("Arial", 13, "bold"), text_color=self.theme["text"]).pack(anchor="w", padx=12)
        ctk.CTkLabel(card, text=artist, font=("Arial", 11), text_color=self.theme["text_secondary"]).pack(anchor="w", padx=12, pady=(0, 10))

        # Hover-эффект: подсветка бордера и фона (рекурсивная привязка)
        border_orig = self.theme.get("card_border", self.theme["divider"])
        bg_orig = self.theme["card"]
        def on_enter(e, c=card, bgo=bg_orig):
            try:
                if c.winfo_exists():
                    c.configure(border_color=self.theme["accent"], fg_color=self._darken(bgo, 8))
            except Exception:
                pass
        def on_leave(e, c=card, bo=border_orig, bgo=bg_orig):
            try:
                if c.winfo_exists():
                    c.configure(border_color=bo, fg_color=bgo)
            except Exception:
                pass
        # Hover — рекурсивно на всех потомков чтобы не моргал при наведении на кнопки
        self._bind_hover_recursive(card, on_enter, on_leave)

        # Кнопка контекстного меню (⋮) в правом верхнем углу
        # Клик по карточке — воспроизвести (bind ДО создания ctx_btn)
        cmd = lambda _, t=track: self.play(t)
        card.bind("<Button-1>", cmd)

        # Кнопка контекстного меню (⋮) в правом верхнем углу — через command, не bind
        def _show_ctx_from_card_btn(t=track, r=card):
            # Позиционируем меню около кнопки
            try:
                x = ctx_btn.winfo_rootx() + ctx_btn.winfo_width()
                y = ctx_btn.winfo_rooty() + ctx_btn.winfo_height() // 2
            except Exception:
                x, y = 100, 100
            event = type('Event', (), {'x_root': x, 'y_root': y})()
            self._show_context_menu(event, t, r)

        ctx_btn = ctk.CTkButton(card, text="⋮", width=26, height=26, corner_radius=13,
                                fg_color="transparent", hover_color=self.theme["button_hover"],
                                text_color=self.theme["text_secondary"], font=("Arial", 14, "bold"),
                                cursor="hand2", command=_show_ctx_from_card_btn)
        ctx_btn.place(relx=0.92, rely=0.05, anchor="ne")

        # Привязать play на всех потомков, КРОМЕ ctx_btn
        for ch in card.winfo_children():
            if ch is not ctx_btn:
                ch.bind("<Button-1>", cmd)

    def _get_best_thumbnail(self, track):
        th = track.get("thumbnails")
        if not th:
            thumb = track.get("thumbnail")
            if isinstance(thumb, list):
                th = thumb
            elif isinstance(thumb, dict):
                th = [thumb]
            elif isinstance(thumb, str) and thumb:
                return thumb
        if not th:
            album = track.get("album") or {}
            th = album.get("thumbnails") or []
        if not th:
            return None
        for item in reversed(th):
            if isinstance(item, dict):
                url = item.get("url")
                if url:
                    return url
            else:
                return str(item)
        return None

    def _load_personal_recommendations(self):
        if self.recommendations_cache:
            self._render_recommendations(self.recommendations_cache)
        else:
            ctk.CTkLabel(self.rec_frame, text="⏳  Загружаем…", font=("Arial", 14), text_color=self.theme["text_secondary"]).pack(pady=20)
            self.executor.submit(self._fetch_personal_recommendations)

    @staticmethod
    def _normalize_watch_track(entry):
        track = dict(entry)
        if not track.get("thumbnails") and track.get("thumbnail"):
            th = track["thumbnail"]
            if isinstance(th, str):
                track["thumbnails"] = [{"url": th}]
            elif isinstance(th, list):
                track["thumbnails"] = th
            elif isinstance(th, dict):
                track["thumbnails"] = [th]
        if not track.get("title"):
            track["title"] = track.get("name", "Без названия")
        if not track.get("artists"):
            track["artists"] = [{"name": track.get("artist", "")}]
        return track

    def _fetch_personal_recommendations(self):
        rec_tracks = []
        seen_ids = set()

        for t in (self.liked_playlist or []):
            vid = t.get("videoId")
            if vid and vid not in self.disliked:
                rec_tracks.append(t)
                seen_ids.add(vid)

        if self.ytmusic:
            history_items = sorted(self.history.values(), key=lambda x: x.get("last_played", 0), reverse=True)[:5]
            for item in history_items:
                track = item.get("track") or item
                vid = track.get("videoId")
                if not vid or not isinstance(vid, str) or vid in self.disliked or vid in seen_ids:
                    continue
                try:
                    playlist = self.ytmusic.get_watch_playlist(vid, limit=10)
                    for entry in playlist.get("tracks", [])[1:]:
                        eid = entry.get("videoId")
                        if eid and eid not in seen_ids and eid not in self.disliked:
                            rec_tracks.append(self._normalize_watch_track(entry))
                            seen_ids.add(eid)
                except Exception:
                    pass
                if len(rec_tracks) >= 12:
                    break
            if len(rec_tracks) < 8:
                try:
                    charts = self.ytmusic.get_charts()
                    for t in charts.get("tracks", [])[:20]:
                        eid = t.get("videoId")
                        if eid and eid not in seen_ids and eid not in self.disliked:
                            rec_tracks.append(t)
                            seen_ids.add(eid)
                            if len(rec_tracks) >= 12:
                                break
                except Exception:
                    pass

        if len(rec_tracks) < 4 and not self.ytmusic:
            # Без YTMusic — используем поиск по liked artist'ам
            liked_artists = []
            for t in (self.liked_playlist or []):
                artists = t.get("artists", [])
                if artists:
                    name = artists[0].get("name", "") if isinstance(artists[0], dict) else str(artists[0])
                    if name and name not in liked_artists:
                        liked_artists.append(name)
            for artist in liked_artists[:3]:
                try:
                    artist_results = self._api_search(f"{artist} best songs", limit=5)
                    for t in artist_results:
                        vid = t.get("videoId")
                        if vid and vid not in seen_ids:
                            rec_tracks.append(t)
                            seen_ids.add(vid)
                            if len(rec_tracks) >= 12:
                                break
                except Exception as e:
                    log.warning("Failed to get recommendations for artist %s: %s", artist, e)
                if len(rec_tracks) >= 12:
                    break

        self.recommendations_cache = rec_tracks[:12]
        self.after(0, lambda: self._render_recommendations(self.recommendations_cache))

    def _render_recommendations(self, tracks):
        for w in self.rec_frame.winfo_children(): w.destroy()
        if not tracks:
            ctk.CTkLabel(self.rec_frame, text="😕  Не удалось загрузить рекомендации", font=("Arial", 14), text_color=self.theme["text_secondary"]).pack(pady=20)
            return
        self.tracks = list(tracks)
        if self.is_shuffle:
            self.shuffle_order = self._smart_shuffle()
        g = ctk.CTkFrame(self.rec_frame, fg_color="transparent")
        g.pack(fill="x")
        for i in range(4):
            g.columnconfigure(i, weight=1, uniform="rec")
        for idx, t in enumerate(tracks[:8]):
            self._track_card(g, t, idx // 4, idx % 4)

    # ═══════════════ ПОИСК ════════════════════════════════════════
    def _show_search_view(self):
        self.current_view = "search"
        self.nav_title.configure(text="Поиск")
        self._update_nav_for_view()
        self._clear()
        sf = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=25, height=52)
        sf.pack(fill="x", pady=(0, 20))
        sf.pack_propagate(False)
        ctk.CTkButton(sf, text="🔍", width=44, height=44, corner_radius=22,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 20), command=self._do_search).pack(side="right", padx=(0, 8))
        self.search_entry = ctk.CTkEntry(sf, height=48, border_width=0, font=("Arial", 14),
                                         placeholder_text="🔍  Что послушать?",
                                         fg_color="transparent", text_color=self.theme["text"])
        self.search_entry.pack(side="left", fill="both", expand=True, padx=(16, 8))
        self.search_entry.bind("<Return>", lambda _: self._do_search())
        self.search_entry.focus()

    def _do_search(self):
        q = self.search_entry.get().strip()
        if not q: return
        self.current_view = "results"
        self.nav_title.configure(text=f"{q}")
        self._clear()
        lbl = ctk.CTkLabel(self.scroll, text="⏳  Поиск…", font=("Arial", 15), text_color=self.theme["text_secondary"])
        lbl.pack(pady=50)
        self.executor.submit(self._bg_search, q, lbl)

    def _bg_search(self, q, lbl):
        with self._lock_cache:
            if q in self.search_cache:
                self.search_cache.move_to_end(q)
                results = self.search_cache[q]
            else:
                results = self._api_search(q, 25)
                if results:
                    self.search_cache[q] = results
                    while len(self.search_cache) > 150:
                        self.search_cache.popitem(last=False)
                # Debounced persist search cache (5 сек)
                if not hasattr(self, '_save_search_cache_job'):
                    self._save_search_cache_job = None
                if self._save_search_cache_job:
                    try: self.after_cancel(self._save_search_cache_job)
                    except Exception: pass
                self._save_search_cache_job = self.after(5000, lambda: self._save_json(
                    self.search_cache_file, dict(list(self.search_cache.items())[:150])))
        with self._lock_tracks:
            self.tracks = results
        def _ui():
            try: lbl.destroy()
            except: pass
            if not results:
                ctk.CTkLabel(self.scroll, text="⚠️  Ничего не найдено", font=("Arial", 15), text_color=self.theme["text_secondary"]).pack(pady=40)
                return
            for t in results:
                self._track_row(t)
        self.after(0, _ui)

    def _api_search(self, query: str, limit: int = 20) -> list:
        """Поиск через YTMusic. Вызывается из фоновых потоков — НЕ использовать self.after!"""
        results: list = []
        if self.ytmusic:
            try:
                results = self.ytmusic.search(query, filter="songs", limit=limit)
                log.info("YTMusic search '%s': %d results", query, len(results))
            except Exception as e:
                log.error("YTMusic search failed: %s", e)
        else:
            log.warning("YTMusic unavailable — cannot search")
        return results

    # ═══════════════ СТРОКА ТРЕКА ═════════════════════════════════
    def _track_row(self, track, playlist_name=None, index=None):
        row = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=10, height=64,
                           cursor="hand2", border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        row.pack(fill="x", pady=2, padx=4)
        row.pack_propagate(False)

        cvr = ctk.CTkLabel(row, text="", image=self.placeholders["sm"], width=48, height=48, corner_radius=8)
        cvr.pack(side="left", padx=(14, 12), pady=8)
        url = self._get_best_thumbnail(track)
        if url: self._load_cover(url, cvr, (48, 48))
        is_playing = (self.current_track and track.get("videoId") == self.current_track.get("videoId"))
        info = ctk.CTkFrame(row, fg_color="transparent")
        info.pack(side="left", fill="both", expand=True, pady=8)
        tc = self.theme["accent"] if is_playing else self.theme["text"]
        ctk.CTkLabel(info, text=track.get("title", "?")[:55], font=("Arial", 13, "bold"), text_color=tc, anchor="w").pack(fill="x")
        ctk.CTkLabel(info, text=track.get("artists", [{}])[0].get("name", ""), font=("Arial", 11), text_color=self.theme["text_secondary"], anchor="w").pack(fill="x")
        bf = ctk.CTkFrame(row, fg_color="transparent")
        bf.pack(side="right", padx=12)
        liked = self._is_liked(track)
        ctk.CTkButton(bf, text="❤️" if liked else "🤍", width=32, height=32, corner_radius=16,
                      fg_color="transparent", hover_color=self.theme["button_hover"],
                      text_color=self.theme["accent"] if liked else self.theme["text"], font=("Arial", 14),
                      command=lambda t=track: self._toggle_like_and_update(t, row)).pack(side="left", padx=2)
        ctk.CTkButton(bf, text="▶", width=32, height=32, corner_radius=16,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 12), command=lambda t=track: self.play(t)).pack(side="left", padx=2)
        ctk.CTkButton(bf, text="👎", width=32, height=32, corner_radius=16,
                      fg_color="transparent", hover_color=self.theme["button_hover"],
                      text_color=self.theme["text_secondary"], font=("Arial", 14),
                      command=lambda t=track, r=row: self._dislike_and_remove(t, r)).pack(side="left", padx=2)
        if playlist_name is None:
            ctk.CTkButton(bf, text="＋", width=32, height=32, corner_radius=16,
                          fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                          text_color=self.theme["text"], font=("Arial", 14),
                          command=lambda t=track: self._add_to_pl_dialog(t)).pack(side="left", padx=2)
        else:
            ctk.CTkButton(bf, text="✕", width=32, height=32, corner_radius=16,
                          fg_color="#c0392b", hover_color="#e74c3c", text_color="white",
                          command=lambda: self._remove_from_pl(playlist_name, index)).pack(side="left", padx=2)

        # Кнопка контекстного меню (⋮) — через command, не bind
        def _show_ctx_from_btn(t=track, r=row):
            try:
                x = ctx_btn.winfo_rootx() + ctx_btn.winfo_width()
                y = ctx_btn.winfo_rooty() + ctx_btn.winfo_height() // 2
            except Exception:
                x, y = 100, 100
            event = type('Event', (), {'x_root': x, 'y_root': y})()
            self._show_context_menu(event, t, r)
        ctx_btn = ctk.CTkButton(bf, text="⋮", width=26, height=26, corner_radius=13,
                                fg_color="transparent", hover_color=self.theme["button_hover"],
                                text_color=self.theme["text_secondary"], font=("Arial", 14, "bold"),
                                cursor="hand2", command=_show_ctx_from_btn)
        ctx_btn.pack(side="left", padx=2)

        # Hover-эффект — рекурсивно на всех потомков чтобы не моргал
        bg_orig = self.theme["card"]
        border_orig = self.theme.get("card_border", self.theme["divider"])
        def on_enter(e, r=row, bgo=bg_orig):
            try:
                if r.winfo_exists():
                    r.configure(fg_color=self._darken(bgo, 10), border_color=self.theme["accent"])
            except Exception:
                pass
        def on_leave(e, r=row, bgo=bg_orig, bo=border_orig):
            try:
                if r.winfo_exists():
                    r.configure(fg_color=bgo, border_color=bo)
            except Exception:
                pass
        self._bind_hover_recursive(row, on_enter, on_leave)

        # ── Контекстное меню (ПКМ) — стилизованное ──
        def show_context(event):
            self._show_context_menu(event, track, row)
        row.bind("<Button-3>", show_context)
        # Для macOS: Control+Click
        row.bind("<Control-Button-1>", show_context)

    def _close_context_menu(self):
        """Закрыть кастомное контекстное меню."""
        try:
            if hasattr(self, '_ctx_menu') and self._ctx_menu and self._ctx_menu.winfo_exists():
                self._ctx_menu.destroy()
        except Exception:
            pass
        self._ctx_menu = None

    def _show_context_menu(self, event, track, row_widget):
        """Стилизованное контекстное меню для треков."""
        self._close_context_menu()

        # Защита от мгновенного закрытия через bind_all(<Button-1>)
        self._ctx_menu_just_opened = True

        self._ctx_menu = tk.Toplevel(self)
        self._ctx_menu.overrideredirect(True)
        try:
            self._ctx_menu.attributes("-topmost", True)
            if sys.platform == "win32":
                try:
                    self._ctx_menu.attributes("-alpha", 0.97)
                except Exception:
                    pass
        except Exception:
            pass
        self._ctx_menu.configure(bg=self.theme["bg"])

        # Тень (4px)
        shadow = tk.Frame(self._ctx_menu, bg=self._darken(self.theme["bg"], 20), padx=4, pady=4)
        shadow.pack(fill="both", expand=True)

        # Основной контейнер
        main = ctk.CTkFrame(shadow, fg_color=self.theme["card"], corner_radius=12,
                            border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        main.pack(fill="both", expand=True)

        # Шапка с названием трека
        header = ctk.CTkFrame(main, fg_color=self.theme["accent_soft"], corner_radius=10, height=42)
        header.pack(fill="x", padx=8, pady=(8, 2))
        header.pack_propagate(False)
        track_title = track.get("title", "?")[:40]
        track_artist = track.get("artists", [{}])[0].get("name", "")[:30]
        ctk.CTkLabel(header, text=f"🎵  {track_title}", font=("Arial", 12, "bold"),
                     text_color=self.theme["accent"], anchor="w").pack(side="left", padx=(10, 4), pady=(10, 0))
        ctk.CTkLabel(header, text=track_artist, font=("Arial", 10),
                     text_color=self.theme["text_secondary"], anchor="w").pack(side="left", padx=(0, 10), pady=(12, 0))

        # Построение списка пунктов меню
        items = []
        items.append(("▶  Воспроизвести", lambda: (self.play(track), self._close_context_menu())))
        if self.current_track and track.get("videoId") == self.current_track.get("videoId"):
            items.append(("⏸  Пауза", lambda: (self._toggle_play(), self._close_context_menu())))
        items.append(None)  # разделитель
        like_label = "💔  Убрать из любимого" if self._is_liked(track) else "❤️  В любимое"
        items.append((like_label, lambda: (self._toggle_like_and_update(track, row_widget), self._close_context_menu())))
        items.append(("👎  Не нравится", lambda: (self._dislike_and_remove(track, row_widget), self._close_context_menu())))
        items.append(None)  # разделитель
        items.append(("＋  Добавить в плейлист", lambda: (self._add_to_pl_dialog(track), self._close_context_menu())))
        artist = track.get("artists", [{}])[0].get("name", "")
        if artist:
            items.append(("🎵  Похожие треки", lambda a=artist: (self._context_similar(a), self._close_context_menu())))
        items.append(None)  # разделитель
        items.append(("💾  Скачать", lambda: (self._download_track(track), self._close_context_menu())))
        items.append(None)  # разделитель
        items.append(("📋  Копировать название", lambda: (self._copy_track_info(track), self._close_context_menu())))

        # Создание виджетов
        for item in items:
            if item is None:
                sep = ctk.CTkFrame(main, height=1, fg_color=self.theme["divider"])
                sep.pack(fill="x", padx=12, pady=4)
                continue
            label, cmd = item
            btn = ctk.CTkButton(main, text=label, fg_color="transparent",
                               hover_color=self.theme["button_hover"],
                               text_color=self.theme["text"], font=("Arial", 12),
                               height=34, corner_radius=8, anchor="w",
                               command=cmd, cursor="hand2")
            btn.pack(fill="x", padx=8, pady=1)

        # Позиционирование
        self._ctx_menu.update_idletasks()
        w = self._ctx_menu.winfo_reqwidth()
        h = self._ctx_menu.winfo_reqheight()
        x, y = event.x_root, event.y_root
        sw = self._ctx_menu.winfo_screenwidth()
        sh = self._ctx_menu.winfo_screenheight()
        if x + w > sw - 5:
            x = sw - w - 5
        if y + h > sh - 5:
            y = sh - h - 5
        self._ctx_menu.geometry(f"+{x}+{y}")

        # Закрытие при клике вне меню
        def _on_focus_out(e):
            self.after(50, self._close_context_menu)
        self._ctx_menu.bind("<FocusOut>", _on_focus_out)
        self._ctx_menu.focus_set()

        # Сбросить защиту от мгновенного закрытия после 150мс
        self.after(150, lambda: setattr(self, '_ctx_menu_just_opened', False))

    def _toggle_like_and_update(self, track, row):
        self._toggle_like(track)
        liked = self._is_liked(track)
        for child in row.winfo_children():
            if isinstance(child, ctk.CTkFrame) and child.winfo_children():
                for btn in child.winfo_children():
                    if isinstance(btn, ctk.CTkButton) and btn.cget("text") in ("❤️", "🤍"):
                        btn.configure(text="❤️" if liked else "🤍", text_color=self.theme["accent"] if liked else self.theme["text"])
                        break
        # Обновить player bar если это текущий трек
        if self.current_track and track.get("videoId") == self.current_track.get("videoId"):
            self.pb_btn_like.configure(text="❤️" if liked else "🤍",
                                      text_color=self.theme["accent"] if liked else self.theme["text_secondary"])  
        # Обновить liked view если открыт
        if self.current_view == "liked":
            self.after_idle(self._show_liked)

    def _dislike_and_remove(self, track, row):
        self._dislike(track)
        try:
            if track in self.tracks:
                self.tracks.remove(track)
        except Exception:
            pass
        try:
            row.destroy()
        except Exception:
            pass

    def _context_similar(self, artist):
        """Показать похожие треки по контекстному меню."""
        self._show_similar_tracks_for_artist(artist)

    def _show_similar_tracks_for_artist(self, artist):
        self.current_view = "similar"
        self.nav_title.configure(text=f"Похожие на {artist}")
        self._clear()
        ctk.CTkLabel(self.scroll, text=f"🎵  Похожие на {artist}", font=("Arial", 16, "bold"),
                     text_color=self.theme["text"]).pack(anchor="w", padx=4, pady=(8, 4))
        ctk.CTkLabel(self.scroll, text="⏳  Ищем похожие треки…", font=("Arial", 13),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=4, pady=(0, 12))
        self.executor.submit(self._bg_similar, artist)

    def _copy_track_info(self, track):
        """Копировать название трека в буфер обмена."""
        title = track.get("title", "?")
        artist = track.get("artists", [{}])[0].get("name", "")
        text = f"{title} — {artist}"
        try:
            self.clipboard_clear()
            self.clipboard_append(text)
            self._toast(f"Скопировано: {text[:40]}", duration=1500)
        except Exception:
            pass

    # ═══════════════ ОБЛОЖКИ ═══════════════════════════════════════
    def _get_max_res_url(self, url):
        if not url: return url
        url = re.sub(r'=w\d+-h\d+.*', '=w600-h600-l90-rj', url)
        url = re.sub(r'/\d+x\d+bb', '/600x600bb', url)
        return url

    def _load_cover(self, url, label, size=(50, 50)):
        if not url: return
        max_url = self._get_max_res_url(url)
        cache_key = f"{max_url}|{size[0]}x{size[1]}"
        cached = self.image_cache.get(cache_key)
        if cached:
            label.configure(image=cached)
            return
        orig_key = f"{max_url}|orig"
        orig = self.orig_cache.get(orig_key)
        if orig:
            self._resize_and_apply(orig, label, size, cache_key)
        else:
            self.executor.submit(self._fetch_cover, max_url, label, size, cache_key, orig_key)

    def _fetch_cover(self, url, label, size, cache_key, orig_key):
        try:
            r = self.http.get(url, timeout=8)
            if r.status_code != 200: return
            img = Image.open(BytesIO(r.content)).convert("RGBA")
            self.orig_cache.put(orig_key, img)
            self._resize_and_apply(img, label, size, cache_key)
        except Exception:
            pass

    def _resize_and_apply(self, img, label, size, cache_key):
        try:
            resized = img.resize(size, Image.Resampling.LANCZOS)
            mask = Image.new("L", size, 0)
            d = ImageDraw.Draw(mask)
            d.rounded_rectangle([0, 0, size[0], size[1]], radius=size[0]//8, fill=255)
            resized.putalpha(mask)
            photo = ctk.CTkImage(light_image=resized, dark_image=resized, size=size)
            self.image_cache.put(cache_key, photo)
            self.after(0, lambda: label.winfo_exists() and label.configure(image=photo))
            if hasattr(self, "pb_cover") and label is self.pb_cover:
                base_img = img.convert("RGB")
                self.after(0, lambda im=base_img: self._set_ambient_from_image(im))
        except Exception:
            pass

    # ═════════════════ ПЛЕЕР БАР ═══════════════════════════════════
    def _build_player_bar(self):
        # Акцентная полоска сверху (2px)
        self.player_bar_accent = ctk.CTkFrame(self.right, height=2, fg_color=self.theme["accent"])
        self.player_bar_accent.pack(side="bottom", fill="x")

        self.player_bar = ctk.CTkFrame(self.right, height=100, fg_color=self.theme["sidebar"], corner_radius=0)
        self.player_bar.pack(side="bottom", fill="x")
        self.player_bar.pack_propagate(False)

        # ── Левая часть: Обложка + Инфо + Кнопки действий
        left_frame = ctk.CTkFrame(self.player_bar, fg_color="transparent", width=330)
        left_frame.pack(side="left", fill="y", padx=(20, 8), pady=10)
        left_frame.pack_propagate(False)

        left_inner = ctk.CTkFrame(left_frame, fg_color="transparent")
        left_inner.place(relx=0.0, rely=0.5, anchor="w")

        self.pb_cover = ctk.CTkLabel(left_inner, text="", image=self.placeholders["lg"], width=64, height=64, corner_radius=10)
        self.pb_cover.pack(side="left", padx=(0, 12))

        # Текст + кнопки действий (вертикально)
        mid_col = ctk.CTkFrame(left_inner, fg_color="transparent")
        mid_col.pack(side="left")

        self.pb_title = ctk.CTkLabel(mid_col, text="Ничего не играет", font=("Arial", 13, "bold"), text_color=self.theme["text"], anchor="w")
        self.pb_title.pack(fill="x", pady=(0, 1))
        self.pb_artist = ctk.CTkLabel(mid_col, text="Выберите трек", font=("Arial", 11), text_color=self.theme["text_secondary"], anchor="w")
        self.pb_artist.pack(fill="x", pady=(0, 6))

        # Ряд кнопок: ❤️ ＋
        pb_action_row = ctk.CTkFrame(mid_col, fg_color="transparent")
        pb_action_row.pack(fill="x")
        _sm_btn = {"width": 30, "height": 30, "corner_radius": 15, "fg_color": "transparent",
                   "hover_color": self.theme["button_hover"], "font": ("Segoe UI Emoji", 13)}
        self.pb_btn_like = ctk.CTkButton(pb_action_row, text="🤍", command=self._pb_toggle_like, **_sm_btn)
        self.pb_btn_like.pack(side="left", padx=(0, 4))
        self.pb_btn_add = ctk.CTkButton(pb_action_row, text="＋", text_color=self.theme["text_secondary"],
                                        command=self._pb_add_to_playlist, **_sm_btn)
        self.pb_btn_add.pack(side="left")

        # ── Центральная часть: Кнопки управления + Прогресс
        center_frame = ctk.CTkFrame(self.player_bar, fg_color="transparent")
        center_frame.pack(side="left", fill="both", expand=True, pady=4)

        # Вертикальный разделитель
        sep_left = ctk.CTkFrame(self.player_bar, fg_color=self.theme["divider"], width=1)
        sep_left.pack(side="left", fill="y", padx=0, pady=12)

        # Ряд с кнопками управления
        ctrl_row = ctk.CTkFrame(center_frame, fg_color="transparent")
        ctrl_row.pack(pady=(4, 2), fill="x")

        left_spacer = ctk.CTkFrame(ctrl_row, fg_color="transparent")
        left_spacer.pack(side="left", expand=True)

        btn_args = {"fg_color": "transparent", "hover_color": self.theme["button_hover"], "text_color": self.theme["text_secondary"], "width": 40, "height": 40, "corner_radius": 20}
        self.btn_shuffle = ctk.CTkButton(left_spacer, text="🔀", font=("Segoe UI Emoji", 16), command=self._toggle_shuffle, **btn_args)
        self.btn_shuffle.pack(side="left", padx=4)
        self.btn_prev = ctk.CTkButton(left_spacer, text="⏮", font=("Segoe UI Emoji", 18), command=self.prev_track, **btn_args)
        self.btn_prev.pack(side="left", padx=4)

        # Кнопка Play (увеличенная, акцентная)
        self.btn_play = ctk.CTkButton(left_spacer, text="▶", width=50, height=50, corner_radius=25,
                                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                                      text_color="white", font=("Segoe UI Emoji", 20), command=self._toggle_play)
        self.btn_play.pack(side="left", padx=8)

        self.btn_next = ctk.CTkButton(left_spacer, text="⏭", font=("Segoe UI Emoji", 18), command=self.next_track, **btn_args)
        self.btn_next.pack(side="left", padx=4)
        self.btn_repeat = ctk.CTkButton(left_spacer, text="🔁", font=("Segoe UI Emoji", 16), command=self._toggle_repeat, **btn_args)
        self.btn_repeat.pack(side="left", padx=4)
        self.btn_crossfade = ctk.CTkButton(left_spacer, text="➿", font=("Segoe UI Emoji", 16), command=self._toggle_crossfade, **btn_args)
        self.btn_crossfade.pack(side="left", padx=4)
        self.btn_crossfade.configure(text_color=self.theme["accent"] if self.is_crossfade else self.theme["text_secondary"])

        # Кнопки: Похожие треки, Текст
        right_ctrl = ctk.CTkFrame(ctrl_row, fg_color="transparent")
        right_ctrl.pack(side="right", padx=(0, 8))
        _sm2 = {"width": 34, "height": 34, "corner_radius": 17, "fg_color": "transparent",
                "hover_color": self.theme["button_hover"], "text_color": self.theme["text_secondary"],
                "font": ("Segoe UI Emoji", 14)}
        self.btn_similar = ctk.CTkButton(right_ctrl, text="🎵", command=self._show_similar_tracks, **_sm2)
        self.btn_similar.pack(side="left", padx=3)
        self.btn_lyrics = ctk.CTkButton(right_ctrl, text="📝", command=self._show_lyrics, **_sm2)
        self.btn_lyrics.pack(side="left", padx=3)


        # Мини-эквалайзер справа от кнопок
        self.eq_frame = ctk.CTkFrame(ctrl_row, fg_color="transparent", width=60)
        self.eq_frame.pack(side="right", padx=(0, 8))
        self.eq_bars = []
        for i in range(5):
            bar = ctk.CTkFrame(self.eq_frame, fg_color=self.theme["accent"], width=4, height=8, corner_radius=2)
            bar.pack(side="left", padx=2, pady=(12, 12))
            self.eq_bars.append(bar)
        self.after(300, self._update_eq_bars)

        # Ряд с прогрессом (выровнен по центру)
        prog_row = ctk.CTkFrame(center_frame, fg_color="transparent", height=24)
        prog_row.pack(fill="x", padx=20, pady=(2, 0))
        self.lbl_cur = ctk.CTkLabel(prog_row, text="0:00", width=44, font=("Consolas", 11), text_color=self.theme["text_secondary"])
        self.lbl_cur.pack(side="left")

        # Кастомный ползунок прогресса (6px)
        self.prog_bg = ctk.CTkFrame(prog_row, fg_color=self.theme["progress_bg"], height=6, corner_radius=3)
        self.prog_bg.pack(side="left", fill="x", expand=True, padx=10)
        self.prog_fill = ctk.CTkFrame(self.prog_bg, fg_color=self.theme["accent"], height=6, width=0, corner_radius=3)
        self.prog_fill.place(x=0, y=0, relheight=1)
        # Точка-индикатор (всегда белая, увеличивается при наведении)
        self.prog_dot = ctk.CTkFrame(self.prog_bg, fg_color="white", width=14, height=14, corner_radius=7)
        self.prog_dot.place(x=-7, y=-4)
        self.prog_dot.lift()

        for w in (self.prog_bg, self.prog_fill, self.prog_dot):
            w.bind("<Button-1>", self._drag_start)
            w.bind("<B1-Motion>", self._drag_move)
            w.bind("<ButtonRelease-1>", self._drag_end)
            w.bind("<Enter>", lambda _: (self.prog_fill.configure(fg_color=self._lighten(self.theme["accent"], 15)), self.prog_dot.lift(), self.prog_dot.configure(width=18, height=18, corner_radius=9, fg_color="white")))
            w.bind("<Leave>", lambda _: (self.prog_fill.configure(fg_color=self.theme["accent"]), self.prog_dot.configure(fg_color="white", width=14, height=14, corner_radius=7)) if not self.is_dragging else None)
            # Колёсико мыши — перемотка (±5% длительности)
            w.bind("<MouseWheel>", self._prog_mousewheel)

        # lbl_total — общая длительность трека
        self.lbl_total = ctk.CTkLabel(prog_row, text="0:00", width=44, font=("Consolas", 11), text_color=self.theme["text_secondary"])
        self.lbl_total.pack(side="left")

        # Индикатор предзагрузки (маленький спиннер)
        self.prefetch_badge = ctk.CTkFrame(prog_row, fg_color=self.theme["accent_soft"],
                                           corner_radius=14, height=24, width=0,
                                           border_width=1, border_color=self.theme["accent"])
        self.prefetch_badge.pack(side="left", padx=(6, 0))
        self.prefetch_badge.pack_propagate(False)
        self.prefetch_label = ctk.CTkLabel(self.prefetch_badge, text="",
                                           font=("Consolas", 10, "bold"),
                                           text_color=self.theme["accent"])
        self.prefetch_label.place(relx=0.5, rely=0.5, anchor="center")

        # Индикатор таймера сна — стильный бейдж рядом с таймкодом (гармоничное расположение)
        self.sleep_timer_badge = ctk.CTkFrame(prog_row, fg_color=self.theme["accent_soft"],
                                              corner_radius=14, height=24, width=0,
                                              border_width=1, border_color=self.theme["accent"])
        self.sleep_timer_badge.pack(side="left", padx=(6, 0))
        self.sleep_timer_badge.pack_propagate(False)
        self.sleep_timer_label = ctk.CTkLabel(self.sleep_timer_badge, text="",
                                              font=("Consolas", 10, "bold"),
                                              text_color=self.theme["accent"])
        self.sleep_timer_label.place(relx=0.5, rely=0.5, anchor="center")

        # ── Правая часть: Громкость (гармоничный мини-микшер)
        # Без разделителя — микшер органично вписан в player_bar

        vol_wrap = ctk.CTkFrame(self.player_bar, fg_color="transparent")
        vol_wrap.pack(side="right", padx=(4, 16), pady=0)

        self.btn_vol = ctk.CTkButton(vol_wrap, text="\U0001f50a", width=26, height=26, corner_radius=13,
                                     fg_color="transparent", hover_color=self.theme["button_hover"],
                                     text_color=self.theme["text_secondary"], font=("Segoe UI Emoji", 13), command=self._toggle_mute)
        self.btn_vol.pack(side="left", padx=(0, 2))

        self.vol_slider = ctk.CTkSlider(vol_wrap, from_=0, to=100, number_of_steps=100,
                                        fg_color=self.theme["progress_bg"], progress_color=self.theme["accent"],
                                        button_color=self.theme["accent"], button_hover_color=self._lighten(self.theme["accent"]),
                                        button_length=14, height=4,
                                        command=self._vol_change)
        self.vol_slider.set(self.settings.get("volume", 80))
        self.vol_slider.pack(side="left", padx=(2, 4))

        self.vol_pct_label = ctk.CTkLabel(vol_wrap, text="80%", width=30,
                                          font=("Consolas", 10), text_color=self.theme["text_secondary"])
        self.vol_pct_label.pack(side="left")

        self.vol_panel = vol_wrap  # для совместимости с _apply_cover_color_to_mixer

        # Если уже есть цвет обложки — применяем
        if self._cover_accent:
            self._apply_cover_color_to_mixer(self._cover_accent)

    def _prog_mousewheel(self, event):
        """Перемотка колёсиком мыши над прогресс-баром (±5% от длительности)."""
        if self.current_duration <= 0 or not self.player or self.is_dragging:
            return
        try:
            ms = self.player.get_time()
            delta_pct = 0.05
            if hasattr(event, 'num') and event.num == 5:
                delta_pct = -0.05
            elif hasattr(event, 'delta') and event.delta < 0:
                delta_pct = -0.05
            seek_ms = int(ms + delta_pct * self.current_duration * 1000)
            seek_ms = max(0, min(int(self.current_duration * 1000), seek_ms))
            self.player.set_time(seek_ms)
            sec = seek_ms // 1000
            self.lbl_cur.configure(text=f"{sec // 60}:{sec % 60:02d}")
        except Exception:
            pass

    # ──── Логика Плеера ───────────────────────────────────────────
    def _toggle_play(self):
        if self.crossfade_active:
            self._cancel_crossfade()
        if self.player:
            if self.player.is_playing():
                self.player.pause()
                self.btn_play.configure(text="▶")
            else:
                self.player.play()
                self.btn_play.configure(text="⏸")

    def _toggle_radio_key(self, event):
        self.radio_mode = not self.radio_mode
        self.settings["radio_mode"] = self.radio_mode
        self._save_json(self.settings_file, self.settings)
        self._toast("📻 Радио: " + ("ВКЛ" if self.radio_mode else "ВЫКЛ"))

    def _vol_change(self, v):
        if self.player:
            self.player.audio_set_volume(int(v))
        if int(v) > 0 and self.is_muted:
            self.is_muted = False
        if int(v) == 0:
            self.btn_vol.configure(text="\U0001f507")
        elif int(v) < 50:
            self.btn_vol.configure(text="\U0001f509")
        else:
            self.btn_vol.configure(text="\U0001f50a")
        if hasattr(self, 'vol_pct_label') and self.vol_pct_label.winfo_exists():
            self.vol_pct_label.configure(text=f"{int(v)}%")

    def _toggle_mute(self):
        if self.is_muted:
            if self.player: self.player.audio_set_volume(int(self.previous_volume))
            self.vol_slider.set(self.previous_volume)
            self.is_muted = False
            v = int(self.previous_volume)
            if v == 0:
                self.btn_vol.configure(text="\U0001f507")
            elif v < 50:
                self.btn_vol.configure(text="\U0001f509")
            else:
                self.btn_vol.configure(text="\U0001f50a")
            if hasattr(self, 'vol_pct_label') and self.vol_pct_label.winfo_exists():
                self.vol_pct_label.configure(text=f"{v}%")
        else:
            self.previous_volume = self.vol_slider.get()
            if self.player: self.player.audio_set_volume(0)
            self.vol_slider.set(0)
            self.btn_vol.configure(text="\U0001f507")
            self.is_muted = True
            if hasattr(self, 'vol_pct_label') and self.vol_pct_label.winfo_exists():
                self.vol_pct_label.configure(text="0%")

    def _toggle_shuffle(self):
        self.is_shuffle = not self.is_shuffle
        if self.is_shuffle:
            self.shuffle_order = self._smart_shuffle()
            self.btn_shuffle.configure(text_color=self.theme["accent"])
            self._toast("Микс включён")
        else:
            self.shuffle_order = []
            self.btn_shuffle.configure(text_color=self.theme["text_secondary"])
            self._toast("Микс выключен")
        self.settings["shuffle"] = self.is_shuffle
        self._save_json(self.settings_file, self.settings)

    def _smart_shuffle(self):
        """Smart shuffle: group tracks by artist, shuffle groups, put current first."""
        if not self.tracks or len(self.tracks) < 2:
            return list(range(len(self.tracks)))
        artist_groups = defaultdict(list)
        for idx, t in enumerate(self.tracks):
            artists = t.get("artists", [])
            name = ""
            if artists and isinstance(artists, list) and artists:
                first = artists[0]
                name = first.get("name", "") if isinstance(first, dict) else str(first)
            name = name.lower().strip() or f"_unknown_{idx}"
            artist_groups[name].append(idx)
        groups = list(artist_groups.values())
        random.shuffle(groups)
        result = []
        for group in groups:
            shuffled = group[:]
            random.shuffle(shuffled)
            result.extend(shuffled)
        if self.current_track and self.tracks:
            try:
                cur_idx = self.tracks.index(self.current_track)
                if cur_idx in result:
                    result.remove(cur_idx)
                    result.insert(0, cur_idx)
            except (ValueError, IndexError):
                pass
        return result

    def _toggle_repeat(self):
        self.repeat_mode = (self.repeat_mode + 1) % 3
        icons = ["🔁", "🔂", "🔁"]
        labels = ["Повтор выключен", "Повтор трека", "Повтор всех"]
        icon = icons[self.repeat_mode]
        active = self.repeat_mode != 0
        self.btn_repeat.configure(text=icon, text_color=self.theme["accent"] if active else self.theme["text_secondary"])
        self._toast(labels[self.repeat_mode])
        self.settings["repeat_mode"] = self.repeat_mode
        self._save_json(self.settings_file, self.settings)

    def _toggle_crossfade(self):
        self.is_crossfade = not self.is_crossfade
        self.btn_crossfade.configure(text_color=self.theme["accent"] if self.is_crossfade else self.theme["text"])
        self._toast("Кроссфейд: " + ("ВКЛ" if self.is_crossfade else "ВЫКЛ"))

    # ──── Прогресс ────────────────────────────────────────────────
    def _drag_start(self, e):
        if self.current_duration <= 0 or not self.player: return
        self.is_dragging = True
        self._drag_update(e)

    def _drag_move(self, e):
        if not self.is_dragging: return
        self._drag_update(e)

    def _drag_update(self, e):
        w = self.prog_bg.winfo_width()
        if w <= 0: return
        x = e.x_root - self.prog_bg.winfo_rootx()
        pct = max(0.0, min(1.0, x / w))
        t = int(pct * self.current_duration)
        fw = int(pct * w)
        if fw < 1:
            fw = 0
        self.prog_fill.place_configure(width=fw)
        self.prog_dot.place(x=max(0, fw - 7), y=-4)
        self.lbl_cur.configure(text=f"{t // 60}:{t % 60:02d}")

    def _drag_end(self, e):
        if not self.is_dragging: return
        self.is_dragging = False
        w = self.prog_bg.winfo_width()
        if w <= 0: return
        x = e.x_root - self.prog_bg.winfo_rootx()
        pct = max(0.0, min(1.0, x / w))
        if self.player:
            self.player.set_time(int(pct * self.current_duration * 1000))
        self.prog_fill.configure(fg_color=self.theme["accent"])
        self.prog_dot.configure(fg_color="white")

    def _tick_progress(self):
        if not self.running:
            return
        try:
            if (self.player and self.current_duration > 0
                    and not self.is_dragging
                    and self.prog_bg.winfo_exists()):
                ms = self.player.get_time()
                if ms >= 0:
                    sec = ms // 1000
                    pct = sec / self.current_duration
                    w = self.prog_bg.winfo_width()
                    if w > 0:
                        fw = int(pct * w)
                        if fw < 1:
                            fw = 0
                        self.prog_fill.place_configure(width=fw)
                        self.prog_dot.place(x=max(0, fw - 7), y=-4)
                    self.lbl_cur.configure(text=f"{sec // 60}:{sec % 60:02d}")
                    # Запуск кроссфейда за N сек до конца
                    if (self.is_crossfade and not self.crossfade_active
                            and self.current_duration > self.crossfade_duration and sec > 0):
                        remaining = self.current_duration - sec
                        if remaining <= self.crossfade_duration:
                            self._start_crossfade()
            # Синхронизация кнопки Play с реальным состоянием VLC
            if not self._is_loading and self.player and self.current_track:
                try:
                    playing = self.player.is_playing()
                    cur_text = self.btn_play.cget("text")
                    if playing and cur_text == "▶":
                        self.btn_play.configure(text="⏸")
                    elif not playing and cur_text == "⏸":
                        # Не переключать если на паузе — пользователь сам поставил
                        pass
                except Exception:
                    pass
        except tk.TclError:
            pass
        # Save playback state every ~15 seconds (every 30 ticks at 500ms)
        if not hasattr(self, '_playback_save_counter'):
            self._playback_save_counter = 0
        self._playback_save_counter += 1
        if self._playback_save_counter >= 30:
            self._playback_save_counter = 0
            self._save_playback_state()
        # Prefetch indicator
        try:
            if self._is_prefetching:
                if not self.prefetch_label.cget("text"):
                    self.prefetch_label.configure(text="↻")
                    self.prefetch_badge.configure(width=30)
            else:
                if self.prefetch_label.cget("text"):
                    self.prefetch_label.configure(text="")
                    self.prefetch_badge.configure(width=0)
        except Exception:
            pass
        self.after(250, self._tick_progress)

    def _update_eq_bars(self):
        if not self.running or not hasattr(self, "eq_bars"):
            return
        playing = False
        try:
            playing = bool(self.player and self.player.is_playing())
        except Exception:
            pass
        now = time.time()
        for idx, bar in enumerate(self.eq_bars):
            try:
                if not bar.winfo_exists():
                    continue
                if playing:
                    phase = self.eq_phases[idx % len(self.eq_phases)]
                    speed = 3.5 + idx * 0.8  # Разная скорость для каждого бара
                    v = (math.sin(now * speed + phase) + 1.0) / 2.0
                    # Добавляем немного «шума» для реалистичности
                    noise = math.sin(now * 7.3 + idx * 2.1) * 0.15
                    v = max(0.0, min(1.0, v + noise))
                    h = int(6 + v * 20)
                    # Меняем цвет от приглушённого к яркому
                    brightness = 0.5 + v * 0.5
                    accent_rgb = self._hex_to_rgb(self.theme["accent"])
                    r = int(accent_rgb[0] * brightness)
                    g = int(accent_rgb[1] * brightness)
                    b = int(accent_rgb[2] * brightness)
                    bar.configure(height=h, fg_color=f"#{r:02x}{g:02x}{b:02x}")
                else:
                    bar.configure(height=6, fg_color=self._darken(self.theme["accent"], 40))
            except (tk.TclError, Exception):
                continue
        self.after(80 if playing else 300, self._update_eq_bars)

    # ──── Воспроизведение ─────────────────────────────────────────
    def play(self, track: dict) -> None:
        if not self._check_vlc():
            self._toast("VLC недоступен")
            return
        if self.crossfade_active:
            self._cancel_crossfade()
        # Остановить текущее воспроизведение перед запуском нового
        try:
            self.player.stop()
        except Exception:
            pass
        self.current_track = track
        title = track.get("title", "?")
        artist = track.get("artists", [{}])[0].get("name", "")
        self.pb_title.configure(text=title[:40])
        self.pb_artist.configure(text=artist[:40])
        self.btn_play.configure(text="⏸")
        # Синхронизировать лайк-кнопку в player bar
        liked = self._is_liked(track)
        self.pb_btn_like.configure(text="❤️" if liked else "🤍",
                                  text_color=self.theme["accent"] if liked else self.theme["text_secondary"])
        self._add_to_history(track)
        # Last.fm now playing
        self._lastfm_update_now_playing(track)
        url = self._get_best_thumbnail(track)
        if url:
            self._load_cover(url, self.pb_cover, (72, 72))
        vid = track.get("videoId")
        if vid:
            self._is_loading = True
            self.btn_play.configure(text="⏳")
            self.executor.submit(self._stream, vid)

    def _hide_loading(self):
        """Скрыть индикатор загрузки и восстановить кнопку Play.
        Проверяет состояние VLC с задержкой, т.к. is_playing() может
        возвращать False сразу после play() из-за буферизации."""
        self._is_loading = False
        self.after(150, self._sync_play_button)

    def _sync_play_button(self):
        """Синхронизировать состояние кнопки Play с реальным состоянием VLC."""
        try:
            if self.player and self.player.is_playing():
                self.btn_play.configure(text="⏸")
            else:
                self.btn_play.configure(text="▶")
        except Exception:
            self.btn_play.configure(text="▶")

    def _stream(self, vid: str) -> None:
        try:
            # Check for local file
            local_path = None
            if self.current_track:
                local_path = self.current_track.get("_local_path")
            if local_path and os.path.isfile(local_path):
                log.info("Playing local file: %s", local_path)
                with self._lock_player:
                    m = self.vlc_instance.media_new(local_path)
                    self.player.set_media(m)
                    self.player.play()
                    self.player.audio_set_volume(int(self.vol_slider.get()))
                # Get duration from VLC media
                self.after(500, lambda: self._update_local_duration())
                # Явно ⏸ для локального файла (hide_loading проверит с задержкой)
                self.after(0, lambda: self.btn_play.configure(text="⏸"))
                self.after(0, self._hide_loading)
                return

            cached = self._get_cached_stream(vid)
            au = None
            dur = 0
            if cached:
                au, dur = cached
                log.info("Stream cache hit for %s", vid)
                self.after(0, self._hide_loading)
            else:
                log.info("Fetching stream for %s ...", vid)
                ydl_opts = {
                    "format": "bestaudio/best",
                    "quiet": True, "no_warnings": True,
                    "noplaylist": True, "skip_download": True,
                    "retries": 3, "socket_timeout": 15,
                    "extract_flat": False,
                    "no_check_certificate": True,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
                    au = info.get("url")
                    dur = info.get("duration", 0)
                    if au:
                        with self._lock_cache:
                            self.stream_cache[vid] = (au, dur, time.time())
                        log.info("Stream resolved: duration=%ds", dur)
            if au:
                with self._lock_player:
                    m = self.vlc_instance.media_new(au)
                    self.player.set_media(m)
                    self.player.play()
                    self.player.audio_set_volume(int(self.vol_slider.get()))
                self.current_duration = dur
                self.after(0, lambda: self.lbl_total.configure(text=f"{dur // 60}:{dur % 60:02d}"))
                # Явно устанавливаем ⏸ после успешного запуска потока
                self.after(0, lambda: self.btn_play.configure(text="⏸"))
                # Prefetch следующего трека в фоне
                self._prefetch_next_track()
                # Last.fm scrobble
                if self.current_track:
                    self._lastfm_scrobble(self.current_track)
        except Exception as e:
            log.error("Stream error for %s: %s", vid, e)
            self.after(0, self._hide_loading)
            err_msg = str(e)
            if "geo" in err_msg.lower():
                detail = "Трек недоступен в вашем регионе"
            elif "age" in err_msg.lower() or "sign in" in err_msg.lower():
                detail = "Требуется авторизация"
            elif "not found" in err_msg.lower() or "unavailable" in err_msg.lower():
                detail = "Трек недоступен"
            elif "network" in err_msg.lower() or "timeout" in err_msg.lower() or "connection" in err_msg.lower():
                detail = "Ошибка сети. Проверьте подключение"
            else:
                detail = f"Ошибка: {err_msg[:50]}"
            self.after(0, lambda d=detail: self._toast(d))

    def _update_local_duration(self):
        """Обновить длительность локального файла из VLC."""
        try:
            if self.player:
                dur_ms = self.player.get_length()
                if dur_ms > 0:
                    self.current_duration = dur_ms / 1000
                    dur = int(self.current_duration)
                    self.lbl_total.configure(text=f"{dur // 60}:{dur % 60:02d}")
        except Exception:
            pass

    def _prefetch_next_track(self):
        """Предзагрузка URL следующего трека в кэш (фоновый поток)."""
        with self._lock_tracks:
            if not self.tracks:
                return
            next_idx = self._get_next_track_index()
            if next_idx < 0 or next_idx >= len(self.tracks):
                return
            next_track = self.tracks[next_idx]
        vid = next_track.get("videoId")
        if not vid or self._get_cached_stream(vid):
            return  # Уже в кэше
        self.executor.submit(self._bg_prefetch, vid)

    def _bg_prefetch(self, vid: str) -> None:
        """Фоновая предзагрузка потока для мгновенного переключения."""
        try:
            self._is_prefetching = True
            log.info("Prefetching next track stream: %s", vid)
            ydl_opts = {
                "format": "bestaudio/best",
                "quiet": True, "no_warnings": True,
                "noplaylist": True, "skip_download": True,
                "retries": 3, "socket_timeout": 15,
                "no_check_certificate": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
                au = info.get("url")
                dur = info.get("duration", 0)
            if au:
                try:
                    resp = self.http.head(au, timeout=5, allow_redirects=True)
                    if resp.status_code >= 400:
                        log.warning("Prefetch URL invalid (HTTP %d) for %s", resp.status_code, vid)
                        return
                except Exception:
                    log.debug("Prefetch URL validation failed for %s, caching anyway", vid)
                with self._lock_cache:
                    self.stream_cache[vid] = (au, dur, time.time())
                log.info("Prefetch complete: %s (duration=%ds)", vid, dur)
        except Exception as e:
            log.debug("Prefetch failed for %s: %s", vid, e)
        finally:
            self._is_prefetching = False

    def _find_current_index(self):
        if not self.current_track or not self.tracks:
            return -1
        vid = self.current_track.get("videoId")
        if not vid:
            return -1
        for i, t in enumerate(self.tracks):
            if t.get("videoId") == vid:
                return i
        return -1

    def _get_next_track_index(self):
        if not self.tracks:
            return -1
        if self.repeat_mode == 1 and self.current_track:
            return self._find_current_index()
        i = self._find_current_index()
        if i < 0:
            return 0 if self.tracks else -1
        if self.is_shuffle and self.shuffle_order:
            try:
                cur_pos = self.shuffle_order.index(i)
            except ValueError:
                cur_pos = -1
            if cur_pos < len(self.shuffle_order) - 1:
                return self.shuffle_order[cur_pos + 1]
            elif self.repeat_mode == 2:
                return self.shuffle_order[0]
            return -1
        if i < len(self.tracks) - 1:
            return i + 1
        if self.repeat_mode == 2:
            return 0
        return -1

    def prev_track(self) -> None:
        if not self.current_track or not self.tracks:
            return
        if self.crossfade_active:
            self._cancel_crossfade()
        i = self._find_current_index()
        if i < 0:
            self.play(self.tracks[0])
            return
        if i > 0:
            self.play(self.tracks[i - 1])
        else:
            if self.player:
                self.player.set_time(0)

    def next_track(self) -> None:
        i = self._get_next_track_index()
        if i >= 0:
            self.play(self.tracks[i])

    # ──── Кроссфейд (как в ВК) ─────────────────────────────────────
    def _start_crossfade(self):
        if self.crossfade_active or not self.is_crossfade:
            return
        if not self._check_vlc():
            return
        next_idx = self._get_next_track_index()
        if next_idx < 0:
            return
        next_track = self.tracks[next_idx]
        vid = next_track.get("videoId")
        if not vid:
            return
        cached = self._get_cached_stream(vid)
        if cached:
            au, dur = cached
            if au:
                try:
                    m = self.vlc_instance.media_new(au)
                    self.player_b.set_media(m)
                    self.player_b.play()
                    self.player_b.audio_set_volume(0)
                except Exception as e:
                    log.error("Crossfade VLC error: %s", e)
                    return
                self.crossfade_active = True
                self.crossfade_started = time.time()
                self._next_track_data = next_track
                self.after(100, self._crossfade_tick)
                return
        # Предзагрузка следующего трека в фоне
        log.info("Pre-fetching next track for crossfade: %s", vid)
        self.executor.submit(self._prefetch_crossfade, vid, next_track)

    def _prefetch_crossfade(self, vid, track):
        """Предзагрузка аудио для кроссфейда."""
        try:
            ydl_opts = {"format": "bestaudio/best", "quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True, "retries": 3, "socket_timeout": 15}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
                au = info.get("url")
                dur = info.get("duration", 0)
                if au:
                    with self._lock_cache:
                        self.stream_cache[vid] = (au, dur, time.time())
                    self.after(0, lambda: self._start_crossfade_with_url(au, track))
        except Exception as e:
            log.warning("Crossfade prefetch failed for %s: %s", vid, e)

    def _start_crossfade_with_url(self, au, track):
        """Начать кроссфейд с уже полученным URL."""
        if self.crossfade_active or not self.is_crossfade:
            return
        if not self._check_vlc():
            return
        try:
            m = self.vlc_instance.media_new(au)
            self.player_b.set_media(m)
            self.player_b.play()
            self.player_b.audio_set_volume(0)
            self.crossfade_active = True
            self.crossfade_started = time.time()
            self._next_track_data = track
            self.after(100, self._crossfade_tick)
            log.info("Crossfade started with prefetched track")
        except Exception as e:
            log.error("Crossfade start failed: %s", e)
            self.crossfade_active = False

    def _crossfade_tick(self):
        if not self.crossfade_active or not self.running:
            return
        if not self._check_vlc():
            self._cancel_crossfade()
            return
        try:
            base_vol = int(self.vol_slider.get())
            elapsed = time.time() - self.crossfade_started
            progress = min(1.0, elapsed / self.crossfade_duration)
            smooth = progress * progress * (3 - 2 * progress)
            vol_a = int(base_vol * (1.0 - smooth))
            vol_b = int(base_vol * smooth)
            if self.player:
                self.player.audio_set_volume(max(0, vol_a))
            if self.player_b:
                self.player_b.audio_set_volume(max(0, vol_b))
            if progress >= 1.0:
                self._finish_crossfade()
                return
            self.after(50, self._crossfade_tick)
        except Exception:
            self._cancel_crossfade()

    def _finish_crossfade(self):
        if not self._check_vlc():
            self.crossfade_active = False
            self.crossfade_started = False
            return
        try:
            self.crossfade_active = False
            self.crossfade_started = False
            base_vol = int(self.vol_slider.get())
            if self.player_b:
                self.player_b.audio_set_volume(base_vol)
            if self.player:
                self.player.stop()
                self.player.audio_set_volume(base_vol)
            if hasattr(self, '_next_track_data') and self._next_track_data:
                track = self._next_track_data
                self.current_track = track
                title = track.get("title", "?")
                artist = track.get("artists", [{}])[0].get("name", "")
                self.pb_title.configure(text=title[:40])
                self.pb_artist.configure(text=artist[:40])
                self._add_to_history(track)
                # Обновить лайк-кнопку в player bar
                liked = self._is_liked(track)
                self.pb_btn_like.configure(text="❤️" if liked else "🤍",
                                          text_color=self.theme["accent"] if liked else self.theme["text_secondary"])
                self.btn_play.configure(text="⏸")
                url = self._get_best_thumbnail(track)
                if url:
                    self._load_cover(url, self.pb_cover, (72, 72))
                # Обновить длительность трека
                vid = track.get("videoId")
                if vid:
                    cached = self._get_cached_stream(vid)
                    if cached:
                        self.current_duration = cached[1]
                        dur = cached[1]
                        self.lbl_total.configure(text=f"{dur // 60}:{dur % 60:02d}")
                self._next_track_data = None
        except Exception:
            pass

    def _cancel_crossfade(self):
        try:
            self.crossfade_active = False
            self.crossfade_started = False
            base_vol = int(self.vol_slider.get())
            if self.player:
                self.player.audio_set_volume(base_vol)
            if self.player_b:
                self.player_b.stop()
                self.player_b.audio_set_volume(0)
        except Exception:
            pass

    # ──── Плейлисты ───────────────────────────────────────────────
    def show_playlists(self):
        self.current_view = "playlists"
        self.nav_title.configure(text="Плейлисты")
        self._update_nav_for_view()
        self._clear()
        hdr = ctk.CTkFrame(self.scroll, fg_color="transparent")
        hdr.pack(fill="x", pady=(0, 20))
        ctk.CTkButton(hdr, text="📤  Экспорт", height=38, corner_radius=19,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], font=("Arial", 13),
                      command=self._export_playlists).pack(side="left", padx=(0, 6))
        ctk.CTkButton(hdr, text="📥  Импорт", height=38, corner_radius=19,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], font=("Arial", 13),
                      command=self._import_playlists_file).pack(side="left", padx=(0, 6))
        ctk.CTkButton(hdr, text="📀  M3U", height=38, corner_radius=19,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], font=("Arial", 13),
                      command=self._import_m3u).pack(side="left", padx=(0, 6))
        ctk.CTkButton(hdr, text="⇪  Импорт из сервисов", height=38, corner_radius=19,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], font=("Arial", 13),
                      command=self._import_from_services).pack(side="left")
        ctk.CTkButton(hdr, text="＋  Создать плейлист", height=42, corner_radius=21,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 14, "bold"),
                      command=self._create_playlist).pack(side="right")
        if not self.playlists:
            ctk.CTkLabel(self.scroll, text="💿", font=("Arial", 40), text_color=self.theme["text_secondary"]).pack(pady=(30, 8))
            ctk.CTkLabel(self.scroll, text="Пока нет плейлистов", font=("Arial", 16), text_color=self.theme["text_secondary"]).pack(pady=(0, 30))
            return
        g = ctk.CTkFrame(self.scroll, fg_color="transparent")
        g.pack(fill="x")
        for i in range(3): g.columnconfigure(i, weight=1, uniform="pl")
        for idx, name in enumerate(self.playlists):
            self._playlist_card(g, name, idx // 3, idx % 3)

    def _playlist_card(self, parent, name, row, col):
        card = ctk.CTkFrame(parent, fg_color=self.theme["card"], corner_radius=14, border_width=1, border_color=self.theme.get("card_border", self.theme["divider"]))
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
        tracks = self.playlists[name]
        cvr_f = ctk.CTkFrame(card, fg_color=self.theme["button"], width=160, height=100, corner_radius=10)
        cvr_f.pack(padx=14, pady=(14, 8))
        cvr_f.pack_propagate(False)
        ctk.CTkLabel(cvr_f, text="📀", font=("Arial", 36)).pack(expand=True)
        if tracks:
            url = self._get_best_thumbnail(tracks[0])
            if url:
                lbl = ctk.CTkLabel(cvr_f, text="")
                lbl.place(relx=0.5, rely=0.5, anchor="center")
                self._load_cover(url, lbl, (100, 100))
        ctk.CTkLabel(card, text=name, font=("Arial", 14, "bold"), text_color=self.theme["text"]).pack(anchor="w", padx=14)
        ctk.CTkLabel(card, text=f"{len(tracks)} треков", font=("Arial", 11), text_color=self.theme["text_secondary"]).pack(anchor="w", padx=14, pady=(0, 6))
        bf = ctk.CTkFrame(card, fg_color="transparent")
        bf.pack(fill="x", padx=14, pady=(4, 14))
        ctk.CTkButton(bf, text="▶", width=30, height=30, corner_radius=15, fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]), text_color="white", command=lambda: self._play_pl(name)).pack(side="left", padx=3)
        ctk.CTkButton(bf, text="👁", width=30, height=30, corner_radius=15, fg_color=self.theme["button"], hover_color=self.theme["button_hover"], text_color=self.theme["text"], command=lambda: self._view_playlist(name)).pack(side="left", padx=3)
        ctk.CTkButton(bf, text="🗑", width=30, height=30, corner_radius=15, fg_color="#c0392b", hover_color="#e74c3c", text_color="white", command=lambda: self._del_playlist(name)).pack(side="right", padx=3)

    def _create_playlist(self):
        """Создание плейлиста — inline-форма внутри основного контента."""
        self.current_view = "new_playlist"
        self.nav_title.configure(text="Новый плейлист")
        self._clear()
        frame = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16)
        frame.pack(fill="x", padx=10, pady=20)
        ctk.CTkLabel(frame, text="Название плейлиста", font=("Arial", 16, "bold"),
                     text_color=self.theme["text"]).pack(anchor="w", padx=20, pady=(20, 10))
        ent = ctk.CTkEntry(frame, height=44, fg_color=self.theme["fg"],
                            text_color=self.theme["text"], font=("Arial", 14))
        ent.pack(fill="x", padx=20, pady=(0, 16))
        ent.focus()
        def ok():
            n = ent.get().strip()
            if not n:
                self._toast("Введите название")
                return
            if n in self.playlists:
                self._toast(f'Плейлист "{n}" уже существует')
                return
            self.playlists[n] = []
            self._save_json(self.playlists_file, self.playlists)
            self._refresh_sidebar_playlists()
            log.info("Playlist created: %s", n)
            self._toast(f"Плейлист \"{n}\" создан")
            self.show_playlists()
        def cancel():
            self.show_playlists()
        ent.bind("<Return>", lambda _: ok())
        ent.bind("<Escape>", lambda _: cancel())
        bf = ctk.CTkFrame(frame, fg_color="transparent")
        bf.pack(anchor="e", padx=20, pady=(0, 20))
        ctk.CTkButton(bf, text="Создать", command=ok, width=120, height=38, corner_radius=19,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 13, "bold")).pack(side="left", padx=6)
        ctk.CTkButton(bf, text="Отмена", command=cancel, width=120, height=38, corner_radius=19,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], font=("Arial", 13)).pack(side="left", padx=6)

    def _import_from_services(self):
        """Импорт треков — inline-форма внутри основного контента."""
        if not self.playlists:
            self._toast("Сначала создайте плейлист")
            return
        self.current_view = "import"
        self.nav_title.configure(text="Импорт треков")
        self._clear()
        frame = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=16)
        frame.pack(fill="x", padx=10, pady=20)
        ctk.CTkLabel(frame, text="Импорт треков", font=("Arial", 16, "bold"),
                     text_color=self.theme["text"]).pack(anchor="w", padx=20, pady=(20, 6))
        ctk.CTkLabel(frame, text="Выберите плейлист:", font=("Arial", 13),
                     text_color=self.theme["text_secondary"]).pack(anchor="w", padx=20, pady=(8, 4))
        pl_names = list(self.playlists.keys())
        pl_var = tk.StringVar(value=pl_names[0] if pl_names else "")
        ctk.CTkComboBox(frame, values=pl_names, variable=pl_var, width=360,
                        fg_color=self.theme["fg"], text_color=self.theme["text"],
                        button_color=self.theme["button"],
                        button_hover_color=self.theme["button_hover"]).pack(anchor="w", padx=20, pady=(0, 10))
        ctk.CTkLabel(frame, text="Вставьте ссылки или названия треков (по одной строке).\n"
                     "Поддерживаются: YouTube ссылки (youtube.com/watch?v=... , youtu.be/...), Spotify, названия треков.\n"
                     "YouTube ссылки обрабатываются напрямую без поиска.",
                     font=("Arial", 11), text_color=self.theme["text_secondary"], justify="left").pack(anchor="w", padx=20, pady=(0, 8))
        txt = ctk.CTkTextbox(frame, height=200, fg_color=self.theme["fg"],
                             text_color=self.theme["text"], font=("Arial", 12))
        txt.pack(fill="x", padx=20, pady=(0, 10))
        txt.focus()

        # Status label for import progress
        import_status = ctk.CTkLabel(frame, text="", font=("Arial", 12),
                                     text_color=self.theme["accent"])
        import_status.pack(anchor="w", padx=20, pady=(0, 4))

        def do_import():
            raw = txt.get("1.0", "end").strip()
            if not raw:
                self.show_playlists()
                return
            target = pl_var.get()
            if not target:
                self._toast("Выберите плейлист")
                return
            lines = [l.strip() for l in raw.splitlines() if l.strip()]
            if not lines:
                self.show_playlists()
                return
            # Disable buttons during import
            import_btn.configure(state="disabled", text="⏳ Импортируем...")
            cancel_btn.configure(state="disabled")
            txt.configure(state="disabled")
            self.executor.submit(self._bg_import, lines, target, import_status)

        def cancel():
            self.show_playlists()

        bf = ctk.CTkFrame(frame, fg_color="transparent")
        bf.pack(anchor="e", padx=20, pady=(4, 20))
        import_btn = ctk.CTkButton(bf, text="Импортировать", command=do_import, width=150, height=38, corner_radius=19,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 13, "bold"))
        import_btn.pack(side="left", padx=6)
        cancel_btn = ctk.CTkButton(bf, text="Отмена", command=cancel, width=120, height=38, corner_radius=19,
                      fg_color=self.theme["button"], hover_color=self.theme["button_hover"],
                      text_color=self.theme["text"], font=("Arial", 13))
        cancel_btn.pack(side="left", padx=6)

    def _bg_import(self, lines, target, status_label):
        """Фоновый импорт треков с прогрессом."""
        added = 0
        total = len(lines)
        with self._lock_playlists:
            existing_vids = {t.get("videoId") for t in self.playlists.get(target, []) if t.get("videoId")}

        for i, line in enumerate(lines):
            # Обновить прогресс
            self.after(0, lambda idx=i, t=total: status_label.configure(
                text=f"⏳ Обработка {idx + 1}/{t}..."))

            track = None
            vid = None

            # Проверяем YouTube URL
            yt_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})', line)
            if yt_match:
                vid = yt_match.group(1)
                if vid in existing_vids:
                    continue
                # Создаём минимальный track-объект с videoId
                # Ищем через API чтобы получить метаданные
                if self.ytmusic:
                    try:
                        results = self.ytmusic.search(vid, limit=1)
                        if results:
                            track = results[0]
                    except Exception:
                        pass
                if not track:
                    track = {"videoId": vid, "title": line, "artists": [{"name": "YouTube"}]}
            else:
                # Проверяем Spotify playlist URL
                spotify_pl_match = re.search(r'spotify\.com/playlist/([a-zA-Z0-9]+)', line)
                if spotify_pl_match:
                    # Import Spotify playlist tracks
                    spotify_tracks = self._spotify_import_playlist(line)
                    if spotify_tracks:
                        for st in spotify_tracks:
                            if self.ytmusic:
                                try:
                                    results = self._api_search(st, limit=1)
                                    if results:
                                        track = results[0]
                                        sv = track.get("videoId")
                                        if sv and sv not in existing_vids:
                                            with self._lock_playlists:
                                                self.playlists.setdefault(target, []).append(track)
                                            existing_vids.add(sv)
                                            added += 1
                                except Exception:
                                    pass
                        continue
                # Обычный поиск по названию
                if self.ytmusic:
                    try:
                        results = self._api_search(line, limit=1)
                        if results:
                            track = results[0]
                            vid = track.get("videoId")
                    except Exception:
                        pass

            if track and vid and vid not in existing_vids:
                with self._lock_playlists:
                    self.playlists.setdefault(target, []).append(track)
                existing_vids.add(vid)
                added += 1
            elif track and not vid:
                with self._lock_playlists:
                    self.playlists.setdefault(target, []).append(track)
                added += 1

        if added > 0:
            with self._lock_playlists:
                self._save_json(self.playlists_file, self.playlists)
            self._refresh_sidebar_playlists()
            log.info("Imported %d tracks to '%s'", added, target)

        def _done():
            if added > 0:
                self._toast(f"Импортировано: {added} из {total} треков")
            else:
                self._toast("Не удалось импортировать треки")
            self.show_playlists()
        self.after(0, _done)

    def _view_playlist(self, name):
        self.current_view = "pl_view"
        self.nav_title.configure(text=name)
        self._clear()
        tracks = self.playlists.get(name, [])
        hdr = ctk.CTkFrame(self.scroll, fg_color="transparent")
        hdr.pack(fill="x", pady=(0, 14))
        ctk.CTkLabel(hdr, text=f"{len(tracks)} треков", font=("Arial", 13), text_color=self.theme["text_secondary"]).pack(side="left")
        if tracks:
            ctk.CTkButton(hdr, text="▶  Слушать", height=38, corner_radius=19, fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]), text_color="white", font=("Arial", 13, "bold"), command=lambda: self._play_pl(name)).pack(side="right")
            ctk.CTkButton(hdr, text="📀 M3U", height=38, corner_radius=19, fg_color=self.theme["button"], hover_color=self.theme["button_hover"], text_color=self.theme["text"], font=("Arial", 13), command=lambda: self._export_m3u(name)).pack(side="right", padx=(0, 6))
        if not tracks:
            ctk.CTkLabel(self.scroll, text="📭", font=("Arial", 40), text_color=self.theme["text_secondary"]).pack(pady=(30, 8))
            ctk.CTkLabel(self.scroll, text="Плейлист пуст", font=("Arial", 14), text_color=self.theme["text_secondary"]).pack(pady=(0, 30))
            return
        for i, t in enumerate(tracks): self._track_row(t, playlist_name=name, index=i)

    def _play_pl(self, name):
        tr = self.playlists.get(name, [])
        if tr:
            self.tracks = tr
            self.current_playlist = name
            # Сбросить shuffle_order при смене плейлиста
            if self.is_shuffle:
                self.shuffle_order = self._smart_shuffle()
                log.info("Shuffle order regenerated for playlist: %s (%d tracks)", name, len(self.shuffle_order))
            self.play(tr[0])

    def _del_playlist(self, name):
        self.playlists.pop(name, None)
        self._save_json(self.playlists_file, self.playlists)
        self._refresh_sidebar_playlists()
        self.show_playlists()

    def _add_to_pl_dialog(self, track):
        """Добавление трека в плейлист — inline-панель в верхней части контента."""
        if not self.playlists:
            self._toast("Создайте плейлист")
            return
        # Удаляем предыдущую inline-панель если есть
        if hasattr(self, '_inline_pl_panel') and self._inline_pl_panel:
            try:
                self._inline_pl_panel.destroy()
            except Exception:
                pass
            self._inline_pl_panel = None
        # Сохраняем предыдущий вид чтобы вернуться
        self._prev_view_before_pl = self.current_view

        panel = ctk.CTkFrame(self.scroll, fg_color=self.theme["card"], corner_radius=12, border_width=1, border_color=self.theme["accent"])
        panel.pack(fill="x", pady=(0, 12), padx=4)
        panel.pack_configure(before=self.scroll.winfo_children()[0] if self.scroll.winfo_children() else None)
        self._inline_pl_panel = panel

        top = ctk.CTkFrame(panel, fg_color="transparent")
        top.pack(fill="x", padx=16, pady=(12, 6))
        ctk.CTkLabel(top, text=f"➕  Добавить в плейлист:", font=("Arial", 13, "bold"),
                     text_color=self.theme["text"]).pack(side="left")
        ctk.CTkLabel(top, text=track.get("title", "?")[:35], font=("Arial", 12),
                     text_color=self.theme["text_secondary"]).pack(side="left", padx=(8, 0))
        ctk.CTkButton(top, text="✕", width=28, height=28, corner_radius=14,
                      fg_color="transparent", hover_color=self.theme["button_hover"],
                      text_color=self.theme["text_secondary"], font=("Arial", 14),
                      command=self._close_inline_pl_panel).pack(side="right")

        mid = ctk.CTkFrame(panel, fg_color="transparent")
        mid.pack(fill="x", padx=16, pady=(0, 10))
        var = tk.StringVar(value=list(self.playlists.keys())[0])
        ctk.CTkComboBox(mid, values=list(self.playlists.keys()), variable=var, width=300,
                        fg_color=self.theme["fg"], text_color=self.theme["text"],
                        button_color=self.theme["button"],
                        button_hover_color=self.theme["button_hover"]).pack(side="left")
        def ok():
            p = var.get()
            if p in self.playlists:
                # Проверяем уникальность по videoId
                track_vid = track.get("videoId")
                with self._lock_playlists:
                    if track_vid and any(t.get("videoId") == track_vid for t in self.playlists[p]):
                        already = True
                    else:
                        self.playlists[p].append(track)
                        already = False
                    self._save_json(self.playlists_file, self.playlists)
                if already:
                    self._toast(f"Трек уже в «{p}»")
                    self._close_inline_pl_panel()
                    return
                self._refresh_sidebar_playlists()
                log.info("Track added to playlist %s: %s", p, track.get("title", "?"))
                self._toast(f"Добавлено в «{p}»")
            self._close_inline_pl_panel()
        ctk.CTkButton(mid, text="Добавить", command=ok, width=110, height=34, corner_radius=17,
                      fg_color=self.theme["accent"], hover_color=self._lighten(self.theme["accent"]),
                      text_color="white", font=("Arial", 12, "bold")).pack(side="left", padx=(10, 0))

    def _close_inline_pl_panel(self):
        """Закрыть inline-панель добавления в плейлист и вернуться к предыдущему виду."""
        if hasattr(self, '_inline_pl_panel') and self._inline_pl_panel:
            try:
                self._inline_pl_panel.destroy()
            except Exception:
                pass
            self._inline_pl_panel = None

    def _remove_from_pl(self, name, idx):
        if name in self.playlists and 0 <= idx < len(self.playlists[name]):
            del self.playlists[name][idx]
            self._save_json(self.playlists_file, self.playlists)
            self._view_playlist(name)

    # ──── Экспорт / Импорт плейлистов ─────────────────────────────
    def _export_playlists(self):
        """Экспорт всех плейлистов в JSON-файл."""
        if not self.playlists:
            self._toast("Нет плейлистов для экспорта")
            return
        try:
            from tkinter import filedialog
            path = filedialog.asksaveasfilename(
                defaultextension=".json",
                filetypes=[("JSON файлы", "*.json"), ("Все файлы", "*.*")],
                title="Экспорт плейлистов",
                initialfile="mq_playlists_export.json"
            )
            if path:
                export_data = {
                    "app": "mq_player",
                    "version": "2.3",
                    "exported_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "playlists": self.playlists,
                    "liked_playlist": self.liked_playlist,
                }
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(export_data, f, ensure_ascii=False, indent=2)
                log.info("Playlists exported to: %s", path)
                self._toast(f"Экспортировано: {len(self.playlists)} плейлистов")
        except Exception as e:
            log.error("Export failed: %s", e)
            self._toast(f"Ошибка экспорта: {str(e)[:50]}")

    def _import_playlists_file(self):
        """Импорт плейлистов из JSON-файла."""
        try:
            from tkinter import filedialog
            path = filedialog.askopenfilename(
                filetypes=[("JSON файлы", "*.json"), ("Все файлы", "*.*")],
                title="Импорт плейлистов"
            )
            if not path:
                return
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            imported_pl = data.get("playlists", {})
            imported_liked = data.get("liked_playlist", [])
            merged = 0
            for name, tracks in imported_pl.items():
                if name in self.playlists:
                    # Сливаем без дубликатов
                    existing_vids = {t.get("videoId") for t in self.playlists[name] if t.get("videoId")}
                    added = 0
                    for t in tracks:
                        vid = t.get("videoId")
                        if vid and vid not in existing_vids:
                            self.playlists[name].append(t)
                            existing_vids.add(vid)
                            added += 1
                    merged += added
                else:
                    self.playlists[name] = tracks
                    merged += len(tracks)
            # Импорт liked
            if imported_liked:
                existing_liked_vids = {t.get("videoId") for t in self.liked_playlist if t.get("videoId")}
                liked_added = 0
                for t in imported_liked:
                    vid = t.get("videoId")
                    if vid and vid not in existing_liked_vids:
                        self.liked_playlist.append(t)
                        existing_liked_vids.add(vid)
                        self._liked_ids.add(vid)
                        liked_added += 1
                if liked_added:
                    self._save_json(self.liked_file, self.liked_playlist)
            if merged > 0 or (imported_liked and liked_added > 0):
                self._save_json(self.playlists_file, self.playlists)
                self._refresh_sidebar_playlists()
                log.info("Imported from %s: %d tracks in playlists, %d liked", path, merged, liked_added if imported_liked else 0)
                self._toast(f"Импортировано: {merged} треков")
            else:
                self._toast("Все треки уже существуют")
        except Exception as e:
            log.error("Import failed: %s", e)
            self._toast(f"Ошибка импорта: {str(e)[:50]}")


    # ──── Скачивание треков ────────────────────────────────────────
    def _download_track(self, track: dict, quality: str = "best") -> None:
        """Скачать трек в MP3/M4A: сначала диалог, потом фоновый поток."""
        vid = track.get("videoId")
        if not vid:
            self._toast("Невозможно скачать: нет videoId")
            return
        from tkinter import filedialog
        title = track.get("title", "Unknown")
        artist = track.get("artists", [{}])[0].get("name", "Unknown")
        safe_name = re.sub(r'[\\/:*?"<>|]', '', f"{artist} - {title}")
        initial_dir = os.path.join(os.path.expanduser("~"), "Music", "mq_downloads")
        os.makedirs(initial_dir, exist_ok=True)
        save_path = filedialog.asksaveasfilename(
            defaultextension=".m4a",
            filetypes=[("M4A audio", "*.m4a"), ("MP3 audio", "*.mp3"), ("Все файлы", "*.*")],
            title=f"Скачать: {title}",
            initialdir=initial_dir,
            initialfile=safe_name
        )
        if not save_path:
            return
        # Проверка FFmpeg
        if not shutil.which("ffmpeg"):
            self._toast("⚠️ FFmpeg не найден! Скачивание будет без конвертации.")
            log.warning("FFmpeg not found — download without conversion")
        self._toast(f"⏳ Скачивание: {title[:30]}...")
        self._download_cancel.clear()
        self.executor.submit(self._bg_download, track, vid, save_path)

    def _bg_download(self, track: dict, vid: str, save_path: str) -> None:
        """Фоновое скачивание трека с возможностью отмены через _download_cancel."""
        try:
            has_ffmpeg = bool(shutil.which("ffmpeg"))
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": save_path,
                "quiet": False, "no_warnings": True,
                "noplaylist": True, "retries": 3,
                "socket_timeout": 30, "no_check_certificate": True,
            }
            if has_ffmpeg:
                ydl_opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "m4a" if save_path.endswith(".m4a") else "mp3",
                    "preferredquality": "192",
                }]
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={vid}"])

            if self._download_cancel.is_set():
                try:
                    if os.path.exists(save_path): os.remove(save_path)
                except Exception: pass
                self.after(0, lambda: self._toast("❌ Скачивание отменено"))
                return

            self.after(0, lambda: self._toast(f"✅ Скачано: {os.path.basename(save_path)}"))
            log.info("Track downloaded: %s", save_path)
            vid_key = track.get("videoId", "")
            if vid_key:
                self.downloaded_tracks[vid_key] = save_path
                self._save_json(self.downloaded_tracks_file, self.downloaded_tracks)
        except Exception as e:
            if self._download_cancel.is_set():
                try:
                    if os.path.exists(save_path): os.remove(save_path)
                except Exception: pass
                self.after(0, lambda: self._toast("❌ Скачивание отменено"))
            else:
                log.error("Download failed: %s", e)
                self.after(0, lambda: self._toast(f"❌ Ошибка скачивания: {str(e)[:50]}"))

    def _cancel_download(self) -> None:
        """Отменить текущее скачивание."""
        self._download_cancel.set()
        self._toast("⏹ Скачивание отменяется...")

    # ──── Last.fm Scrobbling ───────────────────────────────────────

    # ──── Last.fm Scrobbling ───────────────────────────────────────
    def _lastfm_scrobble(self, track: dict) -> None:
        """Отправить скроббл на Last.fm. Только один раз за трек (по videoId)."""
        if not self.lastfm_session_key:
            return
        vid = track.get("videoId", "")
        if not vid or vid in self._lastfm_scrobbled:
            return  # Уже скробблен
        title = track.get("title", "")
        artist = track.get("artists", [{}])[0].get("name", "")
        duration = self.current_duration
        if not title or not artist or duration < 30:
            return
        elapsed = 0
        if self.player:
            try:
                elapsed = self.player.get_time() / 1000
            except Exception:
                pass
        # Last.fm требует: слушать >50% или >4 мин
        if elapsed < min(duration / 2, 240):
            return
        try:
            self._lastfm_scrobbled.add(vid)  # Помечаем ДО отправки, чтобы не дублировать
            ts = str(int(time.time()))
            sig_params = {
                "api_key": self.lastfm_api_key,
                "artist": artist,
                "duration": str(int(duration)),
                "method": "track.scrobble",
                "sk": self.lastfm_session_key,
                "timestamp": ts,
                "track": title,
            }
            sig_str = "".join(f"{k}{v}" for k, v in sorted(sig_params.items()))
            api_sig = hashlib.md5((sig_str + self.lastfm_api_secret).encode()).hexdigest()
            sig_params["api_sig"] = api_sig
            sig_params["format"] = "json"

            resp = self.http.post(
                "https://ws.audioscrobbler.com/2.0/",
                data=sig_params,
                timeout=10
            )
            if resp.status_code == 200:
                log.info("Last.fm scrobble: %s - %s", artist, title)
                # Сохраняем + ограничиваем размер (последние 500)
                if len(self._lastfm_scrobbled) > 500:
                    to_remove = list(self._lastfm_scrobbled)[:200]
                    for vid_rm in to_remove:
                        self._lastfm_scrobbled.discard(vid_rm)
                self._save_json(self._lastfm_scrobbled_file, list(self._lastfm_scrobbled))
            else:
                # Ошибка API — убираем из набора чтобы можно было повторить
                self._lastfm_scrobbled.discard(vid)
                log.debug("Last.fm scrobble HTTP %d for %s - %s", resp.status_code, artist, title)
        except Exception as e:
            self._lastfm_scrobbled.discard(vid)
            log.debug("Last.fm scrobble failed: %s", e)

    def _lastfm_update_now_playing(self, track):
        """Отправить 'now playing' на Last.fm."""
        if not self.lastfm_session_key:
            return
        try:
            title = track.get("title", "")
            artist = track.get("artists", [{}])[0].get("name", "")
            if not title or not artist:
                return
            sig_params = {
                "api_key": self.lastfm_api_key,
                "artist": artist,
                "method": "track.updateNowPlaying",
                "sk": self.lastfm_session_key,
                "track": title,
            }
            sig_str = "".join(f"{k}{v}" for k, v in sorted(sig_params.items()))
            api_sig = hashlib.md5((sig_str + self.lastfm_api_secret).encode()).hexdigest()
            sig_params["api_sig"] = api_sig
            sig_params["format"] = "json"

            resp = self.http.post(
                "https://ws.audioscrobbler.com/2.0/",
                data=sig_params,
                timeout=10
            )
            if resp.status_code == 200:
                log.info("Last.fm now playing: %s - %s", artist, title)
        except Exception as e:
            log.debug("Last.fm now playing failed: %s", e)

    # ──── Radio Mode ───────────────────────────────────────────────
    def _bg_radio_next(self):
        """Радио-режим: найти похожие треки на основе текущего."""
        with self._lock_tracks:
            if not self.current_track:
                return
            current_artist = self.current_track.get("artists", [{}])[0].get("name", "")
        if not current_artist:
            return
        query = f"{current_artist} songs"
        try:
            results = self._api_search(query, limit=10)
            if not results:
                results = self._load_personal_recommendations_bg()
            filtered = []
            for t in (results or []):
                vid = t.get("videoId")
                if vid and vid not in self.disliked:
                    filtered.append(t)
            if filtered:
                track = random.choice(filtered[:5])
                with self._lock_tracks:
                    # Повторная проверка — трек мог измениться пока искали
                    self.tracks.append(track)
                self.after(0, lambda t=track: self.play(t))
                self.after(0, lambda: self._toast("📻 Радио: похожий трек"))
                log.info("Radio: playing similar track for %s", current_artist)
        except Exception as e:
            log.error("Radio mode failed: %s", e)

    def _load_personal_recommendations_bg(self):
        """Fallback: загрузить рекомендации через историю."""
        rec_tracks = []
        seen = set()
        for item in sorted(self.history.values(), key=lambda x: x.get("last_played", 0), reverse=True)[:3]:
            track = item.get("track") or item
            artist = track.get("artists", [{}])[0].get("name", "") if track.get("artists") else ""
            if artist and artist not in seen:
                seen.add(artist)
                try:
                    results = self._api_search(f"{artist} best songs", limit=5)
                    for t in (results or []):
                        vid = t.get("videoId")
                        if vid and vid not in self.disliked:
                            rec_tracks.append(t)
                            if len(rec_tracks) >= 10:
                                return rec_tracks
                except Exception:
                    pass
        return rec_tracks

    # ──── Spotify Integration (без токена — через oEmbed) ──────────
    def _spotify_import_playlist(self, spotify_url):
        """Импорт треков из Spotify плейлиста (извлекает названия через open Spotify embed API → поиск на YouTube).
        НЕ требует OAuth-токен — использует публичный oEmbed-эндпоинт Spotify."""
        match = re.search(r'spotify\.com/playlist/([a-zA-Z0-9]+)', spotify_url)
        if not match:
            return []
        pl_id = match.group(1)
        try:
            # Используем открытый Spotify oEmbed для получения данных плейлиста
            embed_url = f"https://open.spotify.com/embed/playlist/{pl_id}"
            resp = self.http.get(
                "https://open.spotify.com/oembed",
                params={"url": embed_url},
                timeout=10
            )
            # oEmbed даёт только название плейлиста, не треки.
            # Для треков используем открытую HTML-страницу плейлиста.
            resp2 = self.http.get(
                f"https://open.spotify.com/embed/playlist/{pl_id}",
                headers={"Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0"},
                timeout=15
            )
            if resp2.status_code != 200:
                log.warning("Spotify embed page returned %d for playlist %s", resp2.status_code, pl_id)
                return []
            # Парсим JSON из HTML (Spotify встраивает данные в __NEXT_DATA__ или script)
            html = resp2.text
            # Ищем данные треков в JSON-вставке
            track_names = []
            # Паттерн: "title":"Song Name" рядом с "artist":{"name":"Artist Name"}
            # Или ищем structured data
            import json as _json
            # Попытка 1: найти JSON-блок с треками
            for pattern in [r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
                           r'__NEXT_DATA__\s*=\s*({.*?})\s*;?\s*</script>']:
                m = re.search(pattern, html, re.DOTALL)
                if m:
                    try:
                        data = _json.loads(m.group(1))
                        # Навигация по структуре данных Spotify Next.js
                        props = data.get("props", {}).get("pageProps", {})
                        # Ищем треки в состоянии
                        state = props.get("state", {})
                        if not state:
                            state = props
                        # Попробуем разные пути к трекам
                        track_items = None
                        for key in ("data", "entity", "initialState"):
                            obj = state.get(key) or state
                            if isinstance(obj, dict):
                                for k2 in ("playlistV2", "playlist"):
                                    pl_data = obj.get(k2, {})
                                    if isinstance(pl_data, dict):
                                        track_items = pl_data.get("trackItems") or pl_data.get("tracks", {}).get("items")
                                        if track_items:
                                            break
                            if track_items:
                                break
                        if track_items:
                            for item in track_items:
                                if not isinstance(item, dict):
                                    continue
                                t = item.get("track") or item.get("data") or item
                                if isinstance(t, dict):
                                    name = t.get("title", {}).get("text", "") if isinstance(t.get("title"), dict) else t.get("title", "")
                                    # Извлекаем имя артиста
                                    artist = ""
                                    artists = t.get("artists") or t.get("artist", {})
                                    if isinstance(artists, dict):
                                        artists = artists.get("items", [])
                                    if isinstance(artists, list):
                                        art = artists[0] if artists else {}
                                        artist = art.get("profile", {}).get("name", "") if isinstance(art, dict) else art.get("name", "")
                                    if name and artist:
                                        track_names.append(f"{artist} - {name}")
                                    elif name:
                                        track_names.append(name)
                    except Exception as e:
                        log.debug("Spotify JSON parse failed: %s", e)
            # Попытка 2: regex fallback — ищем пары "title"/"name" рядом
            if not track_names:
                # Ищем паттерн track name в HTML
                simple_titles = re.findall(r'"title":"([^"]+)"', html)
                seen = set()
                for t in simple_titles:
                    if len(t) > 2 and t not in seen and not t.startswith("Spotify"):
                        track_names.append(t)
                        seen.add(t)
                        if len(track_names) >= 50:
                            break
            if track_names:
                log.info("Spotify: extracted %d track names from playlist %s", len(track_names), pl_id)
            return track_names
        except Exception as e:
            log.debug("Spotify playlist import failed: %s", e)
            return []

    # ──── M3U Export / Import ──────────────────────────────────────
    def _export_m3u(self, playlist_name):
        """Экспорт плейлиста в M3U файл."""
        tracks = self.playlists.get(playlist_name, [])
        if not tracks:
            self._toast("Плейлист пуст")
            return
        try:
            from tkinter import filedialog
            path = filedialog.asksaveasfilename(
                defaultextension=".m3u",
                filetypes=[("M3U файлы", "*.m3u"), ("Все файлы", "*.*")],
                title=f"Экспорт M3U: {playlist_name}",
                initialfile=f"{playlist_name}.m3u"
            )
            if not path:
                return
            with open(path, "w", encoding="utf-8") as f:
                f.write("#EXTM3U\n")
                for t in tracks:
                    title = t.get("title", "Unknown")
                    artist = t.get("artists", [{}])[0].get("name", "Unknown")
                    duration = int(t.get("duration_seconds", t.get("duration", 0)))
                    vid = t.get("videoId", "")
                    f.write(f"#EXTINF:{duration},{artist} - {title}\n")
                    f.write(f"https://www.youtube.com/watch?v={vid}\n")
            self._toast(f"✅ M3U экспортирован: {os.path.basename(path)}")
            log.info("M3U exported: %s (%d tracks)", path, len(tracks))
        except Exception as e:
            log.error("M3U export failed: %s", e)
            self._toast(f"Ошибка: {str(e)[:50]}")

    def _import_m3u(self):
        """Импорт плейлиста из M3U файла."""
        if not self.playlists:
            self._toast("Сначала создайте плейлист")
            return
        try:
            from tkinter import filedialog
            path = filedialog.askopenfilename(
                filetypes=[("M3U файлы", "*.m3u"), ("Все файлы", "*.*")],
                title="Импорт M3U"
            )
            if not path:
                return
            base_dir = os.path.dirname(os.path.abspath(path))
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            entries = []
            current_title = ""
            for line in lines:
                line = line.strip()
                if line.startswith("#EXTINF:"):
                    parts = line.split(",", 1)
                    if len(parts) > 1:
                        current_title = parts[1].strip()
                elif line and not line.startswith("#"):
                    url = line
                    # Resolve relative paths
                    if not url.startswith(('http://', 'https://', 'ftp://')) and not url.startswith('/'):
                        abs_path = os.path.normpath(os.path.join(base_dir, url))
                        if os.path.isfile(abs_path):
                            url = abs_path
                    entries.append({"title": current_title, "url": url})
                    current_title = ""

            if not entries:
                self._toast("Файл M3U пуст или некорректен")
                return

            self.executor.submit(self._bg_import_m3u, entries)
        except Exception as e:
            log.error("M3U import failed: %s", e)
            self._toast(f"Ошибка: {str(e)[:50]}")

    def _bg_import_m3u(self, entries):
        """Фоновый импорт M3U записей."""
        added = 0
        for entry in entries:
            url = entry.get("url", "")
            title = entry.get("title", "")
            if not url:
                continue
            yt_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})', url)
            if yt_match:
                vid = yt_match.group(1)
                search_q = title if title else vid
                if self.ytmusic:
                    try:
                        results = self.ytmusic.search(search_q, limit=1)
                        if results:
                            self._m3u_import_track(results[0])
                            added += 1
                            continue
                    except Exception:
                        pass
            if title and self.ytmusic:
                try:
                    results = self._api_search(title, limit=1)
                    if results:
                        self._m3u_import_track(results[0])
                        added += 1
                except Exception:
                    pass

        def _done():
            if added > 0:
                self._toast(f"✅ Импортировано: {added} треков из M3U")
            else:
                self._toast("Не удалось импортировать треки из M3U")
        self.after(0, _done)

    def _m3u_import_track(self, track):
        """Добавить трек из M3U в первый плейлист (или создать 'Imported')."""
        with self._lock_playlists:
            if not self.playlists:
                self.playlists["Imported"] = []
            target = list(self.playlists.keys())[0]
            vid = track.get("videoId")
            if vid and any(t.get("videoId") == vid for t in self.playlists.get(target, [])):
                return
            self.playlists.setdefault(target, []).append(track)


if __name__ == "__main__":
    log.info("Starting mq Music Player v2.3...")
    app = MusicPlayer()
    log.info("Player initialized successfully")
    app.mainloop()
    log.info("Player shutdown")
