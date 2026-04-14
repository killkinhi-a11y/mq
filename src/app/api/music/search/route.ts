import { NextRequest, NextResponse } from "next/server";

/**
 * Unified Search API — FAST version
 * Sources: iTunes (metadata/covers/preview), Deezer (fallback).
 * YouTube videoIds are resolved client-side on play.
 */

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// iTunes Search
async function searchiTunes(query: string) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=25`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || [])
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
  } catch {
    return [];
  }
}

// Deezer Search — fallback
async function searchDeezer(query: string) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=25`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const tracks = data.data || [];
    if (tracks.length === 0) return [];

    return tracks.map((t: Record<string, unknown>) => {
      const album = t.album as Record<string, unknown> | undefined;
      const artist = t.artist as Record<string, unknown> | undefined;
      return {
        id: `dz_${t.id}`,
        title: t.title || "Unknown Track",
        artist: artist?.name || "Unknown Artist",
        album: album?.title || "Unknown Album",
        duration: (t.duration as number) || 30,
        cover: (album?.cover_big || album?.cover_medium || "https://picsum.photos/seed/default/300/300") as string,
        audioUrl: (t.preview || "") as string,
        previewUrl: (t.preview || "") as string,
        source: "deezer" as const,
      };
    });
  } catch {
    return [];
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const cacheKey = `search:${query.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // Parallel: iTunes + Deezer
    const [itunesTracks, deezerTracks] = await Promise.allSettled([
      searchiTunes(query.trim()),
      searchDeezer(query.trim()),
    ]);

    const itunes = itunesTracks.status === "fulfilled" ? itunesTracks.value : [];
    const deezer = deezerTracks.status === "fulfilled" ? deezerTracks.value : [];

    // Deduplicate
    const seen = new Set<string>();
    const all = [...itunes, ...deezer];
    const deduped = all.filter((t) => {
      const key = `${normalize(t.title)}:${normalize(t.artist)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const responseData = { tracks: deduped.slice(0, 30) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
