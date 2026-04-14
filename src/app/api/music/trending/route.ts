import { NextResponse } from "next/server";

/**
 * Trending tracks — iTunes metadata + YouTube videoIds for full playback.
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
        if (ids.length >= 20) break;
      }
    }
    return ids;
  } catch {
    return [];
  }
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

export async function GET() {
  const cacheKey = "trending:unified";
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const itunesTracks = await fetchiTunesTrending();
    if (itunesTracks.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    // Search YouTube for videoIds
    const ytIds = await searchYouTubeForIds("top hits 2025 music playlist");

    const finalTracks = itunesTracks.slice(0, 20).map((track, i) => ({
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
