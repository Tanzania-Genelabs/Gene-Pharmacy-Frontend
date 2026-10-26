import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  callBackend,
  clearRefreshCookie,
  setRefreshCookie,
  upstreamHeaders,
} from "@/lib/session.server";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: "No active session" }, { status: 401 });
  }

  const upstream = await callBackend("/api/v1/auth/refresh", {
    method: "POST",
    headers: upstreamHeaders(request),
    body: JSON.stringify({ refreshToken }),
  });

  // A backend outage must not sign everybody out: keep the cookie and report a temporary failure.
  if (!upstream) {
    return NextResponse.json({ message: "The server is unreachable. Please try again." }, { status: 503 });
  }

  const data = await upstream.json().catch(() => null);

  if (upstream.status === 401 || upstream.status === 403) {
    const response = NextResponse.json({ message: "Session expired" }, { status: 401 });
    clearRefreshCookie(response);
    return response;
  }

  if (!upstream.ok || !data?.refreshToken) {
    return NextResponse.json({ message: "Could not refresh the session" }, { status: 503 });
  }

  const { refreshToken: rotated, ...session } = data;
  const response = NextResponse.json(session);
  setRefreshCookie(response, rotated);
  return response;
}
