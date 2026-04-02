import { NextResponse, type NextRequest } from "next/server";

/** Public routes that do NOT require authentication */
const PUBLIC_PATHS = new Set(["/login", "/register", "/forgot-password"]);

/** Routes only accessible by SuperAdmin */
const SUPER_ADMIN_PATHS = ["/admin"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon");
}

function hasRefreshTokenCookie(request: NextRequest): boolean {
  return request.cookies.has("refresh_token");
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Always allow public paths (auth pages, Next.js internals)
  if (isPublicPath(pathname)) {
    // If already authenticated and visiting login, redirect to root
    if (pathname === "/login" && hasRefreshTokenCookie(request)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // No refresh token → redirect to login
  if (!hasRefreshTokenCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Optional: enforce CSRF protection on state-mutating methods
  const method = request.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.endsWith(host)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const response = NextResponse.next();

  // Security headers on every response
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api routes
     * - static files (_next/static, _next/image, favicon.ico)
     * - public assets (manifest.json, icons, images)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icons|images|manifest\\.json).*)",
  ],
};
