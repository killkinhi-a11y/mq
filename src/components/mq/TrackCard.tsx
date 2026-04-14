"use client";

import { useState, useCallback } from "react";
import { type Track } from "@/lib/musicApi";
import { useAppStore } from "@/store/useAppStore";
import { Play, Pause, Clock, Heart, ThumbsDown, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { formatDuration } from "@/lib/musicApi";
import ContextMenu from "./ContextMenu";

interface TrackCardProps {
  track: Track;
  index?: number;
  queue?: Track[];
}

export default function TrackCard({ track, index = 0, queue }: TrackCardProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay, animationsEnabled,
    toggleLike, toggleDislike, likedTrackIds, dislikedTrackIds } = useAppStore();
  const _likedIds = Array.isArray(likedTrackIds) ? likedTrackIds : [];
  const _dislikedIds = Array.isArray(dislikedTrackIds) ? dislikedTrackIds : [];
  const isActive = currentTrack?.id === track.id;
  const isLiked = _likedIds.includes(track.id);
  const isDisliked = _dislikedIds.includes(track.id);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  const handleClick = () => {
    if (isActive) {
      togglePlay();
    } else {
      playTrack(track, queue || [track]);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, show: true });
  }, []);

  const handleMoreClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, show: true });
  }, []);

  const handleLikeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track.id, track);
  }, [track.id, track, toggleLike]);

  const handleDislikeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleDislike(track.id);
  }, [track.id, toggleDislike]);

  const motionProps = animationsEnabled
    ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: index * 0.03 } }
    : {};

  const sourceTag = track.scIsFull ? "SC Полный" : "SC Превью";

  return (
    <>
      <motion.div
        {...motionProps}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group"
        style={{
          backgroundColor: isActive ? "var(--mq-accent)" : "var(--mq-card)",
        }}
        whileHover={animationsEnabled ? { scale: 1.02 } : undefined}
        whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
      >
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <img src={track.cover} alt={track.album} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            {isActive && isPlaying ? <Pause className="w-5 h-5" style={{ color: "var(--mq-text)" }} /> : <Play className="w-5 h-5" style={{ color: "var(--mq-text)" }} />}
          </div>
          {isActive && isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
              <Pause className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: "var(--mq-text)" }}>
            {track.title}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
            {track.artist} • {track.album}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Like/Dislike icons — large touch targets, always visible */}
          <button onPointerDown={(e) => e.stopPropagation()} onClick={handleLikeClick} className="p-2 rounded-lg transition-all duration-150 active:scale-90"
            style={{ color: isLiked ? "#ef4444" : "var(--mq-text-muted)", backgroundColor: isLiked ? "rgba(239,68,68,0.12)" : "transparent", touchAction: "manipulation" }}>
            <Heart className="w-4.5 h-4.5" style={isLiked ? { fill: "#ef4444" } : {}} />
          </button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={handleDislikeClick} className="p-2 rounded-lg transition-all duration-150 active:scale-90"
            style={{ color: isDisliked ? "#ef4444" : "var(--mq-text-muted)", backgroundColor: isDisliked ? "rgba(239,68,68,0.12)" : "transparent", touchAction: "manipulation" }}>
            <ThumbsDown className="w-4.5 h-4.5" style={isDisliked ? { fill: "#ef4444" } : {}} />
          </button>

          {sourceTag && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full hidden sm:block"
              style={{ backgroundColor: "var(--mq-input-bg)", color: "var(--mq-text-muted)" }}>
              {sourceTag}
            </span>
          )}
          <Clock className="w-3 h-3 hidden sm:block" style={{ color: "var(--mq-text-muted)" }} />
          <span className="text-xs hidden sm:block" style={{ color: "var(--mq-text-muted)" }}>
            {formatDuration(track.duration)}
          </span>

          {/* More button */}
          <button onClick={handleMoreClick} className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--mq-text-muted)" }}>
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Context Menu */}
      {contextMenu.show && (
        <ContextMenu
          track={track}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu((prev) => ({ ...prev, show: false }))}
        />
      )}
    </>
  );
}
