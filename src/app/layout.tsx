import type { Metadata, Viewport } from "next";
import { Outfit, Syne } from "next/font/google";
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
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
