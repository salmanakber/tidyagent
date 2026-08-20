import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { refreshStaleSites } from "@/modules/knowledge/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const env = getEnv();
  const secret = process.env.CRON_SECRET || env.SESSION_SECRET;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const query = new URL(request.url).searchParams.get("secret") ?? "";
  return Boolean(secret) && (header === secret || query === secret);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await refreshStaleSites();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
