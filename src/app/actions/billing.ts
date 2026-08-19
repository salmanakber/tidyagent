"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/security/session";
import { syncSubscriptionFromWix } from "@/modules/billing/service";

export async function refreshWixBilling() {
  const session = await requireSession();
  await syncSubscriptionFromWix(session.wixInstanceId);
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}
