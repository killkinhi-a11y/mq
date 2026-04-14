"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { type Track, getRecommendations } from "@/lib/musicApi";
import TrackCard from "./TrackCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, TrendingUp, Clock, Users, Music, Sparkles, RefreshCw } from "lucide-react";

export default function MainView() {
  const { animationsEnabled, playTrack, likedTrackIds } = useAppStore();
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecLoading, setIsRecLoading] = useState(true);

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

  // Fetch recommendations
  const loadRecommendations = useCallback(async () => {
    setIsRecLoading(true);
    try {
      const tracks = await getRecommendations("random");
      setRecommendations(tracks);
    } catch {
      setRecommendations([]);
    } finally {
      setIsRecLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handlePlayAll = useCallback(() => {
    if (trendingTracks.length > 0) playTrack(trendingTracks[0], trendingTracks);
  }, [trendingTracks, playTrack]);

  const handlePlayRecAll = useCallback(() => {
    if (recommendations.length > 0) playTrack(recommendations[0], recommendations);
  }, [recommendations, playTrack]);

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
          { icon: Heart, label: "Избранное", value: `${likedTrackIds.length} треков` },
          { icon: TrendingUp, label: "Популярное", value: "Сейчас" },
          { icon: Clock, label: "Недавно", value: "Сегодня" },
          { icon: Users, label: "Друзья", value: "5 онлайн" },
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

      {/* Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
            <h2 className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>
              Рекомендации для тебя
            </h2>
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
            <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Не удалось загрузить рекомендации</p>
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
