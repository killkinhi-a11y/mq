import { NextRequest, NextResponse } from "next/server";

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string; id: number };
  album: { title: string; cover_medium: string; cover_big: string; cover: string };
  duration: number;
  preview: string;
}

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 7 * 60 * 1000; // 7 minutes

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

const genreIds: Record<string, number> = {
  "Поп": 132,
  "Рок": 152,
  "Электроника": 113,
  "Хип-хоп": 116,
  "R&B": 165,
  "Джаз": 129,
  "Классика": 98,
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");

  if (!genre || genre.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const cacheKey = `genre:${genre.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Use Deezer search with genre keyword
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(genre.trim())}&limit=15`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ tracks: [] }, { status: 200 });
    }

    const data = await res.json();
    const tracks: DeezerTrack[] = data.data || [];

    const transformed = tracks.map((item) => ({
      id: String(item.id),
      title: item.title || "Unknown Track",
      artist: item.artist?.name || "Unknown Artist",
      album: item.album?.title || "Unknown Album",
      duration: item.duration || 30,
      cover: item.album?.cover_big || item.album?.cover_medium || "https://picsum.photos/seed/default/300/300",
      genre: genre,
      audioUrl: "",
      previewUrl: item.preview || "",
      source: "deezer" as const,
    }));

    const responseData = { tracks: transformed };
    setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
