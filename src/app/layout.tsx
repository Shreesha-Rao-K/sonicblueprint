import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SonicBlueprint — Online Music Composition Tool & Chord Progression Builder",
    template: "%s · SonicBlueprint",
  },
  description:
    "SonicBlueprint is a free browser-based music composition tool. Build chord progressions, design drum patterns, arrange sections, hear every edit instantly, and export MP3, MIDI and PDF blueprints.",
  keywords: [
    "music composition tool",
    "chord progression builder",
    "instrumental maker",
    "music blueprint",
    "drum pattern builder",
    "music arrangement tool",
  ],
  authors: [{ name: "SonicBlueprint" }],
  creator: "SonicBlueprint",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "SonicBlueprint",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#06070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
