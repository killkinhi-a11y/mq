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
  source: "soundcloud";
  scTrackId?: number;
  scStreamPolicy?: string;
  scIsFull?: boolean;
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
  "House": "Электроника",
  "Techno": "Электроника",
  "Drum and Bass": "Электроника",
  "Ambient": "Электроника",
  "Lo-fi": "Инди",
  "Trap": "Хип-хоп",
  "R&B Soul": "R&B",
  "Pop R&B": "R&B",
};

export const mockContacts: Contact[] = [
  { id: "c1", name: "Александр", username: "alex_s", avatar: "https://picsum.photos/seed/avatar1/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c2", name: "Мария", username: "masha_m", avatar: "https://picsum.photos/seed/avatar2/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c3", name: "Дмитрий", username: "dima_d", avatar: "https://picsum.photos/seed/avatar3/100/100", online: false, lastSeen: "2 часа назад" },
  { id: "c4", name: "Елена", username: "elena_k", avatar: "https://picsum.photos/seed/avatar4/100/100", online: false, lastSeen: "Вчера" },
  { id: "c5", name: "Максим", username: "max_v", avatar: "https://picsum.photos/seed/avatar5/100/100", online: true, lastSeen: "Сейчас" },
];

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
