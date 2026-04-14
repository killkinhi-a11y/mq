"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Play, Pause, Music, X, Minimize2 } from "lucide-react";
import { formatDuration } from "@/lib/musicApi";
import { motion, AnimatePresence } from "framer-motion";

export default function PiPPlayer() {
  const {
    currentTrack, isPlaying, togglePlay, isPiPActive, setPiPActive,
    progress, duration,
  } = useAppStore();

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, posX: 0, posY: 0 });
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (isPiPActive) {
      setPos({ x: 16, y: 16 });
      setMinimized(false);
    }
  }, [isPiPActive]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: e.clientX - pos.x,
      startY: e.clientY - pos.y,
      posX: pos.x,
      posY: pos.y,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const newX = ev.clientX - dragRef.current.startX;
      const newY = ev.clientY - dragRef.current.startY;
      const maxX = window.innerWidth - (minimized ? 56 : 320);
      const maxY = window.innerHeight - (minimized ? 56 : 80);
      setPos({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos, minimized]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = {
      dragging: true,
      startX: touch.clientX - pos.x,
      startY: touch.clientY - pos.y,
      posX: pos.x,
      posY: pos.y,
    };
    const onMove = (ev: TouchEvent) => {
      if (!dragRef.current.dragging) return;
      const t = ev.touches[0];
      const maxX = window.innerWidth - (minimized ? 56 : 320);
      const maxY = window.innerHeight - (minimized ? 56 : 80);
      setPos({
        x: Math.max(0, Math.min(t.clientX - dragRef.current.startX, maxX)),
        y: Math.max(0, Math.min(t.clientY - dragRef.current.startY, maxY)),
      });
    };
    const onEnd = () => {
      dragRef.current.dragging = false;
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }, [pos, minimized]);

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  if (!isPiPActive || !currentTrack) return null;

  const openFullView = () => {
    setPiPActive(false);
    useAppStore.getState().setFullTrackViewOpen(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          width: minimized ? 56 : 320,
          borderRadius: 16,
          overflow: "hidden",
          cursor: "default",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 18,
            background: "var(--mq-accent)",
            opacity: 0.15,
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            position: "relative",
            backgroundColor: "var(--mq-card)",
            border: "1px solid var(--mq-border)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 16px var(--mq-glow)",
          }}
        >
          {minimized ? (
            <div style={{ width: 56, height: 56, position: "relative" }}>
              {currentTrack.cover ? (
                <img src={currentTrack.cover} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 16 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "var(--mq-accent)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
                  <Music size={20} style={{ color: "var(--mq-text)" }} />
                </div>
              )}
              {isPlaying && (
                <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 3, height: 8, borderRadius: 2, backgroundColor: "var(--mq-accent)", animation: "mqPipEq 0.6s ease-in-out " + (i * 0.15) + "s infinite alternate" }} />
                  ))}
                </div>
              )}
              <button onClick={(e) => { e.stopPropagation(); setPiPActive(false); }} style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", backgroundColor: "rgba(239,68,68,0.9)", border: "none", color: "white", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}>
                <X size={10} />
              </button>
            </div>
          ) : (
            <div style={{ width: 320 }}>
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px", cursor: "grab" }}>
                <div style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: "var(--mq-border)", opacity: 0.6 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px 8px" }}>
                <div onClick={openFullView} style={{ cursor: "pointer", flexShrink: 0 }}>
                  {currentTrack.cover ? (
                    <img src={currentTrack.cover} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "var(--mq-accent)", opacity: 0.4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Music size={18} style={{ color: "var(--mq-text)" }} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--mq-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, lineHeight: 1.3 }}>{currentTrack.title}</p>
                  <p style={{ fontSize: 11, color: "var(--mq-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "2px 0 0", lineHeight: 1.2 }}>{currentTrack.artist}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", backgroundColor: "var(--mq-accent)", color: "var(--mq-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isPlaying ? "0 0 12px var(--mq-glow)" : "none" }}>
                    {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setMinimized(true); }} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", backgroundColor: "rgba(255,255,255,0.08)", color: "var(--mq-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Minimize2 size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setPiPActive(false); }} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", backgroundColor: "rgba(255,255,255,0.08)", color: "var(--mq-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={12} />
                  </button>
                </div>
              </div>
              <div style={{ height: 3, backgroundColor: "rgba(255,255,255,0.08)", position: "relative", margin: "0 12px 8px", borderRadius: 2 }}>
                <div style={{ height: "100%", width: progressPct + "%", backgroundColor: "var(--mq-accent)", borderRadius: 2, transition: "width 0.3s linear" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0 12px 10px", fontSize: 9, color: "var(--mq-text-muted)" }}>
                <span>{formatDuration(Math.floor(progress))}</span>
                <span style={{ color: "var(--mq-accent)", fontSize: 8, opacity: 0.7 }}>MQ Player</span>
                <span>{formatDuration(Math.floor(duration))}</span>
              </div>
            </div>
          )}
        </div>
        <style>{"@keyframes mqPipEq{0%{height:4px}100%{height:14px}}"}</style>
      </motion.div>
    </AnimatePresence>
  );
}
