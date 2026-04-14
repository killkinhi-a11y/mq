"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1,
  Shuffle, Music, Loader2, Moon, Clock, X, PictureInPicture2
} from "lucide-react";
import { formatDuration } from "@/lib/musicApi";

export default function PlayerBar() {
  const {
    currentTrack, isPlaying, volume, progress, duration,
    shuffle, repeat, togglePlay, nextTrack, prevTrack,
    setVolume, setProgress, setDuration, toggleShuffle, toggleRepeat,
    animationsEnabled, sleepTimerActive, sleepTimerRemaining,
    startSleepTimer, stopSleepTimer, updateSleepTimer,
    setFullTrackViewOpen, setPiPActive, isPiPActive,
    setPlaybackMode, playbackMode,
  } = useAppStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [playError, setPlayError] = useState(false);

  // Stable refs
  const nextTrackRef = useRef(nextTrack);
  const setProgressRef = useRef(setProgress);
  const setDurationRef = useRef(setDuration);
  const currentTrackRef = useRef(currentTrack);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { nextTrackRef.current = nextTrack; }, [nextTrack]);
  useEffect(() => { setProgressRef.current = setProgress; }, [setProgress]);
  useEffect(() => { setDurationRef.current = setDuration; }, [setDuration]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Sleep timer ──────────────────────────────────────────
  useEffect(() => {
    if (!sleepTimerActive) return;
    const interval = setInterval(updateSleepTimer, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerActive, updateSleepTimer]);

  // ── HTML5 Audio init (once) ────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!isDragging) {
        setProgressRef.current(audio.currentTime);
      }
    };

    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDurationRef.current(audio.duration);
      }
    };

    const onEnded = () => {
      setPlayError(false);
      const st = useAppStore.getState();
      if (st.repeat === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setProgressRef.current(0);
      } else {
        nextTrackRef.current();
      }
    };

    const onError = () => {
      console.warn("[PlayerBar] Audio error");
      setPlayError(true);
      setIsLoadingTrack(false);
    };

    const onCanPlay = () => {
      setIsLoadingTrack(false);
      setPlayError(false);
      if (isPlayingRef.current) {
        audio.play().catch(() => {
          useAppStore.getState().togglePlay();
        });
      }
    };

    const onPlaying = () => {
      setIsLoadingTrack(false);
      setPlayError(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("playing", onPlaying);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlaying);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // ── Handle track change ─────────────────────────────────
  const prevTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setPlaybackMode("idle");
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack.id !== prevTrackIdRef.current) {
      prevTrackIdRef.current = currentTrack.id;
      setProgress(0);
    }

    const loadAndPlay = async () => {
      setIsLoadingTrack(true);
      setPlayError(false);
      audio.pause();
      audio.src = "";

      // Determine audio source
      let audioSrc = "";

      if (currentTrack.audioUrl) {
        audioSrc = currentTrack.audioUrl;
      } else if (currentTrack.previewUrl) {
        audioSrc = currentTrack.previewUrl;
      }

      if (!audioSrc) {
        setIsLoadingTrack(false);
        setPlayError(true);
        return;
      }

      // Determine source type
      if (audioSrc.includes("audius")) {
        setPlaybackMode("audius");
      } else if (audioSrc.includes("itunes") || audioSrc.includes("apple")) {
        setPlaybackMode("itunes");
      } else {
        setPlaybackMode("audius");
      }

      try {
        audio.src = audioSrc;
        audio.load();

        const playPromise = audio.play();
        if (playPromise) await playPromise;
      } catch (err) {
        console.warn("[PlayerBar] Play failed:", err);

        // If primary source fails, try preview
        if (currentTrack.previewUrl && currentTrack.previewUrl !== audioSrc) {
          try {
            audio.src = currentTrack.previewUrl;
            audio.load();
            setPlaybackMode("itunes");
            await audio.play();
          } catch {
            setPlayError(true);
          }
        } else {
          setPlayError(true);
        }
      }
      setIsLoadingTrack(false);
    };

    loadAndPlay();
  }, [currentTrack?.id]);

  // ── Handle play/pause ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src || audio.readyState < 2) return;

    if (isPlaying) {
      audio.play().catch(() => {
        useAppStore.getState().togglePlay();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Handle volume ───────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  // ── Progress drag/seek ──────────────────────────────────
  const seekToPosition = useCallback((clientX: number) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const newTime = pct * duration;
    setProgress(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  }, [duration, setProgress]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    seekToPosition(e.clientX);
    const onMove = (ev: MouseEvent) => seekToPosition(ev.clientX);
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [seekToPosition]);

  const handleProgressTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    seekToPosition(e.touches[0].clientX);
    const onMove = (ev: TouchEvent) => {
      ev.preventDefault();
      seekToPosition(ev.touches[0].clientX);
    };
    const onEnd = () => {
      setIsDragging(false);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }, [seekToPosition]);

  // ── Volume click ────────────────────────────────────────
  const handleVolumeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setVolume(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }, [setVolume]);

  // ── Sleep timer ─────────────────────────────────────────
  const sleepMin = Math.floor(sleepTimerRemaining / 60);
  const sleepSec = sleepTimerRemaining % 60;

  // ── Render ──────────────────────────────────────────────
  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  const modeLabel = (() => {
    if (isLoadingTrack) return null;
    if (playbackMode === "audius") {
      return (
        <span style={{ color: "#4ade80", marginLeft: 6, fontSize: 10 }}>
          &#9679; Полный трек
        </span>
      );
    }
    if (playbackMode === "itunes") {
      return (
        <span style={{ color: "var(--mq-text-muted)", marginLeft: 6, fontSize: 10 }}>
          Превью 30с
        </span>
      );
    }
    return null;
  })();

  const sourceTag = currentTrack.source === "audius" ? "Audius"
    : currentTrack.source === "itunes" ? "iTunes"
    : currentTrack.source === "deezer" ? "Deezer"
    : currentTrack.source === "saavn" ? "Saavn"
    : "";

  return (
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
      {/* Progress bar */}
      <div
        ref={progressRef}
        onMouseDown={handleProgressMouseDown}
        onTouchStart={handleProgressTouchStart}
        className="w-full h-1.5 cursor-pointer group relative"
        style={{ backgroundColor: "var(--mq-border)" }}
      >
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${progressPct}%`,
            backgroundColor: playError ? "#ef4444" : "var(--mq-accent)",
            boxShadow: "0 0 8px var(--mq-glow)",
          }}
        />
        <div
          className="absolute top-1/2 w-3 h-3 rounded-full transition-opacity sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
          style={{
            left: `${progressPct}%`,
            backgroundColor: playError ? "#ef4444" : "var(--mq-accent)",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 6px var(--mq-glow)",
          }}
        />
        <div className="absolute top-full left-1 text-[9px] mt-0.5 hidden sm:block" style={{ color: "var(--mq-text-muted)" }}>
          {formatDuration(Math.floor(progress))}
        </div>
        <div className="absolute top-full right-1 text-[9px] mt-0.5 hidden sm:block" style={{ color: "var(--mq-text-muted)" }}>
          {formatDuration(Math.floor(duration))}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 lg:px-6 lg:py-3 max-w-screen-2xl mx-auto">
        {/* Track info */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => setFullTrackViewOpen(true)}
        >
          {currentTrack.cover ? (
            <img src={currentTrack.cover} alt={currentTrack.album} className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: "var(--mq-accent)", opacity: 0.5 }}>
              <Music className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--mq-text)" }}>{currentTrack.title}</p>
            <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
              {currentTrack.artist}
              {sourceTag && (
                <span className="ml-1.5 px-1.5 py-0 rounded text-[9px]" style={{ backgroundColor: "var(--mq-card)", opacity: 0.8 }}>{sourceTag}</span>
              )}
              {modeLabel}
              {playError && (
                <span className="ml-1.5 px-1.5 py-0 rounded text-[9px]" style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
                  Ошибка
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 lg:gap-4 mx-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleShuffle} className="hidden sm:block p-2"
            style={{ color: shuffle ? "var(--mq-accent)" : "var(--mq-text-muted)" }}>
            <Shuffle className="w-4 h-4" />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevTrack}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: "var(--mq-text)" }}>
            <SkipBack className="w-5 h-5" />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.85 }} onClick={togglePlay}
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)", boxShadow: isPlaying ? "0 0 20px var(--mq-glow)" : "none" }}>
            <AnimatePresence mode="wait">
              {isLoadingTrack ? (
                <motion.div key="loading" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </motion.div>
              ) : isPlaying ? (
                <motion.div key="pause" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }}>
                  <Pause className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }}>
                  <Play className="w-5 h-5 ml-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextTrack}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: "var(--mq-text)" }}>
            <SkipForward className="w-5 h-5" />
          </motion.button>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleRepeat} className="hidden sm:block p-2"
            style={{ color: repeat !== "off" ? "var(--mq-accent)" : "var(--mq-text-muted)" }}>
            {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </motion.button>
        </div>

        {/* Volume + extras */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="text-xs hidden lg:block" style={{ color: "var(--mq-text-muted)" }}>
            {formatDuration(Math.floor(progress))} / {formatDuration(Math.floor(duration))}
          </span>

          {/* Sleep timer */}
          <div className="relative">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSleepTimer(!showSleepTimer)}
              className="relative p-2 hidden sm:block" style={{ color: sleepTimerActive ? "var(--mq-accent)" : "var(--mq-text-muted)" }}>
              <Moon className="w-4 h-4" />
              {sleepTimerActive && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full text-[8px] flex items-center justify-center px-0.5"
                  style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                  {sleepMin}:{sleepSec.toString().padStart(2, "0")}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {showSleepTimer && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 p-3 rounded-xl w-48 z-50 shadow-lg"
                  style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
                  {sleepTimerActive ? (
                    <div className="space-y-2">
                      <p className="text-xs text-center font-mono" style={{ color: "var(--mq-accent)" }}>
                        {sleepMin}:{sleepSec.toString().padStart(2, "0")}
                      </p>
                      <button onClick={() => { stopSleepTimer(); setShowSleepTimer(false); }}
                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs"
                        style={{ backgroundColor: "rgba(224,49,49,0.15)", color: "#ff6b6b" }}>
                        <X className="w-3 h-3" /> Отменить
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[15, 30, 45, 60].map((m) => (
                        <button key={m} onClick={() => { startSleepTimer(m); setShowSleepTimer(false); }}
                          className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs"
                          style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}>
                          <Clock className="w-3 h-3" /> {m} мин
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* PiP */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPiPActive(!isPiPActive)}
            className="p-2 hidden sm:block" style={{ color: isPiPActive ? "var(--mq-accent)" : "var(--mq-text-muted)" }}>
            <PictureInPicture2 className="w-4 h-4" />
          </motion.button>

          <button onClick={() => setVolume(volume > 0 ? 0 : 70)} className="hidden md:block" style={{ color: "var(--mq-text-muted)" }}>
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div ref={volumeRef} onClick={handleVolumeClick} className="hidden md:block w-20 h-1.5 rounded-full cursor-pointer"
            style={{ backgroundColor: "var(--mq-border)" }}>
            <div className="h-full rounded-full" style={{ width: `${volume}%`, backgroundColor: "var(--mq-accent)" }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
