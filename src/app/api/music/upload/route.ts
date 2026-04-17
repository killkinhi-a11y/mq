import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const runtime = 'nodejs';

// Allow up to 600 seconds for large file uploads
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Accept any audio/* MIME type or known audio extensions (more permissive for high-bitrate files)
    const isAudioMime = file.type.startsWith('audio/') || file.type === 'application/octet-stream';
    const hasAudioExt = !!file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm|opus|wma|aiff|alac)$/i);
    if (!isAudioMime && !hasAudioExt) {
      return NextResponse.json({ error: "Invalid file type. Supported: MP3, WAV, OGG, FLAC, AAC, M4A, WebM, OPUS" }, { status: 400 });
    }

    // Max 200MB for high-bitrate files
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 200MB" }, { status: 400 });
    }

    // Use persistent uploads directory (not inside .next/ which gets wiped on rebuild)
    const uploadsDir = "/home/z/my-project/uploads";
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = file.name.split(".").pop() || "mp3";
    const fileName = `${uniqueId}.${ext}`;
    const filePath = join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const title = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    return NextResponse.json({
      id: `local_${uniqueId}`,
      title: title,
      artist: "Локальный файл",
      album: "",
      cover: "",
      duration: 0,
      source: "local",
      audioUrl: `/api/music/upload/file/${fileName}`,
      scTrackId: null,
      scIsFull: true,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed: " + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
