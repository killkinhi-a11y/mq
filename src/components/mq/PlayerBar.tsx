"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1, Shuffle, Music, Loader2
} from "lucide-react";
import { formatDuration } from "@/lib/musicApi";

type PlaybackMode = "piped" | "youtube" | "itunes" | "idle";

export default function PlayerBar() {
  const {
    currentTrack, isPlaying, volume, progress, duration,
    shuffle, repeat, togglePlay, nextTrack, prevTrack,
    setVolume, setProgress, setDuration, toggleShuffle, toggleRepeat,
    setView, animationsEnabled,
  } = useAppStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // HTML5 Audio — primary player
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // YouTube IFrame fallback (kept for videos where Piped fails)
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<ReturnType<typeof import("@/lib/youtubePlayer").getYouTubePlayer> | null>(null);
  const ytReadyRef = useRef(false);
  const ytInitRef = useRef(false);

  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("idle");
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  // Track data cache (in-memory, survives component re-renders)
  const trackDataCacheRef = useRef<Map<string, { videoId: string; audioUrl: string | null }>>(new Map());

  // Stable refs for callbacks
  const nextTrackRef = useRef(nextTrack);
  const setProgressRef = useRef(setProgress);
  const setDurationRef = useRef(setDuration);
  const currentTrackRef = useRef(currentTrack);
  useEffect(() => { nextTrackRef.current = nextTrack; }, [nextTrack]);
  useEffect(() => { setProgressRef.current = setProgress; }, [setProgress]);
  useEffect(() => { setDurationRef.current = setDuration; }, [setDuration]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // ── HTML5 Audio init ────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    audioRef.current.crossOrigin = "anonymous";
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // HTML5 Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isDragging && (playbackMode === "itunes" || playbackMode === "piped")) {
        setProgressRef.current(audio.currentTime);
      }
    };
    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDurationRef.current(audio.duration);
      }
    };
    const onEnded = () => {
      if (playbackMode === "itunes" || playbackMode === "piped") {
        const state = useAppStore.getState();
        if (state.repeat === "one") {
          audio.currentTime = 0;
          audio.play().catch(() => {});
          setProgressRef.current(0);
        } else {
          nextTrackRef.current();
        }
      }
    };
    const onError = () => {
      // If Piped audio fails, fall back to iTunes preview
      if (playbackMode === "piped") {
        console.warn("[PlayerBar] Piped audio stream failed, falling back to iTunes preview");
        const track = currentTrackRef.current;
        if (track?.audioUrl && audioRef.current) {
          audio.src = track.audioUrl;
          audio.load();
          if (useAppStore.getState().isPlaying) {
            audio.play().catch(() => {});
          }
        }
        setPlaybackMode("itunes");
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("canplay", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("canplay", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [isDragging, playbackMode]);

  // ── Lazy YouTube player init (only when needed as fallback) ──
  const initYouTubePlayer = useCallback(async () => {
    if (ytInitRef.current) return;
    ytInitRef.current = true;

    try {
      const mod = await import("@/lib/youtubePlayer");
      const yt = mod.getYouTubePlayer();

      ytPlayerRef.current = yt;

      yt.setCallbacks({
        onStateChange: (state) => {
          switch (state) {
            case "playing":
              if (!useAppStore.getState().isPlaying) {
                useAppStore.setState({ isPlaying: true });
              }
              break;
            case "paused":
              if (useAppStore.getState().isPlaying) {
                useAppStore.setState({ isPlaying: false });
              }
              break;
            case "ended":
              useAppStore.setState({ isPlaying: false });
              const st = useAppStore.getState();
              if (st.repeat === "one") {
                yt.seekTo(0);
                yt.play();
                setProgressRef.current(0);
              } else {
                nextTrackRef.current();
              }
              break;
          }
        },
        onProgress: (currentTime: number, dur: number) => {
          if (!isDragging) {
            setProgressRef.current(currentTime);
          }
          if (dur > 0 && Math.abs(useAppStore.getState().duration - dur) > 1) {
            setDurationRef.current(dur);
          }
        },
        onError: () => {
          // Fall back to iTunes preview on YouTube error
          console.warn("[PlayerBar] YouTube IFrame failed, falling back to iTunes preview");
          const track = currentTrackRef.current;
          const audio = audioRef.current;
          if (track?.audioUrl && audio) {
            setPlaybackMode("itunes");
            audio.src = track.audioUrl;
            audio.load();
            if (useAppStore.getState().isPlaying) {
              audio.play().catch(() => {});
            }
          }
        },
      });

      if (ytContainerRef.current) {
        yt.setContainer(ytContainerRef.current);
      }
    } catch (err) {
      console.warn("[PlayerBar] Failed to init YouTube player:", err);
    }
  }, [isDragging]);

  // ── Fetch track data from our API (videoId + audioUrl) ──
  const fetchTrackData = useCallback(
    async (track: typeof currentTrack) => {
      if (!track) return null;

      const query = `${track.artist} ${track.title}`;

      // Check local cache first
      const cached = trackDataCacheRef.current.get(query.toLowerCase());
      if (cached) {
        return cached;
      }

      try {
        const res = await fetch(
          `/api/music/youtube?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) return null;
        const data = await res.json();

        const result = {
          videoId: data.videoId || null,
          audioUrl: data.audioUrl || null,
        };

        if (result.videoId) {
          trackDataCacheRef.current.set(query.toLowerCase(), result);
        }

        return result;
      } catch {
        return null;
      }
    },
    []
  );

  // ── Handle track change ─────────────────────────────────
  const prevTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setPlaybackMode("idle");
      return;
    }

    // Reset on new track
    if (currentTrack.id !== prevTrackIdRef.current) {
      prevTrackIdRef.current = currentTrack.id;
      setProgress(0);
    }

    const playTrack = async () => {
      setIsLoadingTrack(true);
      setPlaybackMode("idle");

      // Stop current playback
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }

      try {
        // Fetch track data (videoId + Piped audioUrl)
        const data = await fetchTrackData(currentTrack);

        if (data?.audioUrl && audio) {
          // Priority 1: Piped audio stream — full track via HTML5 Audio
          audio.src = data.audioUrl;
          audio.crossOrigin = "anonymous";
          audio.load();

          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch(() => {
              // Autoplay blocked or stream failed — fall through
            });
          }

          setPlaybackMode("piped");
          setIsLoadingTrack(false);
          return;
        }

        if (data?.videoId) {
          // Priority 2: YouTube IFrame fallback (init lazily)
          try {
            if (!ytInitRef.current) {
              await initYouTubePlayer();
            }

            const yt = ytPlayerRef.current;
            if (yt && ytContainerRef.current) {
              yt.setContainer(ytContainerRef.current);
              const loaded = await yt.loadVideo(data.videoId, true);
              if (loaded) {
                setPlaybackMode("youtube");
                ytReadyRef.current = true;
                setIsLoadingTrack(false);
                return;
              }
            }
          } catch {
            // YouTube IFrame failed, continue to iTunes
          }
        }
      } catch {
        // Fetch or playback failed, fall through to iTunes
      }

      // Priority 3: iTunes 30s preview
      if (currentTrack.audioUrl && audio) {
        setPlaybackMode("itunes");
        audio.src = currentTrack.audioUrl;
        audio.crossOrigin = "anonymous";
        audio.load();
        if (useAppStore.getState().isPlaying) {
          audio.play().catch(() => {
            useAppStore.getState().togglePlay();
          });
        }
      }

      setIsLoadingTrack(false);
    };

    playTrack();
  }, [currentTrack?.id]); // only react to track ID changes

  // ── Handle play/pause ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const yt = ytPlayerRef.current;

    if (playbackMode === "youtube" && yt) {
      if (isPlaying) yt.play();
      else yt.pause();
    } else if ((playbackMode === "itunes" || playbackMode === "piped") && audio) {
      if (isPlaying) {
        audio.play().catch(() => {
          useAppStore.getState().togglePlay();
        });
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, playbackMode, currentTrack]);

  // ── Handle volume ───────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const yt = ytPlayerRef.current;

    if (playbackMode === "youtube" && yt) {
      yt.setVolume(volume);
    } else if (audio) {
      audio.volume = volume / 100;
    }
  }, [volume, playbackMode]);

  // ── Progress click (seek) ───────────────────────────────
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;

      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const newTime = pct * duration;
      setProgress(newTime);

      const yt = ytPlayerRef.current;
      const audio = audioRef.current;

      if (playbackMode === "youtube" && yt) {
        yt.seekTo(newTime);
      } else if (audio) {
        audio.currentTime = newTime;
      }
    },
    [duration, setProgress, playbackMode]
  );

  // ── Volume click ────────────────────────────────────────
  const handleVolumeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!volumeRef.current) return;
      const rect = volumeRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setVolume(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    },
    [setVolume]
  );

  // ── Render ──────────────────────────────────────────────
  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;
  const showLoading = isLoadingTrack;

  const modeLabel = (() => {
    if (showLoading) return null;
    if (playbackMode === "piped" || playbackMode === "youtube") {
      return (
        <span
          style={{
            color: "var(--mq-accent)",
            marginLeft: 6,
            fontSize: 10,
          }}
        >
          &#9679; Full
        </span>
      );
    }
    if (playbackMode === "itunes") {
      return (
        <span
          style={{
            color: "var(--mq-text-muted)",
            marginLeft: 6,
            fontSize: 10,
          }}
        >
          30s preview
        </span>
      );
    }
    return null;
  })();

  return (
    <>
      {/* Hidden YouTube player container (only used as fallback) */}
      <div
        ref={ytContainerRef}
        style={{
          position: "fixed",
          top: -100,
          left: -100,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      <motion.div
        initial={animationsEnabled ? { y: 100 } : undefined}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="fixed left-0 right-0 z-40 lg:bottom-0 bottom-[56px]"
        style={{
          backgroundColor: "var(--mq-player-bg)",
          borderTop: "1px solid var(--mq-border)",
        }}
      >
        {/* Progress bar on top */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          className="w-full h-1.5 cursor-pointer group relative"
          style={{ backgroundColor: "var(--mq-border)" }}
        >
          <div
            className="h-full transition-all duration-100"
            style={{
              width: `${progressPct}%`,
              backgroundColor: "var(--mq-accent)",
              boxShadow: "0 0 8px var(--mq-glow)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              left: `${progressPct}%`,
              backgroundColor: "var(--mq-accent)",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 6px var(--mq-glow)",
            }}
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2 lg:px-6 lg:py-3 max-w-screen-2xl mx-auto">
          {/* Track info */}
          <div
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            onClick={() => setView("main")}
          >
            {currentTrack.cover ? (
              <img
                src={currentTrack.cover}
                alt={currentTrack.album}
                className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: "var(--mq-accent)",
                  opacity: 0.5,
                }}
              >
                <Music className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
              </div>
            )}
            <div className="min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--mq-text)" }}
              >
                {currentTrack.title}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--mq-text-muted)" }}
              >
                {currentTrack.artist}
                {modeLabel}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 lg:gap-4 mx-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleShuffle}
              className="hidden sm:block p-2"
              style={{
                color: shuffle
                  ? "var(--mq-accent)"
                  : "var(--mq-text-muted)",
              }}
            >
              <Shuffle className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={prevTrack}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ color: "var(--mq-text)" }}
            >
              <SkipBack className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.85 }}
              onClick={togglePlay}
              disabled={showLoading}
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "var(--mq-accent)",
                color: "var(--mq-text)",
                boxShadow: isPlaying
                  ? "0 0 20px var(--mq-glow)"
                  : "none",
              }}
            >
              <AnimatePresence mode="wait">
                {showLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </motion.div>
                ) : isPlaying ? (
                  <motion.div
                    key="pause"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                  >
                    <Pause className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                  >
                    <Play className="w-5 h-5 ml-0.5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={nextTrack}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ color: "var(--mq-text)" }}
            >
              <SkipForward className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleRepeat}
              className="hidden sm:block p-2"
              style={{
                color: repeat !== "off"
                  ? "var(--mq-accent)"
                  : "var(--mq-text-muted)",
              }}
            >
              {repeat === "one" ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </motion.button>
          </div>

          {/* Volume + Time */}
          <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
            <span
              className="text-xs hidden lg:block"
              style={{ color: "var(--mq-text-muted)" }}
            >
              {formatDuration(Math.floor(progress))} /{" "}
              {formatDuration(Math.floor(duration))}
            </span>
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 70)}
              className="hidden md:block"
              style={{ color: "var(--mq-text-muted)" }}
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div
              ref={volumeRef}
              onClick={handleVolumeClick}
              className="hidden md:block w-20 h-1.5 rounded-full cursor-pointer"
              style={{ backgroundColor: "var(--mq-border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${volume}%`,
                  backgroundColor: "var(--mq-accent)",
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
