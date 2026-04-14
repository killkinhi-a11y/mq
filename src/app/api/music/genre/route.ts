import { NextRequest, NextResponse } from "next/server";

/**
 * Genre search — Deezer metadata + YouTube videoIds for full playback.
 */

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string; id: number };
  album: { title: string; cover_medium: string; cover_big: string; cover: string };
  duration: number;
  preview: string;
}

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 7 * 60 * 1000;

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data;
  }
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

async function searchDeezerGenre(query: string) {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const tracks: DeezerTrack[] = data.data || [];

    if (tracks.length === 0) return [];

    return tracks.map((item) => ({
      id: String(item.id),
      title: item.title || "Unknown Track",
      artist: item.artist?.name || "Unknown Artist",
      album: item.album?.title || "Unknown Album",
      duration: item.duration || 30,
      cover: item.album?.cover_big || item.album?.cover_medium || "https://picsum.photos/seed/default/300/300",
      genre: query,
      audioUrl: "",
      previewUrl: item.preview || "",
      source: "deezer" as const,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");

  if (!genre || genre.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const cacheKey = `genre:${genre.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const [deezerTracks, ytIds] = await Promise.allSettled([
      searchDeezerGenre(genre),
      searchYouTubeForIds(`${genre} music songs`),
    ]);

    const tracks = deezerTracks.status === "fulfilled" ? deezerTracks.value : [];
    const videoIds = deezerTracks.status === "fulfilled" ? ytIds.value : [];

    const finalTracks = tracks.slice(0, 20).map((track, i) => ({
      ...track,
      youtubeId: videoIds[i] || undefined,
      audioUrl: track.previewUrl,
      source: videoIds[i] ? ("youtube" as const) : track.source,
    }));

    const responseData = { tracks: finalTracks };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
