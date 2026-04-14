import { NextRequest, NextResponse } from "next/server";

/**
 * Genre search — FAST version (Deezer only, no YouTube scraping).
 */

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 7 * 60 * 1000;

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
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

  const cacheKey = `genre:v2:${genre.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(genre.trim())}&limit=20`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) return NextResponse.json({ tracks: [] });

    const data = await res.json();
    const tracks = data.data || [];
    if (tracks.length === 0) return NextResponse.json({ tracks: [] });

    const transformed = tracks.map((item: Record<string, unknown>) => {
      const album = item.album as Record<string, unknown> | undefined;
      const artist = item.artist as Record<string, unknown> | undefined;
      return {
        id: `dz_${item.id}`,
        title: item.title || "Unknown Track",
        artist: artist?.name || "Unknown Artist",
        album: album?.title || "Unknown Album",
        duration: (item.duration as number) || 30,
        cover: (album?.cover_big || album?.cover_medium || "https://picsum.photos/seed/default/300/300") as string,
        genre: genre,
        audioUrl: (item.preview || "") as string,
        previewUrl: (item.preview || "") as string,
        source: "deezer" as const,
      };
    });

    const responseData = { tracks: transformed.slice(0, 20) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
