import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type Track, type Message as ChatMessage } from "@/lib/musicApi";

// ── Storage versioning ──
// Bump this number to force a fresh store for all users with old data.
const STORE_VERSION = 4;
const STORAGE_KEY = "mq-store-v4";

// Nuke stale data BEFORE Zustand tries to hydrate.
// This runs at module-import time, so there is no React error boundary to catch failures.
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const storedVersion = parsed?.version ?? 0;
      if (storedVersion < STORE_VERSION) {
        console.warn(`[MQ Store] version ${storedVersion} < ${STORE_VERSION} – clearing stale data`);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    console.warn("[MQ Store] corrupt localStorage – clearing");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

export type ViewType = "auth" | "main" | "search" | "messenger" | "settings" | "profile" | "playlists" | "history";
export type AuthStep = "login" | "register" | "confirm" | "confirmed";

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  cover: string;
  tracks: Track[];
  createdAt: number;
}

export interface HistoryEntry {
  track: Track;
  playedAt: number;
}

export interface SelectedPlaylist {
  id: string;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
  email: string | null;
  avatar: string | null;
  currentView: ViewType;
  authStep: AuthStep;

  // Theme
  currentTheme: string;
  customAccent: string | null;
  animationsEnabled: boolean;
  compactMode: boolean;
  fontSize: number;

  // Player
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  playbackMode: "soundcloud" | "idle";

  // Sleep timer
  sleepTimerActive: boolean;
  sleepTimerMinutes: number;
  sleepTimerRemaining: number;
  sleepTimerEndTime: number | null;

  // Messenger
  messages: ChatMessage[];
  selectedContactId: string | null;
  unreadCounts: Record<string, number>;
  contacts: { id: string; name: string; username: string; avatar: string; online: boolean; lastSeen: string }[];

  // Search
  searchQuery: string;
  selectedGenre: string;
  isLoading: boolean;

  // Full-screen track view
  isFullTrackViewOpen: boolean;

  // Likes/Dislikes
  likedTrackIds: string[];
  dislikedTrackIds: string[];
  likedTracksData: Track[];

  // PiP
  isPiPActive: boolean;

  // Similar tracks panel
  similarTracks: Track[];
  similarTracksLoading: boolean;
  showSimilarRequested: boolean;

  // Playlists
  playlists: UserPlaylist[];
  selectedPlaylistId: string | null;

  // History
  history: HistoryEntry[];

  // Actions
  setAuth: (userId: string, username: string, email: string) => void;
  logout: () => void;
  setView: (view: ViewType) => void;
  setAuthStep: (step: AuthStep) => void;

  // Theme actions
  setTheme: (theme: string) => void;
  setCustomAccent: (color: string | null) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setCompactMode: (compact: boolean) => void;
  setFontSize: (size: number) => void;

  // Player actions
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackMode: (mode: "soundcloud" | "idle") => void;

  // Sleep timer actions
  startSleepTimer: (minutes: number) => void;
  stopSleepTimer: () => void;
  updateSleepTimer: () => void;

