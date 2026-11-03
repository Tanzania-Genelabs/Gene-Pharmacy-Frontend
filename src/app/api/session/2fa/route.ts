import { NextResponse, type NextRequest } from "next/server";
import { callBackend, setRefreshCookie, upstreamHeaders } from "@/lib/session.server";

/** Second step of signing in for accounts with two-factor: trades the ticket and a code for a session. */
export async function POST(request: NextRequest) {
  const upstream = await callBackend("/api/v1/auth/2fa/verify", {
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

  const { refreshToken, ...session } = data;
  const response = NextResponse.json(session);
  setRefreshCookie(response, refreshToken);
  return response;
}
