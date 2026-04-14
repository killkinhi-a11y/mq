import { NextRequest, NextResponse } from "next/server";
import { searchSCTracks } from "@/lib/soundcloud";

/**
 * Smart Recommendations API — generates recommendations based on user taste profile.
 * Accepts: genres[], artists[], excludeIds[]
 * Falls back to random discovery if no taste data.
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
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiry <= now) cache.delete(k);
    }
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

const fallbackQueries = [
  "chill vibes",
  "lofi hip hop",
  "deep house mix",
  "indie acoustic",
  "ambient electronic",
  "soul r&b new",
  "synthwave retro",
  "jazz lounge",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre") || "random";
  const genresParam = searchParams.get("genres");
  const artistsParam = searchParams.get("artists");
  const excludeParam = searchParams.get("excludeIds");

  const excludeIds = new Set(
    (excludeParam || "").split(",").filter(Boolean)
  );

  // Parse taste data
  const genres: string[] = genresParam
    ? genresParam.split(",").filter(Boolean)
    : [];
  const artists: string[] = artistsParam
    ? artistsParam.split(",").filter(Boolean).slice(0, 3)
    : [];

  // Build cache key from taste profile
  const tasteKey = `${genre}:${genresParam || ""}:${artistsParam || ""}`;
  const cacheKey = `rec:smart:${tasteKey}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let queries: string[] = [];

    if (genres.length > 0 || artists.length > 0) {
      // Taste-based recommendations
      for (const g of genres.slice(0, 3)) {
        queries.push(`${g} new music 2025`);
      }
      for (const a of artists) {
        queries.push(`${a} similar artists`);
      }
      // Add some variety
      if (genres.length > 0) {
        queries.push(`${genres[0]} mix`);
      }
    } else if (genre !== "random") {
      queries = [`${genre} new music`, `${genre} popular 2025`];
    } else {
      // Fallback: random discovery
      queries = [...fallbackQueries].sort(() => Math.random() - 0.5).slice(0, 3);
    }

    // Deduplicate and limit queries
    queries = [...new Set(queries)].slice(0, 4);

    const results = await Promise.allSettled(
      queries.map((q) => searchSCTracks(q, 10))
    );

    const allTracks: Awaited<ReturnType<typeof searchSCTracks>> = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const track of result.value) {
        // Skip excluded tracks
        if (excludeIds.has(track.id)) continue;
        if (seenIds.has(track.scTrackId)) continue;
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    const responseData = { tracks: allTracks.sort(() => Math.random() - 0.5).slice(0, 15) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
