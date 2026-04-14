import { NextRequest, NextResponse } from "next/server";

/**
 * YouTube resolver — lightweight endpoint that finds a YouTube videoId for a track.
 * Called client-side only when user presses play.
 */

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiry <= now) cache.delete(k);
    }
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function findYouTubeVideoId(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query + " official audio"
    )}&hl=en`;

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) return null;

    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (!vr?.videoId) continue;

      const lengthText = vr.lengthText?.simpleText || "";
      const durationParts = lengthText.split(":").map(Number);
      let durationSec = 0;
      if (durationParts.length === 2) durationSec = durationParts[0] * 60 + durationParts[1];
      else if (durationParts.length === 3) durationSec = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];

      if (durationSec >= 30 && durationSec <= 900) {
        return vr.videoId;
      }
    }

    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (vr?.videoId) return vr.videoId;
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ videoId: null });
  }

  const cacheKey = `yt:resolve:${q.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const videoId = await findYouTubeVideoId(q.trim());
    const responseData = { videoId };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ videoId: null });
  }
}
