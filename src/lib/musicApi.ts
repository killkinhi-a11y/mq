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
  avatar: string;
  online: boolean;
  lastSeen: string;
}

export const genresList = ["Pop", "Rock", "Electronic", "Hip-Hop", "Jazz", "Classical", "R&B", "Indie"];

export const mockContacts: Contact[] = [
  { id: "c1", name: "Александр", avatar: "https://picsum.photos/seed/avatar1/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c2", name: "Мария", avatar: "https://picsum.photos/seed/avatar2/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c3", name: "Дмитрий", avatar: "https://picsum.photos/seed/avatar3/100/100", online: false, lastSeen: "2 часа назад" },
  { id: "c4", name: "Елена", avatar: "https://picsum.photos/seed/avatar4/100/100", online: false, lastSeen: "Вчера" },
  { id: "c5", name: "Максим", avatar: "https://picsum.photos/seed/avatar5/100/100", online: true, lastSeen: "Сейчас" },
];

// Genre mapping: Russian -> English (for iTunes API)
export const genreMap: Record<string, string> = {
  "Поп": "Pop",
  "Рок": "Rock",
  "Электроника": "Electronic",
  "Хип-хоп": "Hip-Hop",
  "Джаз": "Jazz",
  "Классика": "Classical",
  "R&B": "R&B",
  "Инди": "Indie",
  "Pop": "Pop",
  "Rock": "Rock",
  "Electronic": "Electronic",
  "Hip-Hop": "Hip-Hop",
  "Jazz": "Jazz",
  "Classical": "Classical",
  "Indie": "Indie",
};

// Reverse genre mapping: English -> Russian (for UI display)
export const genreMapReverse: Record<string, string> = {
  "Pop": "Поп",
  "Rock": "Рок",
  "Electronic": "Электроника",
  "Hip-Hop": "Хип-хоп",
  "Jazz": "Джаз",
  "Classical": "Классика",
  "R&B": "R&B",
  "Indie": "Инди",
};

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
  primaryGenreName: string;
  kind: string;
}

interface ITunesResponse {
  results: ITunesResult[];
  resultCount: number;
}

function transformTrack(item: ITunesResult): Track {
  return {
    id: String(item.trackId),
    title: item.trackName || "Unknown Track",
    artist: item.artistName || "Unknown Artist",
    album: item.collectionName || "Unknown Album",
    duration: Math.round((item.trackTimeMillis || 30000) / 1000),
    cover: getLargeArtwork(item.artworkUrl100 || ""),
    genre: genreMapReverse[item.primaryGenreName] || item.primaryGenreName || "Другое",
    audioUrl: item.previewUrl || "",
    previewUrl: item.previewUrl,
  };
}

export function getLargeArtwork(url: string): string {
  if (!url) return "https://picsum.photos/seed/default/300/300";
  return url.replace("100x100bb", "300x300bb");
}

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

export async function getTracksByGenre(genre: string): Promise<Track[]> {
  try {
    const mappedGenre = genreMap[genre] || genre;
    const res = await fetch(
      `/api/music/genre?genre=${encodeURIComponent(mappedGenre)}`
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
