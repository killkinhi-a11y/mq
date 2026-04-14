"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { mockContacts, type Track, genreMap } from "@/lib/musicApi";
import TrackCard from "./TrackCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, TrendingUp, Clock, Users, Music } from "lucide-react";

export default function MainView() {
  const { animationsEnabled, setView, playTrack } = useAppStore();
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [genreSections, setGenreSections] = useState<{ genre: string; tracks: Track[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenreLoading, setIsGenreLoading] = useState(false);

  // Fetch trending tracks on mount
  useEffect(() => {
    let cancelled = false;

    const fetchTrending = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/music/trending");
        if (!cancelled) {
          const data = await res.json();
          setTrendingTracks(data.tracks || []);
        }
      } catch {
        if (!cancelled) setTrendingTracks([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTrending();
    return () => { cancelled = true; };
  }, []);

  // Fetch genre sections after trending loads
  useEffect(() => {
    if (trendingTracks.length === 0 && !isLoading) return;

    const genres = ["Pop", "Rock", "Electronic"];
    let cancelled = false;

    const fetchGenres = async () => {
      setIsGenreLoading(true);
      const sections: { genre: string; tracks: Track[] }[] = [];

      await Promise.allSettled(
        genres.map(async (genre) => {
          try {
            const res = await fetch(`/api/music/genre?genre=${encodeURIComponent(genre)}`);
            const data = await res.json();
            if (!cancelled && data.tracks && data.tracks.length > 0) {
              const genreLabel = genre === "Pop" ? "Поп" : genre === "Rock" ? "Рок" : "Электроника";
              sections.push({ genre: genreLabel, tracks: data.tracks.slice(0, 5) });
            }
          } catch {
            // Skip failed genre fetches
          }
        })
      );

      if (!cancelled) {
        setGenreSections(sections);
        setIsGenreLoading(false);
      }
    };

    fetchGenres();
    return () => { cancelled = true; };
  }, [trendingTracks, isLoading]);

  const handlePlayAll = useCallback(() => {
    if (trendingTracks.length > 0) {
      playTrack(trendingTracks[0], trendingTracks);
    }
  }, [trendingTracks, playTrack]);

  return (
    <div className="p-4 lg:p-6 pb-40 lg:pb-28 space-y-6">
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

      {/* Trending tracks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
            Популярные треки
          </h2>
          {trendingTracks.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="text-sm"
              style={{ color: "var(--mq-accent)" }}
            >
              Воспроизвести все
            </button>
          )}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--mq-card)" }}>
                <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Real tracks */}
        {!isLoading && trendingTracks.length > 0 && (
          <div className="space-y-2">
            {trendingTracks.slice(0, 10).map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && trendingTracks.length === 0 && (
          <div className="text-center py-8">
            <Music className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
              Не удалось загрузить популярные треки
            </p>
          </div>
        )}
      </div>

      {/* Genre sections */}
      {isGenreLoading && (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--mq-card)" }}>
                    <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isGenreLoading && genreSections.map((section) => (
        <div key={section.genre}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
              {section.genre}
            </h2>
            <button
              onClick={() => {
                useAppStore.getState().setView("search");
                useAppStore.getState().setSearchQuery("");
                useAppStore.getState().setSelectedGenre(section.genre);
              }}
              className="text-sm"
              style={{ color: "var(--mq-accent)" }}
            >
              Все →
            </button>
          </div>
          <div className="space-y-2">
            {section.tracks.map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
