import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Aggressive no-cache on HTML pages
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/_error") {
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");
    // Add Vary: * to prevent any CDN/proxy caching
    response.headers.set("Vary", "*");
  }

  // Add version header so we can verify the correct build is served
  response.headers.set("X-MQ-Build", "v3-fix-" + Date.now().toString(36));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
