"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1,
  Shuffle, Music, Loader2, Moon, Clock, X, PictureInPicture2, ListMusic
} from "lucide-react";
import { formatDuration } from "@/lib/musicApi";
import { getAudioElement, initAudioEngine, getAnalyser, resumeAudioContext, getFrequencyData } from "@/lib/audioEngine";

async function resolveSoundCloudStream(scTrackId: number): Promise<{ url: string; isPreview: boolean; duration: number; fullDuration: number } | null> {
  try {
    const res = await fetch(`/api/music/soundcloud/stream?trackId=${scTrackId}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function PlayerBar() {
  const {
    currentTrack, isPlaying, volume, progress, duration,
    shuffle, repeat, togglePlay, nextTrack, prevTrack,
    setVolume, setProgress, setDuration, toggleShuffle, toggleRepeat,
    animationsEnabled, sleepTimerActive, sleepTimerRemaining,
    startSleepTimer, stopSleepTimer, updateSleepTimer,
    setFullTrackViewOpen, setPiPActive, isPiPActive,
    setPlaybackMode, requestShowSimilar,
  } = useAppStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [playError, setPlayError] = useState(false);

  const nextTrackRef = useRef(nextTrack);
  const setProgressRef = useRef(setProgress);
  const setDurationRef = useRef(setDuration);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { nextTrackRef.current = nextTrack; }, [nextTrack]);
  useEffect(() => { setProgressRef.current = setProgress; }, [setProgress]);
  useEffect(() => { setDurationRef.current = setDuration; }, [setDuration]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Audio element + Web Audio init (shared engine) ──
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = getAudioElement();
    audioRef.current = audio;

    initAudioEngine(audio);

    const onTimeUpdate = () => {
      if (!isDragging) setProgressRef.current(audio.currentTime);
    };
    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration)) setDurationRef.current(audio.duration);
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
      setPlayError(true);
      setIsLoadingTrack(false);
    };
    const onCanPlay = () => {
      setIsLoadingTrack(false);
      setPlayError(false);
      resumeAudioContext();
      if (isPlayingRef.current) {
        audio.play().catch(() => useAppStore.getState().togglePlay());
      }
    };
    const onPlaying = () => {
      setIsLoadingTrack(false);
      setPlayError(false);
      resumeAudioContext();
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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── Audio Visualization — Waveform style ──────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = getAnalyser();
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      getFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const pointCount = 64;
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--mq-accent").trim() || "#e03131";

      // Parse accent color
      let r = 224, g = 49, b = 49;
      if (accentColor.startsWith("#") && accentColor.length >= 7) {
        r = parseInt(accentColor.slice(1, 3), 16);
        g = parseInt(accentColor.slice(3, 5), 16);
        b = parseInt(accentColor.slice(5, 7), 16);
      }

      // Build data points
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < pointCount; i++) {
        const dataIndex = Math.floor(i * bufferLength / pointCount);
        const value = dataArray[dataIndex] / 255;
        const x = (i / (pointCount - 1)) * displayWidth;
        const y = displayHeight - Math.max(2, value * displayHeight * 0.85);
        points.push({ x, y });
      }

      // Draw gradient fill under the curve
      const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
      gradient.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0.0)`);

      ctx.beginPath();
      ctx.moveTo(points[0].x, displayHeight);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currPoint = points[i];
        const cpx = (prevPoint.x + currPoint.x) / 2;
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpx, (prevPoint.y + currPoint.y) / 2);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(displayWidth, displayHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.6;
      ctx.fill();

      // Draw the curve line on top
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currPoint = points[i];
        const cpx = (prevPoint.x + currPoint.x) / 2;
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpx, (prevPoint.y + currPoint.y) / 2);
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    draw();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentTrack?.id]); // re-setup when track changes

  // ── Sleep timer ──────────────────────────────────────────
  useEffect(() => {
    if (!sleepTimerActive) return;
    const interval = setInterval(updateSleepTimer, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerActive, updateSleepTimer]);

  // ── Play SoundCloud track ───────────────────────────────
  const playWithSoundCloud = useCallback(async (scTrackId: number, track?: typeof currentTrack) => {
    const t = track || useAppStore.getState().currentTrack;
    if (!t) return;

    const audio = audioRef.current || getAudioElement();
    if (!audio) return;

    setPlaybackMode("soundcloud");

    const stream = await resolveSoundCloudStream(scTrackId);
    if (!stream || !stream.url) {
      setPlayError(true);
      setIsLoadingTrack(false);
      return;
    }

    const audioEl = getAudioElement();
    audioEl.pause();
    audioEl.src = stream.url;
    audioEl.load();
    audioEl.play().catch(() => {
      setPlayError(true);
      setIsLoadingTrack(false);
    });
  }, [setPlaybackMode]);

  // ── Handle track change ─────────────────────────────────
  const prevTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setPlaybackMode("idle");
      return;
    }

    const audio = audioRef.current || getAudioElement();
    if (!audio) return;

    if (currentTrack.id !== prevTrackIdRef.current) {
      prevTrackIdRef.current = currentTrack.id;
      setProgress(0);
    }

    const loadTrack = async () => {
      setIsLoadingTrack(true);
      setPlayError(false);

      const audioEl = getAudioElement();
      audioEl.pause();
      audioEl.src = "";

      if (currentTrack.source === "soundcloud" && currentTrack.scTrackId) {
        await playWithSoundCloud(currentTrack.scTrackId, currentTrack);
      } else if (currentTrack.audioUrl) {
        setPlaybackMode("soundcloud");
        audioEl.src = currentTrack.audioUrl;
        audioEl.load();
        audioEl.play().catch(() => {
          setPlayError(true);
          setIsLoadingTrack(false);
        });
      } else {
        setPlayError(true);
        setIsLoadingTrack(false);
      }

      setIsLoadingTrack(false);
    };

    loadTrack();
  }, [currentTrack?.id]);

  // ── Handle play/pause ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current || getAudioElement();
    if (!audio || !audio.src || audio.readyState < 2) return;

    if (isPlaying) {
      resumeAudioContext();
      audio.play().catch(() => useAppStore.getState().togglePlay());
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Handle volume ───────────────────────────────────────
  useEffect(() => {
    getAudioElement().volume = volume / 100;
  }, [volume]);

  // ── Volume mouse wheel ──────────────────────────────────
  const handleVolumeWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    setVolume(Math.max(0, Math.min(100, volume + delta)));
  }, [volume, setVolume]);

  // ── Progress drag/seek ──────────────────────────────────
  const seekToPosition = useCallback((clientX: number) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const newTime = pct * duration;
    setProgress(newTime);

    const audio = getAudioElement();
    audio.currentTime = newTime;
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

  const sleepMin = Math.floor(sleepTimerRemaining / 60);
  const sleepSec = sleepTimerRemaining % 60;

  // ── Render ──────────────────────────────────────────────
  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  const modeLabel = (() => {
    if (isLoadingTrack) return null;
    if (currentTrack.scIsFull) {
      return <span style={{ color: "#ff5500", marginLeft: 6, fontSize: 10 }}>&#9654; Полный трек</span>;
    }
    return <span style={{ color: "var(--mq-text-muted)", marginLeft: 6, fontSize: 10 }}>Превью 30с</span>;
  })();

  return (
    <motion.div
      initial={animationsEnabled ? { y: 100 } : undefined}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed left-0 right-0 z-40 lg:bottom-0 bottom-[56px]"
      style={{ backgroundColor: "var(--mq-player-bg)", borderTop: "1px solid var(--mq-border)" }}
    >
      {/* Progress bar */}
      <div
        ref={progressRef}
        onMouseDown={handleProgressMouseDown}
        onTouchStart={handleProgressTouchStart}
        className="w-full h-1.5 cursor-pointer group relative"
        style={{ backgroundColor: "var(--mq-border)" }}
      >
        <div className="h-full transition-all duration-100" style={{
          width: `${progressPct}%`,
          backgroundColor: playError ? "#ef4444" : "var(--mq-accent)",
          boxShadow: "0 0 8px var(--mq-glow)",
        }} />
        <div className="absolute top-1/2 w-3 h-3 rounded-full transition-opacity sm:opacity-0 sm:group-hover:opacity-100 opacity-100" style={{
          left: `${progressPct}%`,
          backgroundColor: playError ? "#ef4444" : "var(--mq-accent)",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 6px var(--mq-glow)",
        }} />
        {/* Time text - always visible (not just sm:block) */}
        <div className="absolute top-full left-1 text-[9px] mt-0.5" style={{ color: "var(--mq-text-muted)" }}>
          {formatDuration(Math.floor(progress))}
        </div>
        <div className="absolute top-full right-1 text-[9px] mt-0.5" style={{ color: "var(--mq-text-muted)" }}>
          {formatDuration(Math.floor(duration))}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 lg:px-6 lg:py-3 max-w-screen-2xl mx-auto">
        {/* Track info */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setFullTrackViewOpen(true)}>
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
              {modeLabel}
              {playError && <span className="ml-1.5 px-1.5 py-0 rounded text-[9px]" style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#ef4444" }}>Ошибка</span>}
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

          {/* Похожие button - visible on desktop */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => requestShowSimilar()}
            className="p-2 hidden sm:block"
            style={{ color: "var(--mq-text-muted)" }}
            title="Похожие треки"
          >
            <ListMusic className="w-4 h-4" />
          </motion.button>

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
          <div
            ref={volumeRef}
            onClick={handleVolumeClick}
            onWheel={handleVolumeWheel}
            className="hidden md:block w-24 h-1.5 rounded-full cursor-pointer"
            style={{ backgroundColor: "var(--mq-border)" }}
          >
            <div className="h-full rounded-full" style={{ width: `${volume}%`, backgroundColor: "var(--mq-accent)" }} />
          </div>
          <span className="text-[10px] hidden md:block w-8 text-right" style={{ color: "var(--mq-text-muted)" }}>{volume}%</span>
        </div>
      </div>

      {/* Audio visualization waveform */}
      <canvas
        ref={canvasRef}
        className="w-full pointer-events-none"
        style={{ height: 32, opacity: isPlaying ? 0.6 : 0, transition: "opacity 0.3s" }}
      />
    </motion.div>
  );
}
