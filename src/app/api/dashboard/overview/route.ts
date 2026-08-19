import { NextResponse } from "next/server";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getDashboardOverview(session);
  return NextResponse.json(data);
}
