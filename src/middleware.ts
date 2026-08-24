import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FRAME_ANCESTORS_CSP } from "@/modules/platforms/frame-ancestors";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const webhookPath = pathname.replace(/\/+$/, "") || "/";
  if (webhookPath === "/api/wix/webhooks" || webhookPath === "/api/wix/webhook" || webhookPath === "/webhook") {
    if (pathname !== "/api/wix/webhooks") {
      const url = request.nextUrl.clone();
      url.pathname = "/api/wix/webhooks";
      return NextResponse.rewrite(url);
    }
  }

  // Trigger test sometimes POSTs the JWT to the app URL instead of the webhook path.
  if (
    request.method === "POST" &&
    (pathname === "/" || pathname === "/wix/open") &&
    !request.headers.has("next-action")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/wix/webhooks";
    return NextResponse.rewrite(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-tidyagent-path", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", FRAME_ANCESTORS_CSP);
  response.headers.delete("X-Frame-Options");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|widget.js|widget/).*)"],
};
