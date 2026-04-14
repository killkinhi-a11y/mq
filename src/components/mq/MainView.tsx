"use client";

import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { mockTracks, mockPlaylists, mockContacts } from "@/lib/mockData";
import TrackCard from "./TrackCard";
import PlaylistCard from "./PlaylistCard";
import { Heart, TrendingUp, Clock, Users } from "lucide-react";

export default function MainView() {
  const { animationsEnabled, setView } = useAppStore();

  return (
    <div className="p-4 lg:p-6 pb-32 lg:pb-28 space-y-6">
      {/* Hero */}
      <motion.div
        initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 lg:p-8 relative overflow-hidden"
        style={{
          background: "var(--mq-gradient), var(--mq-card)",
          border: "1px solid var(--mq-border)",
        }}
      >
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold mb-2" style={{ color: "var(--mq-text)" }}>
            Добро пожаловать! 🎵
          </h1>
          <p className="text-sm lg:text-base" style={{ color: "var(--mq-text-muted)" }}>
            Откройте для себя музыку, которая поднимет настроение
          </p>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Heart, label: "Избранное", value: "42 трека" },
          { icon: TrendingUp, label: "Популярное", value: "Сейчас" },
          { icon: Clock, label: "Недавно", value: "Сегодня" },
          { icon: Users, label: "Друзья", value: `${mockContacts.length} онлайн` },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              backgroundColor: "var(--mq-card)",
              border: "1px solid var(--mq-border)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--mq-accent)", opacity: 0.8 }}
            >
              <stat.icon className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>{stat.label}</p>
              <p className="text-sm font-semibold" style={{ color: "var(--mq-text)" }}>{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Featured playlists */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
            Рекомендуемые плейлисты
          </h2>
          <button
            onClick={() => setView("search")}
            className="text-sm"
            style={{ color: "var(--mq-accent)" }}
          >
            Все →
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {mockPlaylists.slice(0, 6).map((pl, i) => (
            <PlaylistCard key={pl.id} playlist={pl} index={i} />
          ))}
        </div>
      </div>

      {/* Trending tracks */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--mq-text)" }}>
          Популярные треки
        </h2>
        <div className="space-y-2">
          {mockTracks.slice(0, 8).map((track, i) => (
            <TrackCard key={track.id} track={track} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
