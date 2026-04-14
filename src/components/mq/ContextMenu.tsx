"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ListPlus, Heart, ThumbsDown, User, Copy, ListMusic } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { searchTracks, type Track } from "@/lib/musicApi";

interface ContextMenuProps {
  track: Track;
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu({ track, x, y, onClose }: ContextMenuProps) {
  const {
    playTrack, queue, toggleLike, toggleDislike,
    isTrackLiked, isTrackDisliked, setSimilarTracks,
    setSimilarTracksLoading, setFullTrackViewOpen,
  } = useAppStore();

  const menuRef = useRef<HTMLDivElement>(null);
  const isLiked = isTrackLiked(track.id);
  const isDisliked = isTrackDisliked(track.id);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 280);

  const handlePlay = () => {
    playTrack(track, [...queue, track]);
    onClose();
  };

  const handleAddToQueue = () => {
    const state = useAppStore.getState();
    const newQueue = [...state.queue];
    newQueue.splice(state.queueIndex + 1, 0, track);
    useAppStore.setState({ queue: newQueue });
    onClose();
  };

  const handleSimilar = async () => {
    setFullTrackViewOpen(true);
    setSimilarTracksLoading(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(track.artist)}&limit=8`);
      const data = await res.json();
      const tracks: Track[] = (data.tracks || []).filter((t: Track) => t.id !== track.id);
      setSimilarTracks(tracks.slice(0, 6));
    } catch {
      setSimilarTracks([]);
    } finally {
      setSimilarTracksLoading(false);
    }
    onClose();
  };

  const handleToggleLike = () => {
    toggleLike(track.id);
    onClose();
  };

  const handleToggleDislike = () => {
    toggleDislike(track.id);
    onClose();
  };

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(`${track.title} — ${track.artist}`).catch(() => {});
    onClose();
  };

  const items = [
    { icon: Play, label: "Воспроизвести", action: handlePlay, accent: false },
    { icon: ListPlus, label: "Добавить в очередь", action: handleAddToQueue, accent: false },
    { icon: ListMusic, label: "Похожие треки", action: handleSimilar, accent: false },
    { icon: Heart, label: isLiked ? "Убрать лайк" : "❤ Лайк", action: handleToggleLike, accent: isLiked },
    { icon: ThumbsDown, label: isDisliked ? "Убрать дизлайк" : "👎 Дизлайк", action: handleToggleDislike, accent: isDisliked },
    { icon: User, label: "Открыть артиста", action: () => { onClose(); }, accent: false },
    { icon: Copy, label: "Копировать название", action: handleCopyTitle, accent: false },
  ];

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[200] rounded-xl py-1 shadow-2xl min-w-[200px] max-w-[260px]"
        style={{
          left: adjustedX,
          top: adjustedY,
          backgroundColor: "var(--mq-card)",
          border: "1px solid var(--mq-border)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:opacity-80 transition-colors text-left"
            style={{
              color: item.accent ? "var(--mq-accent)" : "var(--mq-text)",
            }}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: item.accent ? "var(--mq-accent)" : "var(--mq-text-muted)" }} />
            {item.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
