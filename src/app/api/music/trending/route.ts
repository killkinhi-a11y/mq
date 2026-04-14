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
  "new music",
  "popular",
  "viral",
  "hit 2025",
  "trending music",
  "top hits",
  "billboard",
  "radio edit",
  "official audio",
  "best of",
  "mix 2025",
  "chart toppers",
  "most played",
  "music release",
  "hot new music",
  "spotify hits",
  "music 2025",
  "electronic music",
  "hip hop 2025",
  "pop music",
];

export async function GET() {
  const cacheKey = "trending:sc:v2";
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // Pick 5 random trending queries for variety
    const shuffled = trendingQueries.sort(() => Math.random() - 0.5).slice(0, 5);

    const results = await Promise.allSettled(
      shuffled.map((q) => searchSCTracks(q, 20))
    );

    const allTracks: ReturnType<typeof searchSCTracks> extends Promise<infer T> ? T : never = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const track of result.value) {
        if (seenIds.has(track.scTrackId)) continue;
        if (!track.cover) continue; // Filter tracks without artwork
        // Prefer full tracks over previews — give full tracks high score
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    // Sort: full tracks first, then by duration (longer = better quality), then shuffle
    const sorted = allTracks.sort((a, b) => {
      if (a.scIsFull && !b.scIsFull) return -1;
      if (!a.scIsFull && b.scIsFull) return 1;
      // Among same type, prefer longer tracks
      const durationDiff = (b.duration || 0) - (a.duration || 0);
      if (Math.abs(durationDiff) > 30) return durationDiff > 0 ? -1 : 1;
      return Math.random() - 0.5;
    });
    const responseData = { tracks: sorted.slice(0, 30) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
