import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, callBackend, clearRefreshCookie, upstreamHeaders } from "@/lib/session.server";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const authorization = request.headers.get("authorization");

  // Best effort: revoke the token server-side. The cookie is cleared whatever happens.
  if (refreshToken && authorization) {
    await callBackend("/api/v1/auth/logout", {
      method: "POST",
      headers: upstreamHeaders(request, { Authorization: authorization }),
      body: JSON.stringify({ refreshToken }),
    });
  }

  const response = new NextResponse(null, { status: 204 });
  clearRefreshCookie(response);
  return response;
}
