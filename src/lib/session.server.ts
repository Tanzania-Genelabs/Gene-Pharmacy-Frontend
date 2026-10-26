/**
 * Server-only helpers for the /api/session/* route handlers.
 *
 * The refresh token never reaches browser JavaScript: these handlers talk to the Laravel API
 * server-to-server and keep the token in an httpOnly cookie on THIS site's own domain
 * (first-party, so Safari/Brave/Chrome tracking protection doesn't touch it, and an XSS bug
 * can't read it).
 */
import type { NextRequest, NextResponse } from "next/server";

export const REFRESH_COOKIE = "refresh_token";
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // matches the backend's 7-day refresh token

export const BACKEND_URL = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

/** The real visitor's IP, so the backend's per-IP rate limits apply to them and not to this server. */
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip");
}

export function upstreamHeaders(request: NextRequest, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };

  const secret = process.env.BFF_SHARED_SECRET;
  const ip = clientIp(request);
  if (secret && ip) {
    headers["X-BFF-Secret"] = secret;
    headers["X-Client-IP"] = ip;
  }

  return headers;
}

export async function callBackend(path: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null; // backend unreachable or timed out
  }
}

export function setRefreshCookie(response: NextResponse, token: string): void {
  response.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearRefreshCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
