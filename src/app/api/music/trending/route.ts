import { NextResponse } from "next/server";

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
  primaryGenreName: string;
  kind: string;
}

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

async function fetchITunes(term: string, limit: number = 10): Promise<ITunesResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=${limit}&country=RU`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).filter(
    (item: ITunesResult) => item.kind === "song" && item.previewUrl
  );
}

function transformTrack(item: ITunesResult) {
  return {
    id: String(item.trackId),
    title: item.trackName || "Unknown Track",
    artist: item.artistName || "Unknown Artist",
    album: item.collectionName || "Unknown Album",
    duration: Math.round((item.trackTimeMillis || 30000) / 1000),
    cover: (item.artworkUrl100 || "").replace("100x100bb", "300x300bb") || "https://picsum.photos/seed/default/300/300",
    genre: item.primaryGenreName || "Другое",
    audioUrl: item.previewUrl || "",
    previewUrl: item.previewUrl,
  };
}

export async function GET() {
  const cacheKey = "trending:mix";
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Fetch from multiple searches for variety
    const searchTerms = [
      "popular music 2024",
      "top hits",
      "new releases",
      "trending songs",
    ];

    const results = await Promise.allSettled(
      searchTerms.map((term) => fetchITunes(term, 10))
    );

    const allTracks: ITunesResult[] = [];
    const seenIds = new Set<number>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const track of result.value) {
          if (!seenIds.has(track.trackId)) {
            seenIds.add(track.trackId);
            allTracks.push(track);
          }
        }
      }
    }

    // Shuffle and take up to 25
    const shuffled = allTracks.sort(() => Math.random() - 0.5).slice(0, 25);
    const transformed = shuffled.map(transformTrack);

    const responseData = { tracks: transformed };
    setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
