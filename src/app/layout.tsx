import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Outfit, Syne } from "next/font/google";
import { getSession } from "@/lib/security/session";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { isShopifyPlatform } from "@/modules/platforms/types";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "tidyAgent — AI employee for Wix",
  description:
    "Connect your Wix website. Answer a few simple questions. Your AI employee understands your business and starts helping customers 24/7.",
  icons: {
    icon: [{ url: "/images/logo-icon.png", type: "image/png" }],
    shortcut: "/images/logo-icon.png",
    apple: "/images/logo-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-tidyagent-path") || "";
  const session = await getSession();
  const shopifyEmbedded =
    path === "/shopify" || path.startsWith("/shopify/") || isShopifyPlatform(session?.platform);
  let shopifyApiKey = "";
  if (shopifyEmbedded) {
    shopifyApiKey = (await getShopifyOAuthConfig()).apiKey || "";
  }

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("tidyagent-theme")==="light")document.documentElement.classList.add("theme-light")}catch(e){}})();`,
          }}
        />
        {shopifyApiKey ? (
          <>
            {/* Must be a real sync <script> in initial HTML — not next/script (preload). */}
            <meta name="shopify-api-key" content={shopifyApiKey} />
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        ) : null}
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
