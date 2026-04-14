export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  cover: string;
  genre: string;
  audioUrl: string;
  previewUrl?: string;
  youtubeId?: string;
  source: "deezer" | "youtube" | "itunes" | "saavn" | "audius";
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string;
  tracks: Track[];
  genre: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  encrypted: boolean;
  createdAt: string;
  senderName?: string;
}

export interface Contact {
  id: string;
  name: string;
  username: string;
  avatar: string;
  online: boolean;
  lastSeen: string;
}

export const genresList = ["Pop", "Rock", "Electronic", "Hip-Hop", "Jazz", "Classical", "R&B", "Indie"];

export const genreDeezerIds: Record<string, number> = {
  "Поп": 132,
  "Рок": 152,
  "Электроника": 113,
  "Хип-хоп": 116,
  "Джаз": 129,
  "Классика": 98,
  "R&B": 165,
  "Инди": 85,
  "Pop": 132,
  "Rock": 152,
  "Electronic": 113,
  "Hip-Hop": 116,
  "Jazz": 129,
  "Classical": 98,
  "R&B": 165,
  "Indie": 85,
};

export const mockContacts: Contact[] = [
  { id: "c1", name: "Александр", username: "alex_s", avatar: "https://picsum.photos/seed/avatar1/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c2", name: "Мария", username: "masha_m", avatar: "https://picsum.photos/seed/avatar2/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c3", name: "Дмитрий", username: "dima_d", avatar: "https://picsum.photos/seed/avatar3/100/100", online: false, lastSeen: "2 часа назад" },
  { id: "c4", name: "Елена", username: "elena_k", avatar: "https://picsum.photos/seed/avatar4/100/100", online: false, lastSeen: "Вчера" },
  { id: "c5", name: "Максим", username: "max_v", avatar: "https://picsum.photos/seed/avatar5/100/100", online: true, lastSeen: "Сейчас" },
];

// Deezer genre mapping for display
export const genreMapReverse: Record<string, string> = {
  "Pop": "Поп",
  "Rock": "Рок",
  "Electronic": "Электроника",
  "Hip-Hop": "Хип-хоп",
  "Jazz": "Джаз",
  "Classical": "Классика",
  "R&B": "R&B",
  "Indie": "Инди",
  "Rap": "Хип-хоп",
  "Dance": "Электроника",
  "Alternative": "Рок",
  "Soul & Funk": "R&B",
  "Metal": "Рок",
};

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string; id: number };
  album: { title: string; cover_medium: string; cover_big: string; cover: string };
  duration: number;
  preview: string;
  genre_id?: number;
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
}

interface DeezerChartResponse {
  data: DeezerTrack[];
  total: number;
}

export function getLargeArtwork(url: string): string {
  if (!url) return "https://picsum.photos/seed/default/300/300";
  // Deezer covers: replace _250 or _500 with _500
  return url.replace(/_\d+x\d+(-bb)?/, "_500x500");
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function transformDeezerTrack(item: DeezerTrack, genre?: string): Track {
  return {
    id: String(item.id),
    title: item.title || "Unknown Track",
    artist: item.artist?.name || "Unknown Artist",
    album: item.album?.title || "Unknown Album",
    duration: item.duration || 30,
    cover: item.album?.cover_big || item.album?.cover_medium || item.album?.cover || "https://picsum.photos/seed/default/300/300",
    genre: genre || genreMapReverse[item.title] || "Другое",
    audioUrl: "", // will be fetched via YouTube
    previewUrl: item.preview || "",
    source: "deezer",
  };
}

export async function searchTracks(query: string): Promise<Track[]> {
  try {
    const res = await fetch(
      `/api/music/search?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks || [];
  } catch {
    return [];
  }
}

export async function getTrendingTracks(): Promise<Track[]> {
  try {
    const res = await fetch("/api/music/trending");
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks || [];
  } catch {
    return [];
  }
}

export async function getRecommendations(genre?: string): Promise<Track[]> {
  try {
    const params = genre ? `?genre=${encodeURIComponent(genre)}` : "?genre=random";
    const res = await fetch(`/api/music/recommendations${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks || [];
  } catch {
    return [];
  }
}

export async function getTracksByGenre(genre: string): Promise<Track[]> {
  try {
    const res = await fetch(
      `/api/music/genre?genre=${encodeURIComponent(genre)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks || [];
  } catch {
    return [];
  }
}

export function mapGenreToRu(genre: string): string {
  return genreMapReverse[genre] || genre;
}
