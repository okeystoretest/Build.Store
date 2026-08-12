import type { NextRequest } from "next/server";
import { authRouteGuard } from "@/lib/auth/middleware";

export function middleware(request: NextRequest) {
  return authRouteGuard(request);
}

export const config = {
  // Run on app routes; skip static assets, images and the service worker.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.png$).*)",
  ],
};
