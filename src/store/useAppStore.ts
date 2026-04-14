import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Track, type Message as ChatMessage, mockContacts } from "@/lib/musicApi";

export type ViewType = "auth" | "main" | "search" | "messenger" | "settings" | "profile";
export type AuthStep = "login" | "register" | "confirm" | "confirmed";

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

  // Search
  searchQuery: string;
  selectedGenre: string;
  isLoading: boolean;

  // Full-screen track view
  isFullTrackViewOpen: boolean;

  // Likes/Dislikes
  likedTrackIds: string[];
  dislikedTrackIds: string[];

  // PiP
  isPiPActive: boolean;

  // Similar tracks panel
  similarTracks: Track[];
  similarTracksLoading: boolean;

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

  // Search actions
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string) => void;
  setIsLoading: (loading: boolean) => void;

  // Full-screen track view actions
  setFullTrackViewOpen: (open: boolean) => void;

  // Like/Dislike actions
  toggleLike: (trackId: string) => void;
  toggleDislike: (trackId: string) => void;
  isTrackLiked: (trackId: string) => boolean;
  isTrackDisliked: (trackId: string) => boolean;

  // PiP actions
  setPiPActive: (active: boolean) => void;

  // Similar tracks actions
  setSimilarTracks: (tracks: Track[]) => void;
  setSimilarTracksLoading: (loading: boolean) => void;

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
  searchQuery: "",
  selectedGenre: "",
  isLoading: false,
  isFullTrackViewOpen: false,
  likedTrackIds: [] as string[],
  dislikedTrackIds: [] as string[],
  isPiPActive: false,
  similarTracks: [] as Track[],
  similarTracksLoading: false,
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

      setSelectedContact: (contactId) => set({ selectedContactId: contactId }),

      loadMessages: (messages) => set({ messages }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSelectedGenre: (genre) => set({ selectedGenre: genre }),

      setIsLoading: (loading) => set({ isLoading: loading }),

      setFullTrackViewOpen: (open) => set({ isFullTrackViewOpen: open }),

      toggleLike: (trackId) => {
        const { likedTrackIds, dislikedTrackIds } = get();
        if (likedTrackIds.includes(trackId)) {
          set({ likedTrackIds: likedTrackIds.filter((id) => id !== trackId) });
        } else {
          set({
            likedTrackIds: [...likedTrackIds, trackId],
            dislikedTrackIds: dislikedTrackIds.filter((id) => id !== trackId),
          });
        }
      },

      toggleDislike: (trackId) => {
        const { dislikedTrackIds, likedTrackIds } = get();
        if (dislikedTrackIds.includes(trackId)) {
          set({ dislikedTrackIds: dislikedTrackIds.filter((id) => id !== trackId) });
        } else {
          set({
            dislikedTrackIds: [...dislikedTrackIds, trackId],
            likedTrackIds: likedTrackIds.filter((id) => id !== trackId),
          });
        }
      },

      isTrackLiked: (trackId) => get().likedTrackIds.includes(trackId),

      isTrackDisliked: (trackId) => get().dislikedTrackIds.includes(trackId),

      setPiPActive: (active) => set({ isPiPActive: active }),

      setSimilarTracks: (tracks) => set({ similarTracks: tracks }),
      setSimilarTracksLoading: (loading) => set({ similarTracksLoading: loading }),

      reset: () => set(initialState),
    }),
    {
      name: "mq-player-store",
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
        currentView: state.currentView,
        likedTrackIds: state.likedTrackIds,
        dislikedTrackIds: state.dislikedTrackIds,
      }),
    }
  )
);
