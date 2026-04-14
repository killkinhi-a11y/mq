import { NextResponse } from "next/server";
import { searchSCTracks } from "@/lib/soundcloud";

/**
 * Trending tracks — SoundCloud popular search.
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

const trendingQueries = [
  "popular music 2025",
  "trending hits",
  "new music this week",
  "top charts 2025",
  "viral hits 2025",
];

export async function GET() {
  const cacheKey = "trending:sc";
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // Pick 2 random trending queries
    const shuffled = trendingQueries.sort(() => Math.random() - 0.5).slice(0, 2);

    const results = await Promise.allSettled(
      shuffled.map((q) => searchSCTracks(q, 15))
    );

    const allTracks: ReturnType<typeof searchSCTracks> extends Promise<infer T> ? T : never = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const track of result.value) {
        if (seenIds.has(track.scTrackId)) continue;
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    // Shuffle and take top 20
    const responseData = { tracks: allTracks.sort(() => Math.random() - 0.5).slice(0, 20) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
