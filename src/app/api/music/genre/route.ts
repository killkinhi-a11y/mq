import { NextRequest, NextResponse } from "next/server";

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
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(genre.trim())}&media=music&limit=15&country=RU`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 420 },
    });

    if (!res.ok) {
      return NextResponse.json({ tracks: [] }, { status: 200 });
    }

    const data = await res.json();
    const tracks: ITunesResult[] = (data.results || []).filter(
      (item: ITunesResult) => item.kind === "song" && item.previewUrl
    );

    const transformed = tracks.map((item) => ({
      id: String(item.trackId),
      title: item.trackName || "Unknown Track",
      artist: item.artistName || "Unknown Artist",
      album: item.collectionName || "Unknown Album",
      duration: Math.round((item.trackTimeMillis || 30000) / 1000),
      cover: (item.artworkUrl100 || "").replace("100x100bb", "300x300bb") || "https://picsum.photos/seed/default/300/300",
      genre: item.primaryGenreName || genre,
      audioUrl: item.previewUrl || "",
      previewUrl: item.previewUrl,
    }));

    const responseData = { tracks: transformed };
    setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
