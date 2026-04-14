import { NextRequest, NextResponse } from "next/server";
import { searchSCTracks } from "@/lib/soundcloud";

/**
 * Recommendations — SoundCloud discovery queries.
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

const recQueries = [
  "chill vibes",
  "lofi hip hop",
  "deep house mix",
  "indie acoustic",
  "ambient electronic",
  "soul r&b new",
  "synthwave retro",
  "jazz lounge",
  "drum and bass",
  "folk acoustic",
  "pop hits new",
  "rock alternative",
  "techno underground",
  "trap beats",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre") || "random";

  const cacheKey = `rec:sc:${genre}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let queries: string[];
    if (genre !== "random") {
      queries = [`${genre} new music`, `${genre} popular`];
    } else {
      queries = recQueries.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    const results = await Promise.allSettled(
      queries.map((q) => searchSCTracks(q, 10))
    );

    const allTracks: Awaited<ReturnType<typeof searchSCTracks>> = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const track of result.value) {
        if (seenIds.has(track.scTrackId)) continue;
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    const responseData = { tracks: allTracks.sort(() => Math.random() - 0.5).slice(0, 12) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
