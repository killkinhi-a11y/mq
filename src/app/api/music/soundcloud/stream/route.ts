import { NextRequest, NextResponse } from "next/server";

/**
 * Resolve SoundCloud stream URL for a track.
 * Returns the direct MP3/ HLS URL that can be played by HTML5 Audio.
 */

let cachedClientId: string | null = null;
let clientIdExpiry = 0;

async function getClientId(): Promise<string | null> {
  if (cachedClientId && Date.now() < clientIdExpiry) return cachedClientId;

  try {
    const res = await fetch("https://soundcloud.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
    // ignore
  }

  return cachedClientId;
}

// Cache resolved stream URLs (they expire quickly, cache 5 min)
const streamCache = new Map<string, { url: string; expiry: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get("trackId");

  if (!trackId) {
    return NextResponse.json({ url: null, error: "missing trackId" });
  }

  // Check cache
  const cached = streamCache.get(trackId);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ url: cached.url });
  }

  try {
    const clientId = await getClientId();
    if (!clientId) {
      return NextResponse.json({ url: null, error: "no_client_id" });
    }

    // Fetch track details to get media transcodings
    const trackRes = await fetch(
      `https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${clientId}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!trackRes.ok) {
      return NextResponse.json({ url: null, error: "track_not_found" });
    }

    const track = await trackRes.json();
    const transcodings = track.media?.transcodings || [];

    // Prefer progressive (MP3) over HLS
    let streamUrl: string | null = null;
    for (const t of transcodings) {
      if (t.format?.protocol === "progressive") {
        streamUrl = t.url;
        break;
      }
    }
    if (!streamUrl && transcodings.length > 0) {
      streamUrl = transcodings[0].url;
    }
    if (!streamUrl) {
      return NextResponse.json({ url: null, error: "no_transcodings" });
    }

    // Resolve the stream URL (append client_id)
    const separator = streamUrl.includes("?") ? "&" : "?";
    const resolvedUrl = `${streamUrl}${separator}client_id=${clientId}`;

    // Try to fetch the actual redirect URL
    try {
      const redirectRes = await fetch(resolvedUrl, {
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      const redirectData = await redirectRes.json();
      if (redirectData.url) {
        streamCache.set(trackId, {
          url: redirectData.url,
          expiry: Date.now() + 5 * 60 * 1000,
        });
        return NextResponse.json({
          url: redirectData.url,
          isPreview: track.policy === "SNIP",
          duration: Math.round((track.duration || 0) / 1000),
          fullDuration: Math.round((track.full_duration || 0) / 1000),
        });
      }
    } catch {
      // Fallback: return the resolved URL template
    }

    return NextResponse.json({
      url: resolvedUrl,
      isPreview: track.policy === "SNIP",
      duration: Math.round((track.duration || 0) / 1000),
      fullDuration: Math.round((track.full_duration || 0) / 1000),
    });
  } catch {
    return NextResponse.json({ url: null, error: "resolve_failed" });
  }
}
