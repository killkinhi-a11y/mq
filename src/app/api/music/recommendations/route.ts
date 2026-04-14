import { NextRequest, NextResponse } from "next/server";

/**
 * Recommendations — iTunes metadata + YouTube videoIds for full playback.
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

async function searchYouTubeForIds(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`;
    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const match = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) return [];

    const ids: string[] = [];
    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (vr?.videoId) {
        ids.push(vr.videoId);
        if (ids.length >= 15) break;
      }
    }
    return ids;
  } catch {
    return [];
  }
}

async function fetchiTunesRecs() {
  const queries = ["trending pop", "new rock", "electronic dance", "hip hop new"];
  const shuffled = queries.sort(() => Math.random() - 0.5).slice(0, 2);

  try {
    const allTracks: Array<{
      id: string; title: string; artist: string; album: string;
      duration: number; cover: string; audioUrl: string; previewUrl: string;
      source: "itunes";
    }> = [];
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
          source: "itunes",
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
    const itunesTracks = await fetchiTunesRecs();
    if (itunesTracks.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    // Search YouTube for videoIds based on genre
    const ytQuery = genre === "random"
      ? "popular music mix 2025"
      : `${genre} popular songs`;
    const ytIds = await searchYouTubeForIds(ytQuery);

    const finalTracks = itunesTracks.map((track, i) => ({
      ...track,
      youtubeId: ytIds[i] || undefined,
      source: ytIds[i] ? ("youtube" as const) : "itunes" as const,
    }));

    const responseData = { tracks: finalTracks };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
