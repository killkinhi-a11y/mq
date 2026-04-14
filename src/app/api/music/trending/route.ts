import { NextResponse } from "next/server";

/**
 * Trending tracks — iTunes for metadata, Audius for full tracks.
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

interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

async function fetchiTunesTrending() {
  try {
    const url = "https://itunes.apple.com/search?term=top+hits+2025&media=music&limit=25";
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tracks: ITunesTrack[] = data.results || [];

    return tracks.filter((t) => t.previewUrl).map((t) => ({
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

async function fetchAudiusTrending() {
  const providers = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
  ];

  for (const provider of providers) {
    try {
      const res = await fetch(
        `${provider}/v1/tracks/trending?app_name=mqplayer&limit=25`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const tracks = data.data || [];
      if (tracks.length === 0) continue;

      return tracks.map((t: Record<string, unknown>) => {
        const user = t.user as Record<string, unknown> | undefined;
        return {
          id: `audius_${t.id}`,
          title: t.title || "Unknown Track",
          artist: user?.name || "Unknown Artist",
          album: "",
          duration: (t.duration as number) || 30,
          cover: (t.artwork as string) || "https://picsum.photos/seed/default/300/300",
          audioUrl: `${provider}/v1/tracks/${t.id}/stream?app_name=mqplayer`,
          previewUrl: `${provider}/v1/tracks/${t.id}/stream?app_name=mqplayer`,
          source: "audius" as const,
        };
      });
    } catch {
      continue;
    }
  }
  return [];
}

export async function GET() {
  const cacheKey = "trending:unified";
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // 1. Try Audius trending (full tracks!)
    const audiusTracks = await fetchAudiusTrending();
    if (audiusTracks.length > 0) {
      const responseData = { tracks: audiusTracks };
      setCache(cacheKey, responseData);
      return NextResponse.json(responseData);
    }

    // 2. Fallback to iTunes (30s previews)
    const itunesTracks = await fetchiTunesTrending();
    const responseData = { tracks: itunesTracks };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
