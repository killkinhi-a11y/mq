import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Playlist Recommendations API — generates playlist recommendations based on user taste profile.
 * Accepts: userId, likedTags[], likedArtists[], dislikedTags[], limit, offset
 * 
 * IMPROVEMENTS:
 * - Balanced scoring system with normalized weights
 * - Diversity factor to avoid similar playlists
 * - Better error handling with logging
 * - Graceful fallback to popular playlists
 * - Performance optimization with early termination
 */

// Logger utility
const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[PlaylistRecs] ${message}`, data ? JSON.stringify(data) : "");
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[PlaylistRecs] ${message}`, data ? JSON.stringify(data) : "");
  },
  error: (message: string, error?: unknown) => {
    console.error(`[PlaylistRecs] ${message}`, error instanceof Error ? error.message : error);
  },
};

// Normalize score to prevent any single factor from dominating
function normalizeScore(rawScore: number, maxPossible: number): number {
  return maxPossible > 0 ? (rawScore / maxPossible) * 100 : 0;
}

// Calculate diversity between two playlists
function calculatePlaylistDiversity(
  playlist: any,
  existingPlaylists: any[]
): number {
  let diversityScore = 1;
  
  const playlistTags = new Set((playlist.tags || "").split(",").map((t: string) => t.trim().toLowerCase()));
  const playlistArtists = new Set(playlist._artists || []);
  
  for (const existing of existingPlaylists) {
    const existingTags = new Set(existing._tags || []);
    const existingArtists = new Set(existing._artists || []);
    
    // Tag overlap penalty
    const tagOverlap = [...playlistTags].filter(t => existingTags.has(t)).length;
    diversityScore -= Math.min(0.15, tagOverlap * 0.05);
    
    // Artist overlap penalty
    const artistOverlap = [...playlistArtists].filter(a => existingArtists.has(a)).length;
    diversityScore -= Math.min(0.15, artistOverlap * 0.03);
  }
  
  return Math.max(0.3, diversityScore);
}
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";
    const likedTags = (searchParams.get("likedTags") || "").split(",").filter(Boolean).map((t) => t.trim().toLowerCase());
    const likedArtists = (searchParams.get("likedArtists") || "").split(",").filter(Boolean).map((a) => a.trim().toLowerCase());
    const dislikedTags = (searchParams.get("dislikedTags") || "").split(",").filter(Boolean).map((t) => t.trim().toLowerCase());
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10"))); // Clamp between 1-20
    const offset = parseInt(searchParams.get("offset") || "0");

    logger.info(`Fetching playlist recommendations`, { 
      userId: userId ? "present" : "anonymous", 
      likedTagsCount: likedTags.length, 
      likedArtistsCount: likedArtists.length,
      limit 
    });

    // Fetch all public playlists (except user's own)
    const where: any = { isPublic: true };
    if (userId) {
      where.userId = { not: userId };
    }

    let playlists = await db.playlist.findMany({
      where,
      include: {
        user: { select: { username: true } },
        _count: { select: { likes: true } },
      },
      take: 200, // fetch up to 200 for scoring
    });

    logger.info(`Fetched ${playlists.length} public playlists from DB`);

    // Get user's liked playlist IDs to exclude
    let likedPlaylistIds: Set<string> = new Set();
    if (userId) {
      const userLikes = await db.playlistLike.findMany({
        where: { userId },
        select: { playlistId: true },
      });
      likedPlaylistIds = new Set(userLikes.map((l) => l.playlistId));
    }

    // Score each playlist with balanced weights
    const scored = playlists
      .filter((p) => !likedPlaylistIds.has(p.id) && JSON.parse(p.tracksJson || "[]").length > 0)
      .map((p) => {
        let tracks: any[] = [];
        try {
          tracks = JSON.parse(p.tracksJson || "[]");
        } catch {
          tracks = [];
        }

        // Maximum possible scores for normalization
        const MAX_TAG_SCORE = 45;      // 3 tags * 15 points
        const MAX_ARTIST_SCORE = 60;   // 3 artists * 20 points
        const MAX_POPULARITY_SCORE = 30;
        const MAX_RECENCY_SCORE = 10;
        const MAX_TRACK_COUNT_SCORE = 5;
        
        // Weight factors (sum to ~1.0 for balanced contribution)
        const TAG_WEIGHT = 0.35;
        const ARTIST_WEIGHT = 0.30;
        const POPULARITY_WEIGHT = 0.15;
        const RECENCY_WEIGHT = 0.10;
        const TRACK_COUNT_WEIGHT = 0.10;

        // 1. Tag overlap score (normalized to 0-45, then weighted)
        let tagScore = 0;
        const playlistTags = (p.tags || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        for (const lt of likedTags.slice(0, 3)) {  // Limit to top 3 tags
          for (const pt of playlistTags) {
            if (pt.includes(lt) || lt.includes(pt)) {
              tagScore += 15;
              break;  // Only count once per liked tag
            }
          }
        }
        const normalizedTagScore = normalizeScore(tagScore, MAX_TAG_SCORE) * TAG_WEIGHT;

        // 2. Artist overlap score (normalized to 0-60, then weighted)
        let artistScore = 0;
        const playlistArtists = tracks
          .map((t: any) => (t.artist || "").toLowerCase().trim())
          .filter(Boolean);
        const uniqueArtists = [...new Set(playlistArtists)];
        for (const la of likedArtists.slice(0, 3)) {  // Limit to top 3 artists
          for (const pa of uniqueArtists) {
            if (pa.includes(la) || la.includes(pa)) {
              artistScore += 20;
              break;  // Only count once per liked artist
            }
          }
        }
        const normalizedArtistScore = normalizeScore(artistScore, MAX_ARTIST_SCORE) * ARTIST_WEIGHT;

        // 3. Disliked tag penalty (-20 per match, capped at -40)
        let dislikePenalty = 0;
        for (const dt of dislikedTags.slice(0, 2)) {  // Limit to top 2 disliked
          for (const pt of playlistTags) {
            if (pt.includes(dt) || dt.includes(pt)) {
              dislikePenalty -= 20;
              break;
            }
          }
        }
        dislikePenalty = Math.max(-40, dislikePenalty);

        // 4. Popularity bonus (normalized, logarithmic to prevent domination)
        const popularityRaw = Math.log10((p._count?.likes || 0) + 1) * 10 + Math.log10(p.playCount + 1) * 5;
        const normalizedPopularity = Math.min(30, popularityRaw) * POPULARITY_WEIGHT;

        // 5. Recency bonus (0-10 points) — playlists from last 7 days get bonus
        const daysSinceCreation = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        let recencyScore = 0;
        if (daysSinceCreation < 1) recencyScore = 10;
        else if (daysSinceCreation < 3) recencyScore = 7;
        else if (daysSinceCreation < 7) recencyScore = 5;
        else if (daysSinceCreation < 30) recencyScore = 2;
        const normalizedRecency = recencyScore * RECENCY_WEIGHT;

        // 6. Track count bonus — prefer playlists with decent amount of tracks (0-5 points)
        let trackCountScore = 0;
        if (tracks.length >= 15) trackCountScore = 5;
        else if (tracks.length >= 10) trackCountScore = 4;
        else if (tracks.length >= 5) trackCountScore = 3;
        else if (tracks.length >= 3) trackCountScore = 1;
        const normalizedTrackCount = trackCountScore * TRACK_COUNT_WEIGHT;

        // Calculate final score (0-100 scale + dislike penalty)
        const baseScore = normalizedTagScore + normalizedArtistScore + normalizedPopularity + normalizedRecency + normalizedTrackCount;
        const finalScore = Math.max(0, baseScore * 100 + dislikePenalty);  // Scale to 0-10000 for sorting

        return { 
          ...p, 
          tracks, 
          _score: finalScore, 
          _tags: playlistTags, 
          _artists: uniqueArtists,
          _diversityReady: { tags: playlistTags, artists: uniqueArtists }
        };
      })
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score);

    logger.info(`Scored ${scored.length} playlists after filtering`);

    // Apply diversity-aware selection
    let selectedPlaylists: typeof scored = [];
    for (const playlist of scored) {
      if (selectedPlaylists.length >= limit) break;
      
      const diversityScore = calculatePlaylistDiversity(playlist, selectedPlaylists);
      
      // Accept if diversity is good OR we need more playlists
      if (diversityScore >= 0.6 || selectedPlaylists.length < Math.ceil(limit * 0.5)) {
        selectedPlaylists.push(playlist);
      }
    }

    // Fill remaining slots if needed
    if (selectedPlaylists.length < limit) {
      const remaining = scored.filter(p => !selectedPlaylists.includes(p));
      selectedPlaylists = [...selectedPlaylists, ...remaining.slice(0, limit - selectedPlaylists.length)];
    }

    const result = selectedPlaylists.slice(offset, offset + limit).map((p) => {
      return {
        id: p.id,
        userId: p.userId,
        username: p.user?.username || "Unknown",
        name: p.name,
        description: p.description,
        cover: p.cover,
        tags: p._tags,
        tracks: p.tracks,
        trackCount: p.tracks.length,
        likeCount: p._count?.likes || 0,
        playCount: p.playCount,
        score: Math.round(p._score),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    // If not enough recommendations, add popular playlists as fallback
    if (result.length < limit) {
      const existingIds = new Set(result.map((r) => r.id));
      const fallback = playlists
        .filter((p) => !existingIds.has(p.id) && JSON.parse(p.tracksJson || "[]").length > 0)
        .sort((a, b) => {
          const scoreA = (a._count?.likes || 0) * 3 + a.playCount;
          const scoreB = (b._count?.likes || 0) * 3 + b.playCount;
          return scoreB - scoreA;
        })
        .slice(0, limit - result.length)
        .map((p) => {
          let tracks: any[] = [];
          try { tracks = JSON.parse(p.tracksJson || "[]"); } catch { tracks = []; }
          return {
            id: p.id,
            userId: p.userId,
            username: p.user?.username || "Unknown",
            name: p.name,
            description: p.description,
            cover: p.cover,
            tags: (p.tags || "").split(",").filter(Boolean),
            tracks,
            trackCount: tracks.length,
            likeCount: p._count?.likes || 0,
            playCount: p.playCount,
            score: 0,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          };
        });

      result.push(...fallback);
    }

    const duration = Date.now() - startTime;
    logger.info(`Returning ${result.length} playlist recommendations in ${duration}ms`);

    return NextResponse.json({ playlists: result });
  } catch (error) {
    logger.error(`Failed to fetch playlist recommendations`, error);
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
  }
}
