import { NextRequest, NextResponse } from "next/server";
import { searchSCTracks } from "@/lib/soundcloud";

/**
 * Smart Recommendations API — generates recommendations based on user taste profile.
 * Accepts: genres[], artists[], excludeIds[]
 * Falls back to random discovery if no taste data.
 * 
 * IMPROVEMENTS:
 * - Dynamic TTL based on content freshness
 * - Fisher-Yates shuffle for better randomness
 * - Comprehensive error logging
 * - Graceful degradation with fallback
 * - Diversity scoring to avoid duplicates
 */

const cache = new Map<string, { data: unknown; expiry: number; timestamp: number }>();
const BASE_CACHE_TTL = 8 * 60 * 1000; // 8 minutes base
const MIN_CACHE_SIZE = 20;
const MAX_CACHE_SIZE = 150;

// Logger utility
const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[Recommendations] ${message}`, data ? JSON.stringify(data) : "");
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[Recommendations] ${message}`, data ? JSON.stringify(data) : "");
  },
  error: (message: string, error?: unknown) => {
    console.error(`[Recommendations] ${message}`, error instanceof Error ? error.message : error);
  },
};

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

function setCache(key: string, data: unknown, dynamicTTL?: number): void {
  // Cache eviction: remove expired entries first
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiry <= now) cache.delete(k);
  }
  
  // If cache is too large, remove oldest entries
  if (cache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.max(MIN_CACHE_SIZE, Math.floor(MAX_CACHE_SIZE * 0.3));
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
  }
  
  const ttl = dynamicTTL ?? BASE_CACHE_TTL;
  cache.set(key, { data, expiry: now + ttl, timestamp: now });
}

