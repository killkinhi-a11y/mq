import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const excludeId = searchParams.get("excludeId") || "";

    const users = await db.user.findMany({
      where: {
        confirmed: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(q ? {
          OR: [
            { username: { contains: q } },
            { email: { contains: q } },
          ],
        } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
