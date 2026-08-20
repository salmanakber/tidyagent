import { after, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyStatus() {
  const key = process.env.WIX_APP_PUBLIC_KEY ?? "";
  return { hasPublicKey: key.trim().length > 0, keyChars: key.trim().length };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

/** Wix Trigger test fails unless POST is HTTP 200 within 1250ms. Never wait on JWT/DB. */
function received() {
  return new NextResponse("ok", {
    status: 200,
    headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "wix-webhooks", ...keyStatus() }, { headers: corsHeaders() });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: Request) {
  let raw = "";
  let authorization: string | null = null;
  let contentType: string | null = null;
  try {
    raw = await request.text();
    authorization = request.headers.get("authorization");
    contentType = request.headers.get("content-type");
  } catch {
    /* still ack */
  }

  after(() => {
    void import("./handler")
      .then(({ handleWixWebhook }) => handleWixWebhook(raw, authorization, contentType))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "handler failed";
        console.error("[wix-webhook] background failed:", message);
      });
  });

  return received();
}
