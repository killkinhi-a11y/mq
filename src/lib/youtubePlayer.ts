"use client";

/**
 * YouTube IFrame API wrapper — singleton.
 * Manages a hidden YouTube player for full-track audio playback.
 */

export type PlayerState =
  | "unstarted"
  | "ended"
  | "playing"
  | "paused"
  | "buffering"
  | "cued";

export interface PlayerCallbacks {
  onReady?: () => void;
  onStateChange?: (state: PlayerState) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onError?: (errorCode: number) => void;
}

// YouTube IFrame API types (loaded externally at runtime)
type YTPlayer = any;
type YTLib = any;

class YouTubePlayer {
  private player: YTPlayer | null = null;
  private container: HTMLElement | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private apiReady = false;
  private apiReadyResolvers: (() => void)[] = [];
  private callbacks: PlayerCallbacks = {};
  private scriptLoading = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadYouTubeAPI();
    }
  }

  // ── API loading ──────────────────────────────────────────
  private loadYouTubeAPI() {
    const w = window as Record<string, unknown>;

    // Already loaded?
    if (w.YT && typeof (w.YT as YTLib).Player === "function") {
      this.apiReady = true;
      return;
    }

    // Callback when API is ready
    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {
        this.apiReady = true;
        this.apiReadyResolvers.forEach((r) => r());
        this.apiReadyResolvers = [];
      };
    } else {
      // Something else already set the callback — wrap it
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        this.apiReady = true;
        this.apiReadyResolvers.forEach((r) => r());
        this.apiReadyResolvers = [];
      };
    }

    // Load the script
    if (!this.scriptLoading) {
      this.scriptLoading = true;
      const existing = document.querySelector(
        'script[src*="youtube.com/iframe_api"]'
      );
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }

  private waitForAPI(): Promise<void> {
    if (this.apiReady) return Promise.resolve();
    return new Promise((resolve) => {
      this.apiReadyResolvers.push(resolve);
    });
  }

  // ── Public API ───────────────────────────────────────────

  setContainer(el: HTMLElement) {
    this.container = el;
  }

  setCallbacks(cb: PlayerCallbacks) {
    this.callbacks = cb;
  }

  /**
   * Load a video by YouTube videoId.
   * Returns true if loaded successfully, false on error.
   */
  async loadVideo(videoId: string, autoplay = true): Promise<boolean> {
    await this.waitForAPI();
    if (!this.container) return false;

    this.destroy();

    this.container.innerHTML = "";

    const YT = (window as Record<string, unknown>).YT as YTLib;
    if (!YT?.Player) return false;

    return new Promise<boolean>((resolve) => {
      try {
        this.player = new YT.Player(this.container, {
          width: "1",
          height: "1",
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3, // hide annotations
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.startProgressTracking();
              this.callbacks.onReady?.();
              resolve(true);
            },
            onStateChange: (event: { data: number }) => {
              const state = this.mapState(event.data);
              this.callbacks.onStateChange?.(state);

              if (state === "playing") this.startProgressTracking();
              else if (state === "paused" || state === "ended")
                this.stopProgressTracking();
            },
            onError: (event: { data: number }) => {
              console.error("[YT Player] error code:", event.data);
              this.stopProgressTracking();
              this.callbacks.onError?.(event.data);
              resolve(false);
            },
          },
        });
      } catch (err) {
        console.error("[YT Player] failed to create:", err);
        resolve(false);
      }
    });
  }

  play() {
    this.player?.playVideo();
  }

  pause() {
    this.player?.pauseVideo();
  }

  seekTo(seconds: number) {
    this.player?.seekTo(seconds, true);
  }

  setVolume(percent: number) {
    this.player?.setVolume(Math.round(percent));
  }

  getCurrentTime(): number {
    try {
      return this.player?.getCurrentTime() ?? 0;
    } catch {
      return 0;
    }
  }

  getDuration(): number {
    try {
      const d = this.player?.getDuration();
      return d && isFinite(d) ? d : 0;
    } catch {
      return 0;
    }
  }

  isPlaying(): boolean {
    try {
      const YT = (window as Record<string, unknown>).YT as YTLib;
      return (
        !!this.player &&
        !!YT?.PlayerState &&
        this.player.getPlayerState() === YT.PlayerState.PLAYING
      );
    } catch {
      return false;
    }
  }

  isReady(): boolean {
    return !!this.player;
  }

  destroy() {
    this.stopProgressTracking();
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        /* ignore */
      }
      this.player = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  // ── Internal ─────────────────────────────────────────────

  private mapState(num: number): PlayerState {
    try {
      const YT = (window as Record<string, unknown>).YT as YTLib;
      const S = YT?.PlayerState;
      if (!S) return "unstarted";
      if (num === S.UNSTARTED) return "unstarted";
      if (num === S.ENDED) return "ended";
      if (num === S.PLAYING) return "playing";
      if (num === S.PAUSED) return "paused";
      if (num === S.BUFFERING) return "buffering";
      if (num === S.CUED) return "cued";
    } catch {
      /* ignore */
    }
    return "unstarted";
  }

  private startProgressTracking() {
    this.stopProgressTracking();
    this.progressTimer = setInterval(() => {
      if (this.isPlaying()) {
        const t = this.getCurrentTime();
        const d = this.getDuration();
        if (d > 0) this.callbacks.onProgress?.(t, d);
      }
    }, 250);
  }

  private stopProgressTracking() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────
let instance: YouTubePlayer | null = null;

export function getYouTubePlayer(): YouTubePlayer {
  if (!instance) instance = new YouTubePlayer();
  return instance;
}

// ── Global type shim ───────────────────────────────────────
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}
