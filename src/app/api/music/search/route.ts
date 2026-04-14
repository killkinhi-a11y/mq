import { NextRequest, NextResponse } from "next/server";

/**
 * Unified Search API
 * Sources: iTunes (metadata/covers), YouTube (full-track video IDs), Deezer (fallback).
 * Playback strategy: YouTube IFrame for full tracks, iTunes preview as fallback.
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

interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

// iTunes Search — reliable metadata + covers + 30s preview
async function searchiTunes(query: string): Promise<Array<{
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  audioUrl: string;
  previewUrl: string;
  source: "itunes";
  youtubeId?: string;
}>> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=20`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const tracks: ITunesTrack[] = data.results || [];

    return tracks
      .filter((t) => t.previewUrl)
      .map((t) => ({
        id: `itunes_${t.trackId}`,
        title: t.trackName || "Unknown Track",
        artist: t.artistName || "Unknown Artist",
        album: t.collectionName || "Unknown Album",
        duration: Math.round((t.trackTimeMillis || 30000) / 1000),
        cover: (t.artworkUrl100 || "").replace("100x100bb", "500x500bb"),
        audioUrl: "",
        previewUrl: t.previewUrl,
        source: "itunes" as const,
      }));
  } catch (e) {
    console.warn("[Search] iTunes error:", e);
    return [];
  }
}

// YouTube search — scrape YouTube to find videoIds for full-track playback
async function searchYouTube(query: string): Promise<Map<string, string>> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query + " official audio"
    )}&hl=en`;

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) return new Map();

    const html = await res.text();

    // Extract ytInitialData
    const match = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
    if (!match) return new Map();

    const data = JSON.parse(match[1]);

    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) return new Map();

    const videoIds: string[] = [];
    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (!vr?.videoId) continue;

      // Extract title for matching
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "";
      const channelName = vr.longBylineText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "";

      // Parse duration
      const lengthText = vr.lengthText?.simpleText || "";
      const durationParts = lengthText.split(":").map(Number);
      let durationSec = 0;
      if (durationParts.length === 2) durationSec = durationParts[0] * 60 + durationParts[1];
      else if (durationParts.length === 3) durationSec = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];

      // Accept 30s - 15min
      if (durationSec >= 30 && durationSec <= 900) {
        videoIds.push(vr.videoId);
        // Store for title matching later
        ytTitleMap.set(vr.videoId, { title, channel: channelName });
      }

      if (videoIds.length >= 15) break;
    }

    // Build a simple map: "query" → first videoId (used for tracks without exact match)
    const map = new Map<string, string>();
    for (const id of videoIds) {
      map.set(id, id); // store by videoId for reference
    }
    if (videoIds.length > 0) {
      map.set("__first__", videoIds[0]);
    }
    return map;
  } catch (e) {
    console.warn("[Search] YouTube error:", e);
    return new Map();
  }
}

// Track YouTube video titles for matching
const ytTitleMap = new Map<string, { title: string; channel: string }>();

// Deezer Search — fallback metadata
async function searchDeezer(query: string) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const tracks = data.data || [];
    if (tracks.length === 0) return [];

    return tracks.map((t: Record<string, unknown>) => {
      const album = t.album as Record<string, unknown> | undefined;
      const artist = t.artist as Record<string, unknown> | undefined;
      return {
        id: String(t.id),
        title: t.title || "Unknown Track",
        artist: artist?.name || "Unknown Artist",
        album: album?.title || "Unknown Album",
        duration: (t.duration as number) || 30,
        cover: (album?.cover_big || album?.cover_medium || "https://picsum.photos/seed/default/300/300") as string,
        audioUrl: "",
        previewUrl: (t.preview || "") as string,
        source: "deezer" as const,
      };
    });
  } catch (e) {
    console.warn("[Search] Deezer error:", e);
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
    // Run iTunes + YouTube in parallel
    const [itunesResults, ytResult, deezerResults] = await Promise.allSettled([
      searchiTunes(query.trim()),
      searchYouTube(query.trim()),
      searchDeezer(query.trim()),
    ]);

    const itunesTracks = itunesResults.status === "fulfilled" ? itunesResults.value : [];
    const ytMap = ytResult.status === "fulfilled" ? ytResult.value : new Map<string, string>();
    const deezerTracks = deezerResults.status === "fulfilled" ? deezerResults.value : [];

    // Collect all YouTube videoIds in order
    const ytVideoIds: string[] = [];
    for (const [k, v] of ytMap) {
      if (k !== "__first__") ytVideoIds.push(k);
    }
    const ytFirstId = ytMap.get("__first__");

    // Match iTunes tracks with YouTube videoIds
    const finalTracks = itunesTracks.map((itunes, index) => {
      const normTitle = normalize(itunes.title);
      const normArtist = normalize(itunes.artist);

      // Try to find matching YouTube video
      let matchedYtId: string | undefined;

      // 1. Exact title match with YouTube
      for (const vid of ytVideoIds) {
        const ytInfo = ytTitleMap.get(vid);
        if (!ytInfo) continue;
        const ytNorm = normalize(ytInfo.title);
        if (ytNorm === normTitle || ytNorm.includes(normTitle) || normTitle.includes(ytNorm)) {
          // Verify artist similarity
          const ytChannel = normalize(ytInfo.channel);
          if (ytChannel.includes(normArtist.substring(0, 5)) || normArtist.includes(ytChannel.substring(0, 5)) || normArtist.substring(0, 5) === ytChannel.substring(0, 5)) {
            matchedYtId = vid;
            break;
          }
          // Accept title match even without artist match (for first few results)
          if (index < 5) {
            matchedYtId = vid;
            break;
          }
        }
      }

      // 2. Assign sequential YouTube IDs to remaining tracks
      if (!matchedYtId && ytVideoIds.length > index) {
        matchedYtId = ytVideoIds[index];
      }

      // 3. Fallback: use first YouTube result for first track
      if (!matchedYtId && index === 0 && ytFirstId) {
        matchedYtId = ytFirstId;
      }

      return {
        ...itunes,
        youtubeId: matchedYtId,
        audioUrl: itunes.previewUrl, // fallback audio
        source: matchedYtId ? ("youtube" as const) : itunes.source,
      };
    });

    // If very few results, add Deezer tracks too
    if (finalTracks.length < 5 && deezerTracks.length > 0) {
      const existingTitles = new Set(finalTracks.map((t) => normalize(t.title)));
      let ytIdx = finalTracks.length; // continue assigning from where we left off

      for (const dz of deezerTracks) {
        if (existingTitles.has(normalize(dz.title))) continue;
        const ytId = ytVideoIds.length > ytIdx ? ytVideoIds[ytIdx] : undefined;
        ytIdx++;
        finalTracks.push({
          ...dz,
          youtubeId: ytId,
          audioUrl: dz.previewUrl,
          source: ytId ? ("youtube" as const) : dz.source,
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped = finalTracks.filter((t) => {
      const key = `${normalize(t.title)}:${normalize(t.artist)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const responseData = { tracks: deduped.slice(0, 30) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (e) {
    console.error("[Search] Fatal error:", e);
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
