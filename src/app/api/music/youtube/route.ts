import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side YouTube search — scrapes YouTube search results page
 * to extract video IDs, then uses Piped API to get direct audio stream URLs.
 *
 * Strategy:
 *  1. Scrape YouTube search page (most reliable) → videoId
 *  2. Fallback: Invidious API → videoId
 *  3. Piped API → audio stream URL from videoId
 *
 * Cache: 24 h in-memory (stores videoId + audioUrl).
 */

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const ytCache = new Map<string, { videoId: string; audioUrl: string | null; expiry: number }>();

function getFromCache(key: string): { videoId: string; audioUrl: string | null } | null {
  const entry = ytCache.get(key);
  if (entry && entry.expiry > Date.now()) return { videoId: entry.videoId, audioUrl: entry.audioUrl };
  ytCache.delete(key);
  return null;
}

function setCache(key: string, videoId: string, audioUrl: string | null) {
  if (ytCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of ytCache) {
      if (v.expiry <= now) ytCache.delete(k);
    }
  }
  ytCache.set(key, { videoId, audioUrl, expiry: Date.now() + CACHE_TTL });
}

/**
 * Scrape YouTube search results page to find video IDs.
 * Parses the ytInitialData JSON embedded in the HTML.
 */
async function scrapeYouTube(query: string): Promise<string | null> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query + " official audio"
  )}&hl=en`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();

    // Extract ytInitialData JSON
    const match = html.match(
      /var\s+ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s
    );
    if (!match) return null;

    const data = JSON.parse(match[1]);

    // Navigate to search results
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) return null;

    // Find video IDs — prefer videos with reasonable duration (1-10 min)
    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (!vr?.videoId) continue;

      // Parse duration to skip very long/short videos
      const lengthText = vr.lengthText?.simpleText || "";
      const durationParts = lengthText.split(":").map(Number);
      let durationSec = 0;
      if (durationParts.length === 2) {
        durationSec = durationParts[0] * 60 + durationParts[1];
      } else if (durationParts.length === 3) {
        durationSec =
          durationParts[0] * 3600 +
          durationParts[1] * 60 +
          durationParts[2];
      }

      // Accept videos between 30s and 15 min
      if (durationSec >= 30 && durationSec <= 900) {
        return vr.videoId;
      }

      // If no duration info, accept the first video
      if (!lengthText) {
        return vr.videoId;
      }
    }

    // Fallback: just return the first video ID found
    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (vr?.videoId) return vr.videoId;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback: search via Invidious API instances.
 */
async function searchInvidious(query: string): Promise<string | null> {
  const instances = [
    "https://invidious.fdn.fr",
    "https://vid.puffyan.us",
    "https://yewtu.be",
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
  ];

  const searchQuery = `${query} official audio`;

  for (const instance of instances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(
          searchQuery
        )}&type=video`,
        {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        }
      );
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      const videos = Array.isArray(data) ? data : data.videos || [];

      for (const video of videos) {
        if (
          video.videoId &&
          video.lengthSeconds > 30 &&
          !video.liveNow &&
          video.lengthSeconds < 900
        ) {
          return video.videoId;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Use Piped API to get a direct audio stream URL for a YouTube video.
 * Piped proxies YouTube audio, bypassing embedding restrictions.
 */
async function getPipedAudioUrl(videoId: string): Promise<string | null> {
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.projectsegfau.lt",
    "https://pipedapi.in.projectsegfau.lt",
  ];

  for (const instance of instances) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const audioStreams: Array<{
        url?: string;
        mimeType?: string;
        bitrate?: number;
        contentLength?: number;
      }> = data.audioStreams || [];

      // Prefer opus/webm 128kbps+, fallback to any audio stream sorted by bitrate
      const sorted = audioStreams
        .filter((s) => s.url && s.mimeType?.startsWith("audio/"))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (sorted.length > 0) {
        return sorted[0].url!;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ videoId: null, audioUrl: null, source: null });
  }

  const cacheKey = `yt:${query.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json({ videoId: cached.videoId, audioUrl: cached.audioUrl, source: "cache" });
  }

  try {
    // Step 1: Find videoId
    const videoId = await scrapeYouTube(query.trim());

    if (!videoId) {
      // Fallback: Invidious
      const invId = await searchInvidious(query.trim());
      if (invId) {
        // Step 2: Try to get Piped audio URL
        let audioUrl: string | null = null;
        try {
          audioUrl = await getPipedAudioUrl(invId);
        } catch {
          // Piped failed, still return videoId
        }
        setCache(cacheKey, invId, audioUrl);
        return NextResponse.json({ videoId: invId, audioUrl, source: audioUrl ? "piped" : "invidious" });
      }

      return NextResponse.json({ videoId: null, audioUrl: null, source: null });
    }

    // Step 2: Get Piped audio stream URL
    let audioUrl: string | null = null;
    try {
      audioUrl = await getPipedAudioUrl(videoId);
    } catch {
      // Piped failed, still return videoId
    }

    setCache(cacheKey, videoId, audioUrl);

    return NextResponse.json({
      videoId,
      audioUrl,
      source: audioUrl ? "piped" : "youtube",
    });
  } catch {
    return NextResponse.json({ videoId: null, audioUrl: null, source: null });
  }
}
