"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1, Shuffle
} from "lucide-react";
import { formatDuration } from "@/lib/mockData";

export default function PlayerBar() {
  const {
    currentTrack, isPlaying, volume, progress, duration,
    shuffle, repeat, togglePlay, nextTrack, prevTrack,
    setVolume, setProgress, setDuration, toggleShuffle, toggleRepeat,
    setView, currentView, animationsEnabled,
  } = useAppStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Simple demo audio using Web Audio API
  const playDemoTone = useCallback(() => {
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch {}
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 220 + Math.random() * 440;
    osc.type = "sine";
    gain.gain.value = (volume / 100) * 0.15;
    osc.start();
    oscillatorRef.current = osc;
    gainNodeRef.current = gain;
  }, [volume]);

  const stopDemoTone = useCallback(() => {
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch {}
      oscillatorRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && currentTrack) {
      playDemoTone();
    } else {
      stopDemoTone();
    }
    return () => stopDemoTone();
  }, [isPlaying, currentTrack, playDemoTone, stopDemoTone]);

  // Update volume on gain node
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = (volume / 100) * 0.15;
    }
  }, [volume]);

  // Simulate progress
  useEffect(() => {
    if (!isPlaying || !currentTrack || isDragging) return;
    const interval = setInterval(() => {
      const state = useAppStore.getState();
      const newProgress = state.progress + 0.1;
      if (newProgress >= state.duration) {
        if (state.repeat === "one") {
          setProgress(0);
        } else {
          nextTrack();
        }
      } else {
        setProgress(newProgress);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, isDragging, nextTrack, setProgress]);

  // Sync duration from track
  useEffect(() => {
    if (currentTrack) {
      setDuration(currentTrack.duration);
    }
  }, [currentTrack, setDuration]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setProgress(pct * duration);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setVolume(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

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
          <img
            src={currentTrack.cover}
            alt={currentTrack.album}
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--mq-text)" }}>
              {currentTrack.title}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
              {currentTrack.artist}
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
            style={{ color: shuffle ? "var(--mq-accent)" : "var(--mq-text-muted)" }}
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
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "var(--mq-accent)",
              color: "var(--mq-text)",
              boxShadow: isPlaying ? "0 0 20px var(--mq-glow)" : "none",
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
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
            style={{ color: repeat !== "off" ? "var(--mq-accent)" : "var(--mq-text-muted)" }}
          >
            {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </motion.button>
        </div>

        {/* Volume + Time */}
        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
          <span className="text-xs hidden lg:block" style={{ color: "var(--mq-text-muted)" }}>
            {formatDuration(Math.floor(progress))} / {formatDuration(Math.floor(duration))}
          </span>
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 70)}
            className="hidden md:block"
            style={{ color: "var(--mq-text-muted)" }}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div
            ref={volumeRef}
            onClick={handleVolumeClick}
            className="hidden md:block w-20 h-1.5 rounded-full cursor-pointer"
            style={{ backgroundColor: "var(--mq-border)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${volume}%`, backgroundColor: "var(--mq-accent)" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