// Fisher-Yates shuffle for better randomness
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Calculate diversity score to avoid similar tracks
function calculateDiversityScore(
  track: Awaited<ReturnType<typeof searchSCTracks>>[0],
  existingTracks: Awaited<ReturnType<typeof searchSCTracks>>
): number {
  let score = 1;
  
  // Penalize same artist
  const sameArtistCount = existingTracks.filter(t => t.artist === track.artist).length;
  score -= sameArtistCount * 0.3;
  
  // Penalize same genre
  const sameGenreCount = existingTracks.filter(t => t.genre === track.genre).length;
  score -= sameGenreCount * 0.2;
  
  // Bonus for having artwork
  if (track.cover) score += 0.1;
  
  // Bonus for reasonable duration
  if (track.duration && track.duration >= 120 && track.duration <= 400) score += 0.1;
  
  return Math.max(0.1, score);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre") || "random";
  const genresParam = searchParams.get("genres");
  const artistsParam = searchParams.get("artists");
  const excludeParam = searchParams.get("excludeIds");
  const dislikedParam = searchParams.get("dislikedIds");
  const dislikedArtistsParam = searchParams.get("dislikedArtists");
  const dislikedGenresParam = searchParams.get("dislikedGenres");

  const excludeIds = new Set(
    (excludeParam || "").split(",").filter(Boolean)
  );
  const dislikedIds = new Set(
    (dislikedParam || "").split(",").filter(Boolean)
  );

  // Artists/genres to avoid from disliked tracks
  const dislikedArtists = new Set(
    (dislikedArtistsParam || "").split(",").filter(Boolean).map(a => a.toLowerCase())
  );
  const dislikedGenres = new Set(
    (dislikedGenresParam || "").split(",").filter(Boolean).map(g => g.toLowerCase())
  );

  const genres: string[] = genresParam ? genresParam.split(",").filter(Boolean) : [];
  const artists: string[] = artistsParam ? artistsParam.split(",").filter(Boolean).slice(0, 3) : [];

  const tasteKey = `${genre}:${genresParam || ""}:${artistsParam || ""}:${dislikedParam || ""}`;
  const cacheKey = `rec:smart:${tasteKey}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let queries: string[] = [];

    if (genres.length > 0 || artists.length > 0) {
      // Taste-based: search for specific genres and artists
      for (const g of genres.slice(0, 3)) {
        queries.push(g);  // Simple genre search works better
      }
      for (const a of artists.slice(0, 2)) {
        queries.push(a);
      }
      // Add related searches
      if (genres.length > 0) {
        queries.push(`${genres[0]} 2025`);
        queries.push(`best ${genres[0]}`);
      }
    } else if (genre !== "random") {
      queries = [genre, `${genre} 2025`, `top ${genre}`];
    } else {
      // Better fallback: popular/trending searches
      const fallbacks = [
        "new music", "trending", "popular", "chill", "lofi",
        "electronic", "indie", "hip hop", "rock", "jazz",
        "ambient", "deep house", "synthwave", "r&b soul",
        "drum and bass", "techno", "acoustic", "piano"
      ];
      queries = fallbacks.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    queries = [...new Set(queries)].slice(0, 4);

    logger.info(`Fetching recommendations`, { queries, genresCount: genres.length, artistsCount: artists.length });

    const results = await Promise.allSettled(
      queries.map((q) => searchSCTracks(q, 12))
    );

    // Log any failed queries
    const failedQueries = results
      .map((r, i) => r.status === "rejected" ? queries[i] : null)
      .filter(Boolean);
    if (failedQueries.length > 0) {
      logger.warn(`Some queries failed`, { failed: failedQueries });
    }

    const allTracks: Awaited<ReturnType<typeof searchSCTracks>> = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const track of result.value) {
        if (excludeIds.has(track.id)) continue;
        if (seenIds.has(track.scTrackId)) continue;
        // Filter out tracks from disliked artists
        if (dislikedArtists.size > 0 && track.artist && dislikedArtists.has(track.artist.toLowerCase())) continue;
        // Filter out tracks from disliked genres
        if (dislikedGenres.size > 0 && track.genre && dislikedGenres.has(track.genre.toLowerCase())) continue;
        // Also filter disliked tracks by id
        if (dislikedIds.has(track.id)) continue;
        // Filter out tracks without artwork for better quality
        if (!track.cover) continue;
        // Skip very short tracks
        if (track.duration && track.duration < 30) continue;
        seenIds.add(track.scTrackId);
        allTracks.push(track);
      }
    }

    logger.info(`Collected ${allTracks.length} tracks before diversity filtering`);

    // Apply diversity-aware selection
    let selectedTracks: typeof allTracks = [];
    const candidatePool = shuffleArray(allTracks);
    
    for (const track of candidatePool) {
      if (selectedTracks.length >= 15) break;
      
      const diversityScore = calculateDiversityScore(track, selectedTracks);
      
      // Only add if diversity score is acceptable
      if (diversityScore >= 0.5 || selectedTracks.length < 5) {
        selectedTracks.push(track);
      }
    }

    // If we don't have enough diverse tracks, fill with remaining
    if (selectedTracks.length < 15) {
      const remaining = candidatePool.filter(t => !selectedTracks.includes(t));
      selectedTracks = [...selectedTracks, ...remaining.slice(0, 15 - selectedTracks.length)];
    }

    // Calculate dynamic TTL based on content
    // More tracks = longer cache, fewer tracks = shorter cache (more likely to change)
    const dynamicTTL = selectedTracks.length >= 10 
      ? BASE_CACHE_TTL * 1.5  // 12 minutes for good results
      : BASE_CACHE_TTL * 0.7; // ~5.5 minutes for sparse results

    const responseData = { tracks: selectedTracks };
    setCache(cacheKey, responseData, dynamicTTL);
    
    logger.info(`Returning ${selectedTracks.length} recommendations`, { 
      cacheTTL: Math.round(dynamicTTL / 60000), 
      diversityApplied: true 
    });
    
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error(`Failed to fetch recommendations`, error);
    
    // Graceful degradation: try to return cached fallback or empty array
    const fallbackKey = `rec:smart:random::`;
    const cachedFallback = getFromCache(fallbackKey);
    if (cachedFallback) {
      logger.info(`Returning cached fallback due to error`);
      return NextResponse.json(cachedFallback, { status: 200 });
    }
    
    // Return empty array with 200 status (not 500) to avoid breaking UI
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
