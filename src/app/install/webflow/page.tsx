import type { Metadata } from "next";
import { InstallGuideView } from "@/components/marketing/InstallGuideView";
import { WEBFLOW_INSTALL_GUIDE } from "@/modules/platforms/install-guide";

export const metadata: Metadata = {
  title: "Install on Webflow — tidyAgent",
  description: "How to install tidyAgent on Webflow and which Data Client permissions we request.",
};

export default function WebflowInstallPage() {
  return <InstallGuideView guide={WEBFLOW_INSTALL_GUIDE} />;
}
