/**
 * Shared SoundCloud client_id extraction utility.
 * SoundCloud embeds their API client_id in their JS bundles.
 * We scrape it from the HTML page, cache it for 30 minutes.
 */

let cachedClientId: string | null = null;
let clientIdExpiry = 0;

export async function getSoundCloudClientId(): Promise<string | null> {
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
    const jsUrls = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[a-z0-9_-]+\.js/g);
    if (!jsUrls) return cachedClientId;

    for (const url of jsUrls.slice(0, 10)) {
      try {
        const jsRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!jsRes.ok) continue;
        const jsText = await jsRes.text();
        const match = jsText.match(/client_id["'\s:=]+([a-zA-Z0-9]{20,})/);
        if (match) {
          cachedClientId = match[1];
          clientIdExpiry = Date.now() + 30 * 60 * 1000;
          return cachedClientId;
        }
      } catch {
        continue;
      }
    }
  } catch {
    /* ignore */
  }

  return cachedClientId;
}

export interface SCTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  genre: string;
  audioUrl: string;
  previewUrl: string;
  source: "soundcloud";
  scTrackId: number;
  scStreamPolicy: string;
  scIsFull: boolean;
}

export async function searchSCTracks(query: string, limit = 20): Promise<SCTrack[]> {
  try {
    const clientId = await getSoundCloudClientId();
    if (!clientId) return [];

    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}&facet=genre`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
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
