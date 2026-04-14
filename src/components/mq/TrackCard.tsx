"use client";

import { Track } from "@/lib/mockData";
import { useAppStore } from "@/store/useAppStore";
import { Play, Pause, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { formatDuration } from "@/lib/mockData";

interface TrackCardProps {
  track: Track;
  index?: number;
}

export default function TrackCard({ track, index = 0 }: TrackCardProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay, animationsEnabled } = useAppStore();
  const isActive = currentTrack?.id === track.id;

  const handleClick = () => {
    if (isActive) {
      togglePlay();
    } else {
      playTrack(track);
    }
  };

  const motionProps = animationsEnabled
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.05 },
      }
    : {};

  return (
    <motion.div
      {...motionProps}
      onClick={handleClick}
      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group"
      style={{
        backgroundColor: isActive ? "var(--mq-accent)" : "var(--mq-card)",
      }}
      whileHover={animationsEnabled ? { scale: 1.02, backgroundColor: "var(--mq-card-hover)" } : undefined}
      whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
    >
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={track.cover}
          alt={track.album}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          {isActive && isPlaying ? (
            <Pause className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
          ) : (
            <Play className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
          )}
        </div>
        {isActive && isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <Pause className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="font-medium text-sm truncate"
          style={{ color: isActive ? "var(--mq-text)" : "var(--mq-text)" }}
        >
          {track.title}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
          {track.artist} • {track.album}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)", opacity: 0.7 }}>
          {track.genre}
        </span>
        <Clock className="w-3 h-3" style={{ color: "var(--mq-text-muted)" }} />
        <span className="text-xs" style={{ color: "var(--mq-text-muted)" }}>
          {formatDuration(track.duration)}
        </span>
      </div>
    </motion.div>
  );
}
