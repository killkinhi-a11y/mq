"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { type Track, getRecommendations } from "@/lib/musicApi";
import TrackCard from "./TrackCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, TrendingUp, Clock, ListMusic, Music, Sparkles, RefreshCw } from "lucide-react";

export default function MainView() {
  const {
    animationsEnabled, playTrack, likedTrackIds,
    history, playlists,
  } = useAppStore();

  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecLoading, setIsRecLoading] = useState(true);

  // Build taste profile from liked tracks + history
  const tasteProfile = useMemo(() => {
    const { likedTracksData, history, likedTrackIds } = useAppStore.getState();

    // Collect genres and artists from liked tracks
    const genreCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};

    for (const track of likedTracksData) {
      if (track.genre) {
        genreCounts[track.genre] = (genreCounts[track.genre] || 0) + 2; // liked = weight 2
      }
      artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 2;
    }

    // Add history weight
    for (const entry of history.slice(0, 50)) {
      const t = entry.track;
      if (t.genre) {
        genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1; // history = weight 1
      }
      artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
    }

    // Get top genres (max 3)
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    // Get top artists (max 2)
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([artist]) => artist);

    // Build exclude IDs
    const excludeIds = [...likedTrackIds, ...history.slice(0, 30).map(h => h.track.id)].join(",");

    return { topGenres, topArtists, excludeIds };
  }, [likedTrackIds, history]);

  // Fetch trending tracks
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

  // Fetch smart recommendations based on taste
  const loadRecommendations = useCallback(async () => {
    setIsRecLoading(true);
    try {
      const { topGenres, topArtists, excludeIds } = tasteProfile;
      const params = new URLSearchParams();

      if (topGenres.length > 0 || topArtists.length > 0) {
        if (topGenres.length > 0) params.set("genres", topGenres.join(","));
        if (topArtists.length > 0) params.set("artists", topArtists.join(","));
        if (excludeIds) params.set("excludeIds", excludeIds);
      } else {
        params.set("genre", "random");
      }

      const res = await fetch(`/api/music/recommendations?${params}`);
      const data = await res.json();
      setRecommendations(data.tracks || []);
    } catch {
      setRecommendations([]);
    } finally {
      setIsRecLoading(false);
    }
  }, [tasteProfile]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handlePlayAll = useCallback(() => {
    if (trendingTracks.length > 0) playTrack(trendingTracks[0], trendingTracks);
  }, [trendingTracks, playTrack]);

  const handlePlayRecAll = useCallback(() => {
    if (recommendations.length > 0) playTrack(recommendations[0], recommendations);
  }, [recommendations, playTrack]);

  const recentTracks = history.slice(0, 6);
  const hasTasteData = tasteProfile.topGenres.length > 0 || tasteProfile.topArtists.length > 0;

  return (
    <div className="p-4 lg:p-6 pb-40 lg:pb-28 space-y-6">
      {/* Hero */}
      <motion.div
        initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 lg:p-8 relative overflow-hidden"
        style={{ background: "var(--mq-gradient), var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold mb-2" style={{ color: "var(--mq-text)" }}>
            Добро пожаловать!
          </h1>
          <p className="text-sm lg:text-base" style={{ color: "var(--mq-text-muted)" }}>
            Откройте для себя музыку, которая поднимет настроение
          </p>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Heart, label: "Избранное", value: `${likedTrackIds.length} треков` },
          { icon: TrendingUp, label: "Популярное", value: "Сейчас" },
          { icon: Clock, label: "История", value: `${history.length} треков` },
          { icon: ListMusic, label: "Плейлисты", value: `${playlists.length} шт.` },
        ].map((stat, i) => (
          <motion.div key={stat.label}
            initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--mq-accent)", opacity: 0.8 }}>
              <stat.icon className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>{stat.label}</p>
              <p className="text-sm font-semibold" style={{ color: "var(--mq-text)" }}>{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent history */}
      {recentTracks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
                Недавно прослушанные
              </h2>
            </div>
          </div>
          <div className="space-y-2">
            {recentTracks.map((entry, i) => (
              <TrackCard key={entry.track.id + "_" + entry.playedAt} track={entry.track} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Smart Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
            <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
              {hasTasteData ? "Рекомендации для вас" : "Откройте для себя"}
            </h2>
            {hasTasteData && tasteProfile.topGenres.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--mq-input-bg)", color: "var(--mq-text-muted)" }}>
                {tasteProfile.topGenres[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {recommendations.length > 0 && (
              <button onClick={handlePlayRecAll} className="text-sm" style={{ color: "var(--mq-accent)" }}>
                Воспроизвести все
              </button>
            )}
            <motion.button whileTap={{ scale: 0.9 }} onClick={loadRecommendations} disabled={isRecLoading}
              className="p-1.5 rounded-lg" style={{ color: "var(--mq-text-muted)", border: "1px solid var(--mq-border)" }}>
              <RefreshCw className={`w-3.5 h-3.5 ${isRecLoading ? "animate-spin" : ""}`} />
            </motion.button>
          </div>
        </div>

        {isRecLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--mq-card)" }}>
                <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isRecLoading && recommendations.length > 0 && (
          <div className="space-y-2">
            {recommendations.slice(0, 8).map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} />
            ))}
          </div>
        )}

        {!isRecLoading && recommendations.length === 0 && (
          <div className="text-center py-8">
            <Music className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
              {hasTasteData ? "Не удалось загрузить рекомендации по вашему вкусу" : "Лайкайте треки и слушайте музыку, чтобы получить персональные рекомендации"}
            </p>
          </div>
        )}
      </div>

      {/* Trending tracks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
            Популярные треки
          </h2>
          {trendingTracks.length > 0 && (
            <button onClick={handlePlayAll} className="text-sm" style={{ color: "var(--mq-accent)" }}>
              Воспроизвести все
            </button>
          )}
        </div>

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

        {!isLoading && trendingTracks.length > 0 && (
          <div className="space-y-2">
            {trendingTracks.slice(0, 10).map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} />
            ))}
          </div>
        )}

        {!isLoading && trendingTracks.length === 0 && (
          <div className="text-center py-8">
            <Music className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Не удалось загрузить популярные треки</p>
          </div>
        )}
      </div>
    </div>
  );
}
