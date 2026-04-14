"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1,
  Shuffle, X, Heart, ThumbsDown, ListMusic, Music, ChevronLeft
} from "lucide-react";
import { formatDuration, searchTracks, type Track } from "@/lib/musicApi";
import TrackCard from "./TrackCard";
import { getAnalyser, getAudioElement, resumeAudioContext, getFrequencyData } from "@/lib/audioEngine";

export default function FullTrackView() {
  const {
    currentTrack, isPlaying, volume, progress, duration,
    shuffle, repeat, togglePlay, nextTrack, prevTrack,
    setVolume, setProgress, setDuration, toggleShuffle, toggleRepeat,
    isFullTrackViewOpen, setFullTrackViewOpen, animationsEnabled,
    toggleLike, toggleDislike, likedTrackIds, dislikedTrackIds,
    similarTracks, setSimilarTracks, similarTracksLoading, setSimilarTracksLoading,
    playTrack, queue, showSimilarRequested, clearShowSimilarRequest,
  } = useAppStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);
  const vizAnimRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);

  // Handle showSimilarRequested from store
  useEffect(() => {
    if (showSimilarRequested) {
      setShowSimilar(true);
      clearShowSimilarRequest();
    }
  }, [showSimilarRequested, clearShowSimilarRequest]);

  // Fetch similar tracks
  useEffect(() => {
    if (!currentTrack || !showSimilar) return;
    let cancelled = false;
    const fetchSimilar = async () => {
      setSimilarTracksLoading(true);
      try {
        const query = `${currentTrack.artist}`;
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&limit=8`);
        const data = await res.json();
        const tracks: Track[] = (data.tracks || []).filter((t: Track) => t.id !== currentTrack.id);
        if (!cancelled) setSimilarTracks(tracks.slice(0, 6));
      } catch {
        if (!cancelled) setSimilarTracks([]);
      } finally {
        if (!cancelled) setSimilarTracksLoading(false);
      }
    };
    fetchSimilar();
    return () => { cancelled = true; };
  }, [currentTrack, showSimilar, setSimilarTracks, setSimilarTracksLoading]);

  // Progress drag
  const seekToPosition = useCallback((clientX: number) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setProgress(pct * duration);
    const audio = getAudioElement();
    if (audio) audio.currentTime = pct * duration;
  }, [duration, setProgress]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    seekToPosition(e.clientX);
    const handleMouseMove = (ev: MouseEvent) => seekToPosition(ev.clientX);
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [seekToPosition]);

  const handleProgressTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    seekToPosition(e.touches[0].clientX);
    const handleTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      seekToPosition(ev.touches[0].clientX);
    };
    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  }, [seekToPosition]);

  const handleVolumeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setVolume(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }, [setVolume]);

  // Mouse wheel volume control
  const handleVolumeWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    setVolume(Math.max(0, Math.min(100, volume + delta)));
  }, [volume, setVolume]);

  // ── Circular audio visualization using shared analyser ──
  useEffect(() => {
    const canvas = vizCanvasRef.current;
    if (!canvas || !isFullTrackViewOpen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use shared analyser from audioEngine (created by PlayerBar)
    const analyser = getAnalyser();
    if (!analyser) return;

    resumeAudioContext();

    const draw = () => {
      vizAnimRef.current = requestAnimationFrame(draw);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      getFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      const size = canvas.clientWidth;
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const innerRadius = size * 0.32;
      const maxBarHeight = size * 0.15;
      const barCount = 64;
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--mq-accent").trim() || "#e03131";

      // Parse accent color
      let r = 224, g = 49, b = 49;
      if (accentColor.startsWith("#") && accentColor.length >= 7) {
        r = parseInt(accentColor.slice(1, 3), 16);
        g = parseInt(accentColor.slice(3, 5), 16);
        b = parseInt(accentColor.slice(5, 7), 16);
      }

      // Glow effect
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
      ctx.lineWidth = Math.max(2, (size / barCount) * 0.45);
      ctx.lineCap = "round";

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * bufferLength / barCount);
        const value = dataArray[dataIndex] / 255;
        const barHeight = Math.max(2, value * maxBarHeight);

        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;

        // Curved/wavy radial lines using adjacent values
        const prevIndex = (i - 1 + barCount) % barCount;
        const nextIndex = (i + 1) % barCount;
        const prevDataIndex = Math.floor(prevIndex * bufferLength / barCount);
        const nextDataIndex = Math.floor(nextIndex * bufferLength / barCount);
        const prevValue = dataArray[prevDataIndex] / 255;
        const nextValue = dataArray[nextDataIndex] / 255;

        const waveOffset = (prevValue - nextValue) * size * 0.01;

        const midAngle = angle;
        const midRadius = innerRadius + barHeight * 0.5;
        const perpAngle = midAngle + Math.PI / 2;
        const controlX = centerX + Math.cos(midAngle) * midRadius + Math.cos(perpAngle) * waveOffset;
        const controlY = centerY + Math.sin(midAngle) * midRadius + Math.sin(perpAngle) * waveOffset;

        const endAngle = angle;
        const endRadius = innerRadius + barHeight;
        const x2 = centerX + Math.cos(endAngle) * endRadius;
        const y2 = centerY + Math.sin(endAngle) * endRadius;

        // Color gradient based on position
        const mix = i / barCount;
        const cr = Math.round(r + (255 - r) * mix * 0.3);
        const cg = Math.round(g + (255 - g) * mix * 0.3);
        const cb = Math.round(b + (255 - b) * mix * 0.3);

        ctx.strokeStyle = `rgba(${cr},${cg},${cb},1)`;
        ctx.globalAlpha = 0.25 + value * 0.75;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(controlX, controlY, x2, y2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Inner glow ring — pulse with bass frequencies
      const bassValue = dataArray.slice(0, 4).reduce((sum, v) => sum + v, 0) / (4 * 255);
      ctx.globalAlpha = 0.05 + bassValue * 0.12;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2 + bassValue * 3;
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    draw();
    return () => {
      if (vizAnimRef.current) cancelAnimationFrame(vizAnimRef.current);
    };
  }, [isFullTrackViewOpen, currentTrack?.id, isPlaying]);

  if (!currentTrack || !isFullTrackViewOpen) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;
  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const isDisliked = currentTrack ? dislikedTrackIds.includes(currentTrack.id) : false;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col"
        style={{ backgroundColor: "var(--mq-bg)" }}
      >
        {/* Blurred background */}
        <div className="absolute inset-0 z-0" style={{ pointerEvents: "none" }}>
          {currentTrack.cover && (
            <img src={currentTrack.cover} alt="" className="w-full h-full object-cover blur-3xl opacity-20 scale-110" />
          )}
          <div className="absolute inset-0" style={{ backgroundColor: "var(--mq-bg)", opacity: 0.85 }} />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setFullTrackViewOpen(false); setShowSimilar(false); }}
            className="p-2" style={{ color: "var(--mq-text)" }}>
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--mq-card)", color: "var(--mq-text-muted)", border: "1px solid var(--mq-border)" }}>
            Сейчас играет
          </span>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--mq-card)", color: "var(--mq-text-muted)", border: "1px solid var(--mq-border)" }}>
            SoundCloud
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
          {/* Album art with circular visualization */}
          <motion.div
            initial={animationsEnabled ? { scale: 0.8, opacity: 0 } : undefined}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="relative mb-8"
          >
            {/* Circular audio visualization canvas - sized larger than album art */}
            <canvas
              ref={vizCanvasRef}
              className="absolute pointer-events-none"
              style={{
                width: "calc(100% + 60px)",
                height: "calc(100% + 60px)",
                left: "-30px",
                top: "-30px",
                opacity: isPlaying ? 0.75 : 0,
                transition: "opacity 0.4s",
              }}
            />
            <div className="w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-2xl overflow-hidden shadow-2xl relative z-10"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              <img src={currentTrack.cover} alt={currentTrack.album} className="w-full h-full object-cover" />
            </div>
          </motion.div>

          {/* Track info */}
          <div className="text-center mb-6 w-full">
            <h2 className="text-xl font-bold mb-1 truncate" style={{ color: "var(--mq-text)" }}>
              {currentTrack.title}
            </h2>
            <p className="text-sm mb-1 truncate" style={{ color: "var(--mq-text-muted)" }}>
              {currentTrack.artist}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)", opacity: 0.7 }}>
              {currentTrack.album}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full mb-6">
            <div ref={progressRef}
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
              className="w-full h-2 rounded-full cursor-pointer relative"
              style={{ backgroundColor: "var(--mq-border)" }}>
              <div className="h-full rounded-full transition-all duration-100"
                style={{ width: `${progressPct}%`, backgroundColor: "var(--mq-accent)", boxShadow: "0 0 8px var(--mq-glow)" }} />
              <div className="absolute top-1/2 w-4 h-4 rounded-full"
                style={{ left: `${progressPct}%`, backgroundColor: "var(--mq-accent)", transform: "translate(-50%, -50%)", boxShadow: "0 0 8px var(--mq-glow)" }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs" style={{ color: "var(--mq-text-muted)" }}>{formatDuration(Math.floor(progress))}</span>
              <span className="text-xs" style={{ color: "var(--mq-text-muted)" }}>{formatDuration(Math.floor(duration))}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 mb-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={toggleShuffle}
              style={{ color: shuffle ? "var(--mq-accent)" : "var(--mq-text-muted)" }}>
              <Shuffle className="w-5 h-5" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={prevTrack} style={{ color: "var(--mq-text)" }}>
              <SkipBack className="w-6 h-6" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={togglePlay}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)", boxShadow: isPlaying ? "0 0 30px var(--mq-glow)" : "none" }}>
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={nextTrack} style={{ color: "var(--mq-text)" }}>
              <SkipForward className="w-6 h-6" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={toggleRepeat}
              style={{ color: repeat !== "off" ? "var(--mq-accent)" : "var(--mq-text-muted)" }}>
              {repeat === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </motion.button>
          </div>

          {/* Volume with mouse wheel */}
          <div
            className="flex items-center gap-3 w-full max-w-xs mb-6"
            onWheel={handleVolumeWheel}
          >
            <button onClick={() => setVolume(volume > 0 ? 0 : 70)} style={{ color: "var(--mq-text-muted)" }}>
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div ref={volumeRef} onClick={handleVolumeClick}
              className="flex-1 h-1.5 rounded-full cursor-pointer" style={{ backgroundColor: "var(--mq-border)" }}>
              <div className="h-full rounded-full" style={{ width: `${volume}%`, backgroundColor: "var(--mq-accent)" }} />
            </div>
            <span className="text-[10px] w-8 text-right" style={{ color: "var(--mq-text-muted)" }}>{volume}%</span>
          </div>

          {/* Like / Dislike / Similar buttons */}
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => currentTrack && toggleLike(currentTrack.id, currentTrack)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm"
              style={{
                backgroundColor: isLiked ? "rgba(239,68,68,0.15)" : "var(--mq-card)",
                border: `1px solid ${isLiked ? "rgba(239,68,68,0.4)" : "var(--mq-border)"}`,
                color: isLiked ? "#ef4444" : "var(--mq-text-muted)",
              }}>
              <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
              {isLiked ? "Нравится" : "Лайк"}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => currentTrack && toggleDislike(currentTrack.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm"
              style={{
                backgroundColor: isDisliked ? "rgba(239,68,68,0.15)" : "var(--mq-card)",
                border: `1px solid ${isDisliked ? "rgba(239,68,68,0.4)" : "var(--mq-border)"}`,
                color: isDisliked ? "#ef4444" : "var(--mq-text-muted)",
              }}>
              <ThumbsDown className={`w-4 h-4 ${isDisliked ? "fill-current" : ""}`} />
              {isDisliked ? "Не нравится" : "Дизлайк"}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowSimilar(!showSimilar)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm"
              style={{
                backgroundColor: showSimilar ? "var(--mq-accent)" : "var(--mq-card)",
                border: "1px solid var(--mq-border)",
                color: showSimilar ? "var(--mq-text)" : "var(--mq-text-muted)",
              }}>
              <ListMusic className="w-4 h-4" />
              Похожие
            </motion.button>
          </div>
        </div>

        {/* Similar tracks panel */}
        <AnimatePresence>
          {showSimilar && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="relative z-10 overflow-hidden"
              style={{ maxHeight: "40vh" }}>
              <div className="p-4 pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ color: "var(--mq-text)" }}>Похожие треки</h3>
                  <button onClick={() => setShowSimilar(false)} style={{ color: "var(--mq-text-muted)" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {similarTracksLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: "var(--mq-card)" }} />
                    ))}
                  </div>
                ) : similarTracks.length > 0 ? (
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "30vh" }}>
                    {similarTracks.map((track, i) => (
                      <TrackCard key={track.id} track={track} index={i} queue={similarTracks} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-4" style={{ color: "var(--mq-text-muted)" }}>Не удалось загрузить похожие треки</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
