import { NextRequest, NextResponse } from "next/server";

/**
 * Recommendations — FAST version (iTunes only, no YouTube scraping).
 */

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 8 * 60 * 1000;

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
  const genre = searchParams.get("genre") || "random";

  const cacheKey = `rec:v2:${genre}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const queries = ["trending pop", "new rock", "electronic dance", "hip hop new", "indie fresh"];
    const shuffled = queries.sort(() => Math.random() - 0.5).slice(0, 2);

    const allTracks = [];
    const seenIds = new Set<string>();

    const results = await Promise.allSettled(
      shuffled.map((q) =>
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
        ).then((r) => (r.ok ? r.json() : { results: [] }))
      )
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const t of result.value.results || []) {
        if (!t.previewUrl || seenIds.has(String(t.trackId))) continue;
        seenIds.add(String(t.trackId));
        allTracks.push({
          id: `itunes_${t.trackId}`,
          title: t.trackName || "Unknown",
          artist: t.artistName || "Unknown",
          album: t.collectionName || "Unknown",
          duration: Math.round((t.trackTimeMillis || 30000) / 1000),
          cover: (t.artworkUrl100 || "").replace("100x100bb", "500x500bb"),
          audioUrl: t.previewUrl,
          previewUrl: t.previewUrl,
          source: "itunes",
        });
      }
    }

    const responseData = { tracks: allTracks.sort(() => Math.random() - 0.5).slice(0, 12) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
