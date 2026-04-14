"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, X, Music, Minimize2 } from "lucide-react";

export default function PiPPlayer() {
  const {
    currentTrack, isPlaying, togglePlay, isPiPActive, setPiPActive,
    setFullTrackViewOpen,
  } = useAppStore();

  const pipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // Don't drag on buttons
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, Math.min(window.innerWidth - 220, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = Math.max(0, Math.min(window.innerWidth - 220, touch.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 80, touch.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isPiPActive) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPiPActive, isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  if (!isPiPActive || !currentTrack) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={pipRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="fixed z-[9999] rounded-xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing select-none"
        style={{
          left: position.x,
          top: position.y,
          width: 220,
          backgroundColor: "var(--mq-player-bg)",
          border: "1px solid var(--mq-border)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Content */}
        <div className="flex items-center gap-2 p-2">
          {/* Album art */}
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
            onClick={() => { setPiPActive(false); setFullTrackViewOpen(true); }}>
            {currentTrack.cover ? (
              <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "var(--mq-accent)", opacity: 0.5 }}>
                <Music className="w-4 h-4" style={{ color: "var(--mq-text)" }} />
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 cursor-pointer"
            onClick={() => { setPiPActive(false); setFullTrackViewOpen(true); }}>
            <p className="text-xs font-medium truncate" style={{ color: "var(--mq-text)" }}>{currentTrack.title}</p>
            <p className="text-[10px] truncate" style={{ color: "var(--mq-text-muted)" }}>{currentTrack.artist}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="p-1.5 rounded-full" style={{ backgroundColor: "var(--mq-accent)" }}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" style={{ color: "var(--mq-text)" }} /> : <Play className="w-3.5 h-3.5 ml-0.5" style={{ color: "var(--mq-text)" }} />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); setPiPActive(false); }}
              className="p-1 rounded-full" style={{ color: "var(--mq-text-muted)" }}>
              <Minimize2 className="w-3 h-3" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
