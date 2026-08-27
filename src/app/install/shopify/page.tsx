import type { Metadata } from "next";
import { InstallGuideView } from "@/components/marketing/InstallGuideView";
import { SHOPIFY_INSTALL_GUIDE } from "@/modules/platforms/install-guide";

export const metadata: Metadata = {
  title: "Install on Shopify — tidyAgent",
  description: "How to install tidyAgent on Shopify and which Admin API permissions we request.",
};

export default function ShopifyInstallPage() {
  return <InstallGuideView guide={SHOPIFY_INSTALL_GUIDE} />;
}
