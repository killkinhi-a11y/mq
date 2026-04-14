import { NextRequest, NextResponse } from "next/server";

/**
 * JioSaavn API proxy - returns full-track audio URLs.
 * JioSaavn provides free, unencrypted MP3 streams for most songs.
 * No authentication required.
 */

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiry <= now) cache.delete(k);
    }
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

interface SaavnResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  audioUrl: string;
  previewUrl: string;
  source: "saavn";
}

interface SaavnSongData {
  id: string;
  title: string;
  name: string;
  album: { name: string; id: string; image?: string[] };
  primary_artists: string;
  artists: string;
  duration: number;
  image?: string[];
  download_url?: Array<{ quality: string; link: string }>;
  more_info?: {
    encrypted_media_url?: string;
    song_pids?: string;
  };
}

async function searchSaavn(query: string): Promise<SaavnResult[]> {
  // Direct JioSaavn API
  const apiUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&p=1&n=20&_format=json`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://www.jiosaavn.com",
        "Referer": "https://www.jiosaavn.com/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const results: SaavnSongData[] = data.results || [];

    return results
      .filter((s) => s.title || s.name)
      .map((s) => {
        const images = s.image || s.album?.image || [];
        const cover = images.length > 0
          ? images[images.length - 1].replace("150x150", "500x500")
          : "https://picsum.photos/seed/default/300/300";

        // Get best quality download URL
        let audioUrl = "";
        if (s.download_url && Array.isArray(s.download_url)) {
          const sorted = [...s.download_url].sort((a, b) => {
            const qA = parseInt(a.quality) || 0;
            const qB = parseInt(b.quality) || 0;
            return qB - qA;
          });
          audioUrl = sorted[0]?.link || "";
        }

        // Fallback: encrypted media URL
        if (!audioUrl && s.more_info?.encrypted_media_url) {
          audioUrl = s.more_info.encrypted_media_url;
        }

        return {
          id: s.id || `saavn_${s.more_info?.song_pids || Date.now()}`,
          title: s.title || s.name || "Unknown Track",
          artist: s.primary_artists || s.artists || "Unknown Artist",
          album: s.album?.name || "Unknown Album",
          duration: s.duration || 30,
          cover,
          audioUrl,
          previewUrl: audioUrl,
          source: "saavn" as const,
        };
      });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "search";

  // Trending
  if (type === "trending") {
    const cacheKey = "saavn:trending";
    const cached = getFromCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const tracks = await searchSaavn("top hits 2025");
    const responseData = { tracks: tracks.slice(0, 15) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  }

  // Recommendations
  if (type === "recommendations") {
    const genre = searchParams.get("genre") || "random";
    const cacheKey = `saavn:rec:${genre}`;
    const cached = getFromCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const queries = genre === "random"
      ? ["pop hits", "rock charts", "electronic mix", "hip hop new"].sort(() => Math.random() - 0.5).slice(0, 2)
      : [`${genre} hits`];

    const allTracks = await Promise.all(queries.map((q) => searchSaavn(q)));
    const merged = allTracks.flat().sort(() => Math.random() - 0.5).slice(0, 12);

    const seen = new Set<string>();
    const unique = merged.filter((t) => {
      const key = `${t.title}:${t.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const responseData = { tracks: unique };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  }

  // Genre
  if (type === "genre") {
    const genre = searchParams.get("genre");
    if (!genre) return NextResponse.json({ tracks: [] });

    const cacheKey = `saavn:genre:${genre.toLowerCase()}`;
    const cached = getFromCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const tracks = await searchSaavn(`${genre} songs`);
    const responseData = { tracks: tracks.slice(0, 15) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  }

  // Search
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const cacheKey = `saavn:search:${query.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  const tracks = await searchSaavn(query.trim());
  const responseData = { tracks };
  setCache(cacheKey, responseData);
  return NextResponse.json(responseData);
}
