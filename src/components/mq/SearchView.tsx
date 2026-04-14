"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { mockTracks, mockPlaylists, genresList } from "@/lib/mockData";
import TrackCard from "./TrackCard";
import PlaylistCard from "./PlaylistCard";
import { Input } from "@/components/ui/input";
import { Search, X, SlidersHorizontal } from "lucide-react";

export default function SearchView() {
  const { searchQuery, setSearchQuery, selectedGenre, setSelectedGenre, animationsEnabled } = useAppStore();
  const [showFilters, setShowFilters] = useState(false);

  const filteredTracks = useMemo(() => {
    return mockTracks.filter((t) => {
      const matchesQuery =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.album.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = !selectedGenre || t.genre === selectedGenre;
      return matchesQuery && matchesGenre;
    });
  }, [searchQuery, selectedGenre]);

  const filteredPlaylists = useMemo(() => {
    return mockPlaylists.filter((p) => {
      const matchesQuery =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = !selectedGenre || p.genre === selectedGenre;
      return matchesQuery && matchesGenre;
    });
  }, [searchQuery, selectedGenre]);

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
              onClick={() => setSearchQuery("")}
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
      <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
        {filteredTracks.length} треков найдено
      </p>

      {/* Playlists */}
      {filteredPlaylists.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--mq-text)" }}>
            Плейлисты
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlaylists.map((pl, i) => (
              <PlaylistCard key={pl.id} playlist={pl} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Tracks */}
      {filteredTracks.length > 0 ? (
        <div>
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--mq-text)" }}>
            Треки
          </h2>
          <div className="space-y-2">
            {filteredTracks.map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
          <p style={{ color: "var(--mq-text-muted)" }}>Ничего не найдено</p>
        </div>
      )}
    </div>
  );
}
