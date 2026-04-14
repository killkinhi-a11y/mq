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
  "pop hits 2025",
  "top charts",
  "best music 2025",
  "hip hop hits",
  "electronic dance",
  "indie favorites",
  "r&b soul hits",
  "rock anthems",
  "lofi chill beats",
  "deep house 2025",
  "latin music hits",
  "k-pop 2025",
  "uk drill",
  "afrobeats 2025",
  "synthwave retro",
];

export async function GET() {
  const cacheKey = "trending:sc";
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // Pick 4 random trending queries for more variety
    const shuffled = trendingQueries.sort(() => Math.random() - 0.5).slice(0, 4);

    const results = await Promise.allSettled(
      shuffled.map((q) => searchSCTracks(q, 25))
    );

    const allTracks: ReturnType<typeof searchSCTracks> extends Promise<infer T> ? T : never = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const track of result.value) {
        if (seenIds.has(track.scTrackId)) continue;
        if (!track.cover) continue; // Filter out tracks without artwork for better quality
        // Prefer full tracks over previews
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    // Sort: prefer full tracks, then shuffle for variety
    const sorted = allTracks.sort((a, b) => {
      if (a.scIsFull && !b.scIsFull) return -1;
      if (!a.scIsFull && b.scIsFull) return 1;
      return Math.random() - 0.5;
    });
    const responseData = { tracks: sorted.slice(0, 25) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
