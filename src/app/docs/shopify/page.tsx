import { redirect } from "next/navigation";
import { shopifyDocsPath } from "@/modules/legal/platform";

export default function LegacyShopifyDocsRedirect() {
  redirect(shopifyDocsPath());
}