  // Messenger actions
  addMessage: (message: ChatMessage) => void;
  setSelectedContact: (contactId: string | null) => void;
  loadMessages: (messages: ChatMessage[]) => void;
  clearUnread: (contactId: string) => void;
  addContact: (contact: { id: string; name: string; username: string; avatar: string; online: boolean; lastSeen: string }) => void;
  deleteMessagesForContact: (contactId: string) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string) => void;
  setIsLoading: (loading: boolean) => void;

  // Full-screen track view actions
  setFullTrackViewOpen: (open: boolean) => void;

  // Like/Dislike actions
  toggleLike: (trackId: string, trackData?: Track) => void;
  toggleDislike: (trackId: string) => void;
  isTrackLiked: (trackId: string) => boolean;
  isTrackDisliked: (trackId: string) => boolean;

  // PiP actions
  setPiPActive: (active: boolean) => void;

  // Similar tracks actions
  setSimilarTracks: (tracks: Track[]) => void;
  setSimilarTracksLoading: (loading: boolean) => void;
  requestShowSimilar: () => void;
  clearShowSimilarRequest: () => void;

  // Playlist actions
  createPlaylist: (name: string, description?: string) => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  setSelectedPlaylistId: (id: string | null) => void;

  // History actions
  addToHistory: (track: Track) => void;
  clearHistory: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  isAuthenticated: false,
  userId: null as string | null,
  username: null as string | null,
  email: null as string | null,
  avatar: null as string | null,
  currentView: "auth" as ViewType,
  authStep: "login" as AuthStep,
  currentTheme: "default",
  customAccent: null as string | null,
  animationsEnabled: true,
  compactMode: false,
  fontSize: 16,
  currentTrack: null as Track | null,
  queue: [] as Track[],
  queueIndex: 0,
  isPlaying: false,
  volume: 70,
  progress: 0,
  duration: 0,
  shuffle: false,
  repeat: "off" as "off" | "all" | "one",
  playbackMode: "idle" as "soundcloud" | "idle",
  sleepTimerActive: false,
  sleepTimerMinutes: 30,
  sleepTimerRemaining: 0,
  sleepTimerEndTime: null as number | null,
  messages: [] as ChatMessage[],
  selectedContactId: null as string | null,
  unreadCounts: {} as Record<string, number>,
  contacts: [] as { id: string; name: string; username: string; avatar: string; online: boolean; lastSeen: string }[],
  searchQuery: "",
  selectedGenre: "",
  isLoading: false,
  isFullTrackViewOpen: false,
  likedTrackIds: [] as string[],
  dislikedTrackIds: [] as string[],
  likedTracksData: [] as Track[],
  isPiPActive: false,
  similarTracks: [] as Track[],
  similarTracksLoading: false,
  showSimilarRequested: false,
  playlists: [] as UserPlaylist[],
  selectedPlaylistId: null as string | null,
  history: [] as HistoryEntry[],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuth: (userId, username, email) =>
        set({ isAuthenticated: true, userId, username, email, currentView: "main" }),

      logout: () =>
        set({ ...initialState }),

      setView: (view) => set({ currentView: view }),

      setAuthStep: (step) => set({ authStep: step }),

      setTheme: (theme) => set({ currentTheme: theme }),

      setCustomAccent: (color) => set({ customAccent: color }),

      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),

      setCompactMode: (compact) => set({ compactMode: compact }),

      setFontSize: (size) => set({ fontSize: size }),

      playTrack: (track, queue) => {
        const state = get();
        const newQueue = queue || state.queue;
        const index = newQueue.findIndex((t) => t.id === track.id);
        set({
          currentTrack: track,
          queue: newQueue,
          queueIndex: index >= 0 ? index : 0,
          isPlaying: true,
          progress: 0,
          duration: track.duration,
        });
        // Auto-add to history
        get().addToHistory(track);
      },

      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

      setVolume: (volume) => set({ volume }),

      setProgress: (progress) => set({ progress }),

      setDuration: (duration) => set({ duration }),

      nextTrack: () => {
        const { queue, queueIndex, shuffle, repeat } = get();
        let nextIdx: number;
        if (shuffle) {
          nextIdx = Math.floor(Math.random() * queue.length);
        } else {
          nextIdx = queueIndex + 1;
          if (nextIdx >= queue.length) {
            if (repeat === "all") nextIdx = 0;
            else { set({ isPlaying: false }); return; }
          }
        }
        const track = queue[nextIdx];
        if (track) {
          set({
            currentTrack: track,
            queueIndex: nextIdx,
            progress: 0,
            duration: track.duration,
            isPlaying: true,
          });
          get().addToHistory(track);
        }
      },

      prevTrack: () => {
        const { queue, queueIndex, progress } = get();
        if (progress > 3) {
          set({ progress: 0 });
          return;
        }
        let prevIdx = queueIndex - 1;
        if (prevIdx < 0) prevIdx = queue.length - 1;
        const track = queue[prevIdx];
        if (track) {
          set({
            currentTrack: track,
            queueIndex: prevIdx,
            progress: 0,
            duration: track.duration,
            isPlaying: true,
          });
          get().addToHistory(track);
        }
      },

      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

      toggleRepeat: () =>
        set((s) => ({
          repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
        })),

      setPlaybackMode: (mode) => set({ playbackMode: mode }),

      startSleepTimer: (minutes) => {
        const endTime = Date.now() + minutes * 60 * 1000;
        set({
          sleepTimerActive: true,
          sleepTimerMinutes: minutes,
          sleepTimerRemaining: minutes * 60,
          sleepTimerEndTime: endTime,
        });
      },

      stopSleepTimer: () =>
        set({
          sleepTimerActive: false,
          sleepTimerRemaining: 0,
          sleepTimerEndTime: null,
        }),

      updateSleepTimer: () => {
        const { sleepTimerEndTime, sleepTimerActive } = get();
        if (!sleepTimerActive || !sleepTimerEndTime) return;
        const remaining = Math.max(0, Math.floor((sleepTimerEndTime - Date.now()) / 1000));
        if (remaining <= 0) {
          set({
            sleepTimerActive: false,
            sleepTimerRemaining: 0,
            sleepTimerEndTime: null,
            isPlaying: false,
          });
        } else {
          set({ sleepTimerRemaining: remaining });
        }
      },

      addMessage: (message) =>
        set((s) => ({ messages: [...s.messages, message] })),

      setSelectedContact: (contactId) => set({ selectedContactId: contactId, unreadCounts: { ...get().unreadCounts, [contactId]: 0 } }),

      loadMessages: (messages) => set({ messages }),

      clearUnread: (contactId) =>
        set((s) => ({ unreadCounts: { ...s.unreadCounts, [contactId]: 0 } })),

      addContact: (contact) =>
        set((s) => {
          if (s.contacts.some((c) => c.id === contact.id)) return s;
          return { contacts: [...s.contacts, contact] };
        }),

      deleteMessagesForContact: (contactId) =>
        set((s) => ({
          messages: s.messages.filter(
            (m) => m.senderId !== contactId && m.receiverId !== contactId
          ),
        })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSelectedGenre: (genre) => set({ selectedGenre: genre }),

      setIsLoading: (loading) => set({ isLoading: loading }),

      setFullTrackViewOpen: (open) => set({ isFullTrackViewOpen: open }),

      toggleLike: (trackId, trackData) => {
        const { likedTrackIds, dislikedTrackIds, likedTracksData } = get();
        if (likedTrackIds.includes(trackId)) {
          set({
            likedTrackIds: likedTrackIds.filter((id) => id !== trackId),
            likedTracksData: likedTracksData.filter((t) => t.id !== trackId),
          });
        } else {
          set({
            likedTrackIds: [...likedTrackIds, trackId],
            dislikedTrackIds: dislikedTrackIds.filter((id) => id !== trackId),
            likedTracksData: trackData
              ? [...likedTracksData.filter((t) => t.id !== trackId), trackData]
              : likedTracksData,
          });
        }
      },

      toggleDislike: (trackId) => {
        const { dislikedTrackIds, likedTrackIds, likedTracksData } = get();
        if (dislikedTrackIds.includes(trackId)) {
          set({ dislikedTrackIds: dislikedTrackIds.filter((id) => id !== trackId) });
        } else {
          set({
            dislikedTrackIds: [...dislikedTrackIds, trackId],
            likedTrackIds: likedTrackIds.filter((id) => id !== trackId),
            likedTracksData: likedTracksData.filter((t) => t.id !== trackId),
          });
        }
      },

      isTrackLiked: (trackId) => get().likedTrackIds.includes(trackId),

      isTrackDisliked: (trackId) => get().dislikedTrackIds.includes(trackId),

      setPiPActive: (active) => set({ isPiPActive: active }),

      setSimilarTracks: (tracks) => set({ similarTracks: tracks }),
      setSimilarTracksLoading: (loading) => set({ similarTracksLoading: loading }),
      requestShowSimilar: () => set({ showSimilarRequested: true, isFullTrackViewOpen: true }),
      clearShowSimilarRequest: () => set({ showSimilarRequested: false }),

      // ── Playlist actions ──
      createPlaylist: (name, description = "") => {
        const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newPlaylist: UserPlaylist = {
          id,
          name,
          description,
          cover: "",
          tracks: [],
          createdAt: Date.now(),
        };
        set((s) => ({ playlists: [...s.playlists, newPlaylist] }));
      },

      deletePlaylist: (playlistId) => {
        set((s) => ({
          playlists: s.playlists.filter((p) => p.id !== playlistId),
          selectedPlaylistId: s.selectedPlaylistId === playlistId ? null : s.selectedPlaylistId,
        }));
      },

      renamePlaylist: (playlistId, name) => {
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId ? { ...p, name } : p
          ),
        }));
      },

      addToPlaylist: (playlistId, track) => {
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            if (p.tracks.some((t) => t.id === track.id)) return p;
            const updatedTracks = [...p.tracks, track];
            return {
              ...p,
              tracks: updatedTracks,
              cover: track.cover || p.cover,
            };
          }),
        }));
      },

      removeFromPlaylist: (playlistId, trackId) => {
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            return {
              ...p,
              tracks: p.tracks.filter((t) => t.id !== trackId),
            };
          }),
        }));
      },

      setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id }),

      // ── History actions ──
      addToHistory: (track) => {
        set((s) => {
          // Remove existing entry for same track
          const filtered = s.history.filter((h) => h.track.id !== track.id);
          // Add to front, keep max 200 entries
          return {
            history: [{ track, playedAt: Date.now() }, ...filtered].slice(0, 200),
          };
        });
      },

      clearHistory: () => set({ history: [] }),

      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => {
        // Extra safety: wrap getItem so any parse error results in null
        if (typeof window === "undefined") return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        return {
          getItem: (key: string) => {
            try { return localStorage.getItem(key); } catch { return null; }
          },
          setItem: (key: string, val: string) => {
            try { localStorage.setItem(key, val); } catch {}
          },
          removeItem: (key: string) => {
            try { localStorage.removeItem(key); } catch {}
          },
        };
      }),
      partialize: (state) => ({
        currentTheme: state.currentTheme,
        customAccent: state.customAccent,
        animationsEnabled: state.animationsEnabled,
        compactMode: state.compactMode,
        fontSize: state.fontSize,
        volume: state.volume,
        isAuthenticated: state.isAuthenticated,
        userId: state.userId,
        username: state.username,
        email: state.email,
        avatar: state.avatar,
        messages: state.messages,
        unreadCounts: state.unreadCounts,
        contacts: state.contacts,
        currentView: state.currentView,
        likedTrackIds: state.likedTrackIds,
        dislikedTrackIds: state.dislikedTrackIds,
        likedTracksData: state.likedTracksData,
        playlists: state.playlists,
        history: state.history,
      }),
      migrate: (persisted: unknown, version: number) => {
        // On any version mismatch, start completely fresh
        console.warn(`[MQ Store] migrating from version ${version} to ${STORE_VERSION} — resetting`);
        return { ...initialState };
      },
      merge: (persisted, current) => {
        // If persisted is null/undefined (cleared by version check), use defaults
        if (!persisted) return current;
        const p = persisted as Record<string, unknown>;
        const merged = { ...current };
        // Only copy known state keys from persisted data
        for (const key of Object.keys(initialState)) {
          if (p[key] !== undefined) {
            (merged as Record<string, unknown>)[key] = p[key];
          }
        }
        return merged;
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("[MQ Store] rehydration error – clearing localStorage:", error);
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
            return;
          }
          if (!state) return;
          // Validate every critical field – belt and suspenders
          const s = state as Record<string, unknown>;
          const fixes: Record<string, unknown> = {};
          if (!Array.isArray(s.likedTrackIds)) fixes.likedTrackIds = [];
          if (!Array.isArray(s.dislikedTrackIds)) fixes.dislikedTrackIds = [];
          if (!Array.isArray(s.likedTracksData)) fixes.likedTracksData = [];
          if (!Array.isArray(s.queue)) fixes.queue = [];
          if (!Array.isArray(s.history)) fixes.history = [];
          if (!Array.isArray(s.playlists)) fixes.playlists = [];
          if (!Array.isArray(s.messages)) fixes.messages = [];
          if (!Array.isArray(s.contacts)) fixes.contacts = [];
          if (!Array.isArray(s.similarTracks)) fixes.similarTracks = [];
          if (typeof s.currentTheme !== "string" || !s.currentTheme) fixes.currentTheme = "default";
          if (typeof s.volume !== "number") fixes.volume = 70;
          if (typeof s.fontSize !== "number") fixes.fontSize = 16;
          if (typeof s.shuffle !== "boolean") fixes.shuffle = false;
          if (typeof s.repeat !== "string") fixes.repeat = "off";
          if (typeof s.queueIndex !== "number") fixes.queueIndex = 0;
          if (Object.keys(fixes).length > 0) {
            console.warn("[MQ Store] fixing missing fields:", Object.keys(fixes));
            useAppStore.setState(fixes);
          }
        };
      },
    }
  )
);
