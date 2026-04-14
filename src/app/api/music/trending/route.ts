import { NextResponse } from "next/server";

/**
 * Trending tracks — FAST version (iTunes only, no YouTube scraping).
 * YouTube videoIds resolved client-side.
 */

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export async function GET() {
  const cacheKey = "trending:v2";
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const res = await fetch(
      "https://itunes.apple.com/search?term=top+hits+2025&media=music&limit=25",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json({ tracks: [] });

    const data = await res.json();
    const tracks = (data.results || [])
      .filter((t) => t.previewUrl)
      .map((t) => ({
        id: `itunes_${t.trackId}`,
        title: t.trackName || "Unknown Track",
        artist: t.artistName || "Unknown Artist",
        album: t.collectionName || "Unknown Album",
        duration: Math.round((t.trackTimeMillis || 30000) / 1000),
        cover: (t.artworkUrl100 || "").replace("100x100bb", "500x500bb"),
        audioUrl: t.previewUrl,
        previewUrl: t.previewUrl,
        source: "itunes" as const,
      }));

    const responseData = { tracks: tracks.slice(0, 20) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
