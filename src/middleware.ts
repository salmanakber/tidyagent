import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/wix/webhooks/") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/wix/webhooks";
    return NextResponse.rewrite(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-tidyagent-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|widget.js|widget/).*)"],
};
