import { NextRequest, NextResponse } from "next/server";

/**
 * Unified Search API
 * Uses iTunes for metadata/covers, Audius for full tracks, Deezer as fallback.
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

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  artwork?: string;
  user: { name: string; id: string };
  stream?: string;
  genre: string;
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
  } catch {
    return [];
  }
}

// Audius Search — full tracks with streaming
async function searchAudius(query: string): Promise<AudiusTrack[]> {
  try {
    // Audius has multiple discovery providers, try a few
    const providers = [
      "https://discoveryprovider.audius.co",
      "https://discoveryprovider2.audius.co",
    ];

    for (const provider of providers) {
      try {
        const res = await fetch(
          `${provider}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=mqplayer&limit=20`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) continue;

        const data = await res.json();
        const tracks: AudiusTrack[] = data.data || [];
        if (tracks.length > 0) return tracks;
      } catch {
        continue;
      }
    }
    return [];
  } catch {
    return [];
  }
}

// Deezer Search — fallback for metadata
async function searchDeezer(query: string) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const tracks = data.data || [];

    if (tracks.length === 0) return []; // Deezer region-blocked

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

  const cacheKey = `search:${query.trim().toLowerCase()}`;
  const cached = getFromCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    // 1. Get metadata from iTunes (reliable)
    const itunesResults = await searchiTunes(query.trim());

    // 2. Try to match with Audius full tracks
    let finalTracks;

    if (itunesResults.length > 0) {
      // Get Audius results to find full-track stream URLs
      const audiusResults = await searchAudius(query.trim());

      // Build a map of Audius tracks by normalized title for matching
      const audiusMap = new Map<string, AudiusTrack>();
      for (const at of audiusResults) {
        const normTitle = at.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        audiusMap.set(normTitle, at);
      }

      // Merge: iTunes metadata + Audius audio URLs
      finalTracks = itunesResults.map((itunes) => {
        const normTitle = itunes.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normArtist = itunes.artist.toLowerCase().replace(/[^a-z0-9]/g, "");

        // Try to find matching Audius track
        let audiusTrack = audiusMap.get(normTitle);
        if (!audiusTrack) {
          // Fuzzy match: check if Audius title contains key words from iTunes
          for (const [key, at] of audiusMap) {
            const audiusNorm = key;
            if (audiusNorm.includes(normTitle.split(" ")[0]) ||
                normTitle.includes(audiusNorm.split(" ")[0])) {
              audiusTrack = at;
              break;
            }
          }
        }

        if (audiusTrack) {
          const provider = "https://discoveryprovider.audius.co";
          return {
            ...itunes,
            audioUrl: `${provider}/v1/tracks/${audiusTrack.id}/stream?app_name=mqplayer`,
            source: "audius" as const,
            duration: audiusTrack.duration > 0 ? audiusTrack.duration : itunes.duration,
          };
        }

        // No Audius match — use iTunes preview as audioUrl
        return {
          ...itunes,
          audioUrl: itunes.previewUrl,
          source: "itunes" as const,
        };
      });
    } else {
      // iTunes failed, try Deezer
      const deezerResults = await searchDeezer(query.trim());
      if (deezerResults.length > 0) {
        // Try to find Audius tracks
        const audiusResults = await searchAudius(query.trim());
        const audiusMap = new Map<string, AudiusTrack>();
        for (const at of audiusResults) {
          audiusMap.set(at.title.toLowerCase().replace(/[^a-z0-9]/g, ""), at);
        }

        finalTracks = deezerResults.map((dz) => {
          const normTitle = dz.title.toLowerCase().replace(/[^a-z0-9]/g, "");
          const audiusTrack = audiusMap.get(normTitle);
          if (audiusTrack) {
            const provider = "https://discoveryprovider.audius.co";
            return {
              ...dz,
              audioUrl: `${provider}/v1/tracks/${audiusTrack.id}/stream?app_name=mqplayer`,
              source: "audius" as const,
            };
          }
          return {
            ...dz,
            audioUrl: dz.previewUrl,
          };
        });
      } else {
        // Both failed, try Audius alone
        const audiusResults = await searchAudius(query.trim());
        const provider = "https://discoveryprovider.audius.co";
        finalTracks = audiusResults.map((at) => ({
          id: `audius_${at.id}`,
          title: at.title || "Unknown Track",
          artist: at.user?.name || "Unknown Artist",
          album: "",
          duration: at.duration || 30,
          cover: at.artwork || "https://picsum.photos/seed/default/300/300",
          audioUrl: `${provider}/v1/tracks/${at.id}/stream?app_name=mqplayer`,
          previewUrl: `${provider}/v1/tracks/${at.id}/stream?app_name=mqplayer`,
          source: "audius" as const,
        }));
      }
    }

    const responseData = { tracks: finalTracks };
    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
