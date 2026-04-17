import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST /api/playlists/like — toggle like on a playlist
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playlistId, userId } = body;

    if (!playlistId || !userId) {
      return NextResponse.json({ error: "playlistId and userId required" }, { status: 400 });
    }

    // Verify playlist exists
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    // Check if already liked
    const existing = await prisma.playlistLike.findUnique({
      where: { playlistId_userId: { playlistId, userId } },
    });

    if (existing) {
      // Unlike
      await prisma.playlistLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await prisma.playlistLike.create({
        data: { playlistId, userId },
      });
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error("POST /api/playlists/like error:", error);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
