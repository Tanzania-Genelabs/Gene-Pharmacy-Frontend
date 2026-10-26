import { NextResponse, type NextRequest } from "next/server";
import { callBackend, setRefreshCookie, upstreamHeaders } from "@/lib/session.server";

export async function POST(request: NextRequest) {
  const upstream = await callBackend("/api/v1/auth/login", {
    method: "POST",
    headers: upstreamHeaders(request),
    body: await request.text(),
  });

  if (!upstream) {
    return NextResponse.json({ message: "The server is unreachable. Please try again." }, { status: 502 });
  }

  const data = await upstream.json().catch(() => null);

  if (!upstream.ok || !data?.refreshToken) {
    const retryAfter = upstream.headers.get("Retry-After");
    return NextResponse.json(data ?? { message: "Sign-in failed" }, {
      status: upstream.ok ? 502 : upstream.status,
      headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
    });
  }

  // The refresh token goes into the httpOnly cookie and is stripped from what the browser's JS sees.
  const { refreshToken, ...session } = data;
  const response = NextResponse.json(session);
  setRefreshCookie(response, refreshToken);
  return response;
}
