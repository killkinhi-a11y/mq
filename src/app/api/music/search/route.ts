import { NextRequest, NextResponse } from "next/server";

/**
 * Unified Search API
 * Sources: iTunes (metadata/covers/preview), Deezer (fallback), SoundCloud.
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
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=20`;
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
        genre: t.primaryGenreName || "",
        audioUrl: t.previewUrl,
        previewUrl: t.previewUrl,
        source: "itunes" as const,
      }));
  } catch {
    return [];
  }
}

// Deezer Search
async function searchDeezer(query: string) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`,
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
        genre: "",
        audioUrl: (t.preview || "") as string,
        previewUrl: (t.preview || "") as string,
        source: "deezer" as const,
      };
    });
  } catch {
    return [];
  }
}

// ── SoundCloud client_id extraction ────────────────────────
let scClientId: string | null = null;
let scClientIdExpiry = 0;

async function getSCClientId(): Promise<string | null> {
  if (scClientId && Date.now() < scClientIdExpiry) return scClientId;
  try {
    const res = await fetch("https://soundcloud.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return scClientId;
    const html = await res.text();
    const jsUrls = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[a-z0-9_-]+\.js/g);
    if (!jsUrls) return scClientId;
    for (const url of jsUrls.slice(0, 10)) {
      try {
        const jsRes = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!jsRes.ok) continue;
        const jsText = await jsRes.text();
        const match = jsText.match(/client_id["'\s:=]+([a-zA-Z0-9]{20,})/);
        if (match) {
          scClientId = match[1];
          scClientIdExpiry = Date.now() + 30 * 60 * 1000;
          return scClientId;
        }
      } catch { continue; }
    }
  } catch { /* ignore */ }
  return scClientId;
}

// SoundCloud Search
async function searchSoundCloud(query: string) {
  try {
    const clientId = await getSCClientId();
    if (!clientId) return [];

    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=20&facet=genre`;
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
      const cover = artwork
        ? artwork.replace("-large.", "-t500x500.")
        : (user?.avatar_url as string | undefined)?.replace("-large.", "-t500x500.") || "";
      const fullDuration = (t.full_duration as number) || (t.duration as number) || 30000;

      return {
        id: `sc_${t.id}`,
        title: (t.title as string) || "Unknown Track",
        artist: user?.username || "Unknown Artist",
        album: "",
        duration: Math.round(fullDuration / 1000),
        cover: cover || "",
        genre: (t.genre as string) || "",
        audioUrl: "", // resolved on play via /api/music/soundcloud/stream
        previewUrl: "",
        source: "soundcloud" as const,
        scTrackId: t.id as number,
        scStreamPolicy: t.policy as string,
        scIsFull: t.policy !== "SNIP",
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
    // Parallel: iTunes + Deezer + SoundCloud
    const [itunesResult, deezerResult, scResult] = await Promise.allSettled([
      searchiTunes(query.trim()),
      searchDeezer(query.trim()),
      searchSoundCloud(query.trim()),
    ]);

    const itunes = itunesResult.status === "fulfilled" ? itunesResult.value : [];
    const deezer = deezerResult.status === "fulfilled" ? deezerResult.value : [];
    const soundcloud = scResult.status === "fulfilled" ? scResult.value : [];

    // Deduplicate by title:artist
    const seen = new Set<string>();
    const all = [...itunes, ...soundcloud, ...deezer]; // SC before Deezer for priority
    const deduped = all.filter((t) => {
      const key = `${normalize(t.title)}:${normalize(t.artist)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const responseData = { tracks: deduped.slice(0, 40) };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
