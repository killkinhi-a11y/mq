import { NextRequest, NextResponse } from "next/server";

/**
 * SoundCloud Search API
 * Searches SoundCloud for tracks and returns them in MQ Player format.
 * Uses a dynamically extracted client_id from SoundCloud's JS bundles.
 */

let cachedClientId: string | null = null;
let clientIdExpiry = 0;

async function getClientId(): Promise<string | null> {
  if (cachedClientId && Date.now() < clientIdExpiry) return cachedClientId;

  try {
    const res = await fetch("https://soundcloud.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return cachedClientId;

    const html = await res.text();

    // Extract JS bundle URLs
    const jsUrls = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[a-z0-9_-]+\.js/g);
    if (!jsUrls || jsUrls.length === 0) return cachedClientId;

    // Search each bundle for client_id
    for (const url of jsUrls.slice(0, 15)) {
      try {
        const jsRes = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });
        if (!jsRes.ok) continue;
        const jsText = await jsRes.text();
        const match = jsText.match(/client_id["'\s:=]+([a-zA-Z0-9]{20,})/);
        if (match) {
          cachedClientId = match[1];
          clientIdExpiry = Date.now() + 30 * 60 * 1000; // 30 min
          return cachedClientId;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Return cached even if expired
  }

  return cachedClientId;
}

const searchCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getFromCache(key: string): unknown | null {
  const entry = searchCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  searchCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  if (searchCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of searchCache) {
      if (v.expiry <= now) searchCache.delete(k);
    }
  }
  searchCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function searchSoundCloud(query: string, clientId: string) {
  try {
    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=25&facet=genre`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const tracks = data.collection || [];
    if (tracks.length === 0) return [];

    return tracks.map((t: Record<string, unknown>) => {
      const user = t.user as Record<string, unknown> | undefined;
      const artwork = t.artwork_url as string | undefined;
      // Replace -large with -t500x500 for higher quality
      const cover = artwork
        ? artwork.replace("-large.", "-t500x500.")
        : (user?.avatar_url as string | undefined)?.replace("-large.", "-t500x500.") || "";

      const fullDuration = (t.full_duration as number) || (t.duration as number) || 30000;
      const isSnip = t.policy === "SNIP";

      return {
        id: `sc_${t.id}`,
        title: (t.title as string) || "Unknown Track",
        artist: user?.username || "Unknown Artist",
        album: "",
        duration: Math.round(fullDuration / 1000),
        cover: cover || "",
        genre: (t.genre as string) || "",
        audioUrl: "", // resolved on play via /api/music/soundcloud/stream
        previewUrl: "", // SC streams are handled server-side
        source: "soundcloud" as const,
        scTrackId: t.id as number,
        scStreamPolicy: t.policy as string,
        scDuration: Math.round((t.duration as number) / 1000), // actual streamable duration
        scIsFull: !isSnip, // whether full track is available
      };
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const cacheKey = `sc:search:${query.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const clientId = await getClientId();
    if (!clientId) {
      return NextResponse.json({ tracks: [], error: "no_client_id" });
    }

    const tracks = await searchSoundCloud(query.trim(), clientId);
    const responseData = { tracks: tracks.slice(0, 25) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
