"use client";

import { useState, useCallback } from "react";
import { useAppStore, type UserPlaylist } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import { type Track } from "@/lib/musicApi";
import {
  Plus, Trash2, Play, Music, ListMusic, ChevronRight,
  Edit3, X, Check, Disc3, Clock, Heart
} from "lucide-react";
import TrackCard from "./TrackCard";

export default function PlaylistView() {
  const {
    playlists, selectedPlaylistId, setSelectedPlaylistId,
    createPlaylist, deletePlaylist, renamePlaylist,
    removeFromPlaylist, animationsEnabled, playTrack, likedTrackIds,
  } = useAppStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreate = useCallback(() => {
    if (newName.trim()) {
      createPlaylist(newName.trim(), newDesc.trim());
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    }
  }, [newName, newDesc, createPlaylist]);

  const handleRename = useCallback((id: string) => {
    if (editName.trim()) {
      renamePlaylist(id, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  }, [editName, renamePlaylist]);

  const handlePlayAll = useCallback((pl: UserPlaylist) => {
    if (pl.tracks.length > 0) playTrack(pl.tracks[0], pl.tracks);
  }, [playTrack]);

  // ── Detail view for selected playlist ──
  if (selectedPlaylist) {
    return (
      <div className="p-4 lg:p-6 pb-40 lg:pb-28 space-y-4 max-w-2xl mx-auto">
        {/* Back button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setSelectedPlaylistId(null)}
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--mq-accent)" }}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Все плейлисты
        </motion.button>

        {/* Playlist header */}
        <motion.div
          initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
        >
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: "var(--mq-accent)", opacity: 0.8 }}>
              {selectedPlaylist.cover ? (
                <img src={selectedPlaylist.cover} alt="" className="w-full h-full object-cover" />
              ) : (
                <ListMusic className="w-8 h-8" style={{ color: "var(--mq-text)" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate" style={{ color: "var(--mq-text)" }}>
                {selectedPlaylist.name}
              </h1>
              {selectedPlaylist.description && (
                <p className="text-sm mt-1" style={{ color: "var(--mq-text-muted)" }}>
                  {selectedPlaylist.description}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: "var(--mq-text-muted)" }}>
                {selectedPlaylist.tracks.length} треков
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedPlaylist.tracks.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handlePlayAll(selectedPlaylist)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}
                >
                  <Play className="w-5 h-5 ml-0.5" />
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => deletePlaylist(selectedPlaylist.id)}
                className="p-2 rounded-lg"
                style={{ color: "var(--mq-text-muted)", border: "1px solid var(--mq-border)" }}
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Tracks list */}
        {selectedPlaylist.tracks.length > 0 ? (
          <div className="space-y-2">
            {selectedPlaylist.tracks.map((track, i) => (
              <div key={track.id} className="relative">
                <TrackCard track={track} index={i} queue={selectedPlaylist.tracks} />
                <button
                  onClick={() => removeFromPlaylist(selectedPlaylist.id, track.id)}
                  className="absolute top-3 right-3 p-1 rounded opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--mq-text-muted)", backgroundColor: "var(--mq-card)" }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Music className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
              Плейлист пуст. Добавьте треки из поиска.
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--mq-text-muted)", opacity: 0.6 }}>
              Нажмите правой кнопкой на трек и выберите &quot;Добавить в плейлист&quot;
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── All playlists grid ──
  return (
    <div className="p-4 lg:p-6 pb-40 lg:pb-28 space-y-6 max-w-2xl mx-auto">
      <motion.div
        initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold" style={{ color: "var(--mq-text)" }}>
            Плейлисты
          </h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}
          >
            <Plus className="w-4 h-4" />
            Создать
          </motion.button>
        </div>
        <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
          {playlists.length} плейлистов
        </p>
      </motion.div>

      {/* Create playlist dialog */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: "var(--mq-text)" }}>Новый плейлист</h3>
              <button onClick={() => setShowCreate(false)} style={{ color: "var(--mq-text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название плейлиста"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Описание (необязательно)"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="w-full py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: newName.trim() ? "var(--mq-accent)" : "var(--mq-border)",
                color: newName.trim() ? "var(--mq-text)" : "var(--mq-text-muted)",
              }}
            >
              Создать
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist grid */}
      {playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {playlists.map((pl, i) => (
            <motion.div
              key={pl.id}
              initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedPlaylistId(pl.id)}
              className="rounded-xl p-4 cursor-pointer relative group"
              style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden mb-3 flex items-center justify-center"
                style={{ backgroundColor: "var(--mq-accent)", opacity: 0.7 }}>
                {pl.cover ? (
                  <img src={pl.cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ListMusic className="w-6 h-6" style={{ color: "var(--mq-text)" }} />
                )}
              </div>
              {editingId === pl.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 text-sm rounded px-1 py-0.5 min-w-0"
                    style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(pl.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button onClick={() => handleRename(pl.id)} style={{ color: "var(--mq-accent)" }}>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium truncate" style={{ color: "var(--mq-text)" }}>
                    {pl.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--mq-text-muted)" }}>
                    {pl.tracks.length} треков
                  </p>
                </>
              )}
              {/* Hover actions */}
              <div
                className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {editingId !== pl.id && (
                  <button
                    onClick={() => { setEditingId(pl.id); setEditName(pl.name); }}
                    className="p-1 rounded"
                    style={{ color: "var(--mq-text-muted)", backgroundColor: "var(--mq-bg)" }}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => deletePlaylist(pl.id)}
                  className="p-1 rounded"
                  style={{ color: "#ef4444", backgroundColor: "var(--mq-bg)" }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {/* Play overlay */}
              {pl.tracks.length > 0 && (
                <div
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handlePlayAll(pl); }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Disc3 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--mq-text-muted)", opacity: 0.2 }} />
          <p className="text-sm font-medium" style={{ color: "var(--mq-text-muted)" }}>
            У вас пока нет плейлистов
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--mq-text-muted)", opacity: 0.6 }}>
            Создайте первый плейлист и добавьте любимые треки
          </p>
        </div>
      )}
    </div>
  );
}
