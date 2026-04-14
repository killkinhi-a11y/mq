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

  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [minimized, setMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    if (isPiPActive) {
      setPos({ x: 16, y: 16 });
      setMinimized(false);
    }
  }, [isPiPActive]);

  // Update progress from store (synced via timeupdate in PlayerBar)
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  if (!isPiPActive || !currentTrack) return null;

  const openFullView = () => {
    setPiPActive(false);
    useAppStore.getState().setFullTrackViewOpen(true);
  };

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    isDragging.current = true;
    dragOffset.current = {
      x: clientX - pos.x,
      y: clientY - pos.y,
    };

    const onMove = (cx: number, cy: number) => {
      if (!isDragging.current) return;
      const w = minimized ? 60 : 330;
      const h = minimized ? 60 : 110;
      const newX = Math.max(0, Math.min(cx - dragOffset.current.x, window.innerWidth - w));
      const newY = Math.max(0, Math.min(cy - dragOffset.current.y, window.innerHeight - h));
      setPos({ x: newX, y: newY });
    };

    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      onMove(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    const onEnd = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }, [pos, minimized]);

  const w = minimized ? 60 : 330;
  const h = minimized ? 60 : 110;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.7 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          width: w,
          height: h,
          borderRadius: 16,
          overflow: "hidden",
          cursor: "default",
          userSelect: "none",
        }}
      >
        {/* Glow border */}
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
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            backgroundColor: "var(--mq-card)",
            border: "1px solid var(--mq-border)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 16px var(--mq-glow)",
          }}
        >
          {minimized ? (
            <div style={{ width: 60, height: 60, position: "relative" }}>
              {currentTrack.cover ? (
                <img src={currentTrack.cover} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 16 }} />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: "var(--mq-accent)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
                  <Music size={22} style={{ color: "var(--mq-text)" }} />
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
            <div style={{ width: 330 }}>
              {/* Drag handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 4px", cursor: "grab" }}>
                <div style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: "var(--mq-border)", opacity: 0.6 }} />
              </div>
              {/* Content */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 12px 6px" }}>
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
              {/* Progress bar */}
              <div style={{ height: 3, backgroundColor: "rgba(255,255,255,0.08)", position: "relative", margin: "0 12px 6px", borderRadius: 2 }}>
                <div style={{ height: "100%", width: progressPct + "%", backgroundColor: "var(--mq-accent)", borderRadius: 2, transition: "width 0.3s linear" }} />
              </div>
              {/* Time and branding */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0 12px 8px", fontSize: 9, color: "var(--mq-text-muted)" }}>
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
