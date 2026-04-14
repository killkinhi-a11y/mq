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
  "top 50 worldwide",
  "billboard hot 100",
  "most played 2025",
  "viral hits 2025",
  "global top 50",
  "best hip hop 2025",
  "electronic dance music",
  "pop music hits",
  "indie alternative hits",
  "r&b soul 2025",
  "rock music playlist",
  "lofi hip hop radio",
  "deep house mix",
  "latin music top",
  "k-pop hits 2025",
  "uk drill 2025",
  "afrobeats mix",
  "synthwave playlist",
  "chill vibes 2025",
  "workout motivation music",
  "party mix 2025",
  "acoustic covers popular",
  "jazz lofi beats",
  "drum and bass mix",
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
        if (!track.cover) continue; // Filter out tracks without artwork
        // Skip very short tracks (< 30s) — likely intros/previews
        if (track.duration && track.duration < 30) continue;
        // Prefer full tracks over previews
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    // Sort: prefer full tracks, longer duration, then shuffle for variety
    const sorted = allTracks.sort((a, b) => {
      if (a.scIsFull && !b.scIsFull) return -1;
      if (!a.scIsFull && b.scIsFull) return 1;
      // Prefer longer tracks
      const durA = a.duration || 0;
      const durB = b.duration || 0;
      if (durA > 180 && durB <= 180) return -1;
      if (durB > 180 && durA <= 180) return 1;
      return Math.random() - 0.5;
    });
    const responseData = { tracks: sorted.slice(0, 25) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
