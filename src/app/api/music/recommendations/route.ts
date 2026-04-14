import { NextRequest, NextResponse } from "next/server";

/**
 * Recommendations — Audius trending for full tracks, iTunes as fallback.
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

async function fetchAudiusRecs() {
  const providers = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
  ];

  const genres = ["pop", "rock", "electronic", "hip+hop", "rnb", "jazz"];
  const shuffled = genres.sort(() => Math.random() - 0.5).slice(0, 2);

  for (const provider of providers) {
    try {
      const allTracks: Array<Record<string, unknown>> = [];
      const seenIds = new Set<string>();

      const results = await Promise.allSettled(
        shuffled.map((g) =>
          fetch(
            `${provider}/v1/tracks/search?query=${g}+popular&app_name=mqplayer&limit=8`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
          ).then((r) => (r.ok ? r.json() : { data: [] }))
        )
      );

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const t of result.value.data || []) {
          if (!t.title || seenIds.has(t.id)) continue;
          seenIds.add(t.id);

          const user = t.user as Record<string, unknown> | undefined;
          allTracks.push({
            id: `audius_${t.id}`,
            title: t.title,
            artist: user?.name || "Unknown",
            album: "",
            duration: (t.duration as number) || 30,
            cover: (t.artwork as string) || "https://picsum.photos/seed/default/300/300",
            audioUrl: `${provider}/v1/tracks/${t.id}/stream?app_name=mqplayer`,
            previewUrl: `${provider}/v1/tracks/${t.id}/stream?app_name=mqplayer`,
            source: "audius" as const,
          });
        }
      }

      if (allTracks.length > 0) {
        return allTracks.sort(() => Math.random() - 0.5).slice(0, 12);
      }
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchiTunesRecs() {
  const queries = ["trending pop", "new rock", "electronic dance", "hip hop new"];
  const shuffled = queries.sort(() => Math.random() - 0.5).slice(0, 2);

  try {
    const allTracks: Array<{ id: string; title: string; artist: string; album: string; duration: number; cover: string; audioUrl: string; previewUrl: string; source: "itunes" }> = [];
    const seenIds = new Set<string>();

    for (const q of shuffled) {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=8`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const t of data.results || []) {
        if (!t.previewUrl || seenIds.has(String(t.trackId))) continue;
        seenIds.add(String(t.trackId));
        allTracks.push({
          id: `itunes_${t.trackId}`,
          title: t.trackName || "Unknown",
          artist: t.artistName || "Unknown",
          album: t.collectionName || "Unknown",
          duration: Math.round((t.trackTimeMillis || 30000) / 1000),
          cover: (t.artworkUrl100 || "").replace("100x100bb", "500x500bb"),
          audioUrl: t.previewUrl,
          previewUrl: t.previewUrl,
          source: "itunes" as const,
        });
      }
    }

    return allTracks.sort(() => Math.random() - 0.5).slice(0, 12);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre") || "random";

  const cacheKey = `rec:unified:${genre}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // 1. Try Audius (full tracks)
    const audiusTracks = await fetchAudiusRecs();
    if (audiusTracks.length >= 5) {
      const responseData = { tracks: audiusTracks };
      setCache(cacheKey, responseData);
      return NextResponse.json(responseData);
    }

    // 2. Fallback to iTunes (30s previews)
    const itunesTracks = await fetchiTunesRecs();
    const responseData = { tracks: itunesTracks };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
