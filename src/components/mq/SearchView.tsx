"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { genresList, type Track } from "@/lib/musicApi";
import TrackCard from "./TrackCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, SlidersHorizontal, Music, Play } from "lucide-react";

export default function SearchView() {
  const { searchQuery, setSearchQuery, selectedGenre, setSelectedGenre, animationsEnabled, playTrack } = useAppStore();
  const [showFilters, setShowFilters] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Genre filter search
  const [genreTracks, setGenreTracks] = useState<Track[]>([]);
  const [isGenreLoading, setIsGenreLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setHasSearched(true);
      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          const data = await res.json();
          setSearchResults(data.tracks || []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [searchQuery]);

  // Genre filter
  useEffect(() => {
    if (!selectedGenre) {
      setGenreTracks([]);
      return;
    }

    const controller = new AbortController();
    const loadGenre = async () => {
      setIsGenreLoading(true);
      try {
        const res = await fetch(
          `/api/music/genre?genre=${encodeURIComponent(selectedGenre)}`,
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          const data = await res.json();
          setGenreTracks(data.tracks || []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setGenreTracks([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenreLoading(false);
        }
      }
    };
    loadGenre();

    return () => controller.abort();
  }, [selectedGenre]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  }, [setSearchQuery]);

  const handlePlayAll = useCallback(() => {
    const tracksToPlay = searchResults.length > 0 ? searchResults : genreTracks;
    if (tracksToPlay.length > 0) {
      playTrack(tracksToPlay[0], tracksToPlay);
    }
  }, [searchResults, genreTracks, playTrack]);

  const activeTracks = selectedGenre ? genreTracks : searchResults;
  const activeLoading = selectedGenre ? isGenreLoading : isLoading;
  const activeHasSearched = selectedGenre || hasSearched;

  return (
    <div className="p-4 lg:p-6 pb-40 lg:pb-28 space-y-4">
      {/* Search bar */}
      <motion.div
        initial={animationsEnabled ? { opacity: 0, y: -10 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
          <Input
            placeholder="Искать треки, артистов, альбомы..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 min-h-[44px]"
            style={{
              backgroundColor: "var(--mq-input-bg)",
              border: "1px solid var(--mq-border)",
              color: "var(--mq-text)",
            }}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--mq-text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFilters(!showFilters)}
          className="p-3 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{
            backgroundColor: showFilters ? "var(--mq-accent)" : "var(--mq-card)",
            border: "1px solid var(--mq-border)",
            color: showFilters ? "var(--mq-text)" : "var(--mq-text-muted)",
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </motion.button>
      </motion.div>

      {/* Genre filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-wrap gap-2"
        >
          <button
            onClick={() => setSelectedGenre("")}
            className="px-3 py-1.5 rounded-full text-xs font-medium min-h-[32px]"
            style={{
              backgroundColor: !selectedGenre ? "var(--mq-accent)" : "var(--mq-card)",
              color: "var(--mq-text)",
              border: "1px solid var(--mq-border)",
            }}
          >
            Все
          </button>
          {genresList.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(selectedGenre === g ? "" : g)}
              className="px-3 py-1.5 rounded-full text-xs font-medium min-h-[32px]"
              style={{
                backgroundColor: selectedGenre === g ? "var(--mq-accent)" : "var(--mq-card)",
                color: "var(--mq-text)",
                border: "1px solid var(--mq-border)",
              }}
            >
              {g}
            </button>
          ))}
        </motion.div>
      )}

      {/* Results info */}
      {activeHasSearched && !activeLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
            {selectedGenre
              ? `Жанр: ${selectedGenre} — ${activeTracks.length} треков`
              : `${activeTracks.length} треков найдено`
            }
          </p>
          {activeTracks.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePlayAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}
            >
              <Play className="w-3 h-3" style={{ marginLeft: 1 }} />
              Воспроизвести все
            </motion.button>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {activeLoading && (
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

      {/* Empty state */}
      {!activeLoading && activeHasSearched && activeTracks.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
          <p style={{ color: "var(--mq-text-muted)" }}>Ничего не найдено</p>
          <p className="text-xs mt-1" style={{ color: "var(--mq-text-muted)", opacity: 0.7 }}>
            Попробуйте изменить запрос или выбрать другой жанр
          </p>
        </div>
      )}

      {/* Track results */}
      {!activeLoading && activeTracks.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--mq-text)" }}>
            {selectedGenre ? `Жанр: ${selectedGenre}` : "Треки"}
          </h2>
          <div className="space-y-2">
            {activeTracks.map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} queue={activeTracks} />
            ))}
          </div>
        </div>
      )}

      {/* Default state: no search yet */}
      {!activeHasSearched && !activeLoading && (
        <div className="text-center py-12">
          <Music className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
          <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
            Начните вводить для поиска музыки
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--mq-text-muted)", opacity: 0.7 }}>
            Или выберите жанр в фильтрах
          </p>
        </div>
      )}
    </div>
  );
}
