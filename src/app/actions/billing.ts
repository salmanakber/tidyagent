"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/security/session";
import { syncWixBillingForSession } from "@/modules/platforms";

export async function refreshWixBilling() {
  const session = await requireSession();
  await syncWixBillingForSession(session);
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}
