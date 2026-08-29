import { getSession } from "@/lib/security/session";
import { resolveSitePlatform } from "@/modules/platforms/types";
import { parseLegalPlatformParam } from "@/modules/legal/platform";

/** Prefer explicit ?platform=, else signed-in workspace platform, else Wix. */
export async function resolveLegalPlatform(rawParam?: string | null) {
  const fromQuery = parseLegalPlatformParam(rawParam);
  if (fromQuery) return fromQuery;
  const session = await getSession();
  return resolveSitePlatform(session?.platform);
}
