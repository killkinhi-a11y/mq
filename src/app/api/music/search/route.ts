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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const cacheKey = `search:${query.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&media=music&limit=20&country=RU`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 },
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
      genre: item.primaryGenreName || "Другое",
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
