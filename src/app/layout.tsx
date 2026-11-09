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
    "SonicBlueprint is a free browser-based digital audio workstation (DAW) and music composition tool. Build chord progressions, design polyrhythmic drum patterns, sculpt basslines, hear edits in real time, and export MP3, MIDI, and PDF blueprints.",
  keywords: [
    "music composition tool",
    "chord progression builder",
    "in-browser DAW",
    "web audio synthesizer",
    "digital audio workstation",
    "instrumental maker",
    "drum pattern sequencer",
    "music blueprint",
    "modal chord algebra",
    "arpeggiator",
    "music arrangement tool",
  ],
  category: "multimedia",
  authors: [{ name: "SonicBlueprint" }],
  creator: "SonicBlueprint",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "SonicBlueprint",
    locale: "en_US",
    url: siteUrl,
    title: "SonicBlueprint — In-Browser DAW & Music Composition Studio",
    description:
      "Compose chord progressions, polyrhythmic drums, basslines, and master DSP effects with instant synthesis and offline export in your browser.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SonicBlueprint in-browser DAW studio workspace",
      },
      {
        url: "/og-image-square.png",
        width: 1200,
        height: 1200,
        alt: "SonicBlueprint logo badge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SonicBlueprint — In-Browser DAW & Music Composition Studio",
    description:
      "Build chords, drum grids, and arrangements in real-time. Export MP3, MIDI, and PDF blueprints directly from your browser.",
    images: ["/og-image.png"],
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

const rootStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": `${siteUrl}/#software`,
      "name": "SonicBlueprint",
      "url": siteUrl,
      "applicationCategory": "MultimediaApplication",
      "applicationSubCategory": "Digital Audio Workstation (DAW)",
      "operatingSystem": "Any (Web Browser with Web Audio API)",
      "browserRequirements": "Requires modern browser with Web Audio API and WebAssembly support",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "description":
        "Professional in-browser DAW for music composition, chord progression design, polyrhythmic drum sequencing, and master DSP audio effects with zero server dependencies.",
      "featureList": [
        "Offline-first Web Audio synthesis and DSP engine",
        "40 chord progression loops with automatic modal transpositions",
        "Interactive guitar and bass fretboard chord inspector",
        "Piano roll and harmonic chord voicing visualizer",
        "8-track 16-step polyrhythmic drum sequencer with velocity swing",
        "Algorithmic bassline generator and dynamic melody composer",
        "Hardware-modeled stereo chorus, flanger, and dynamics compressor",
        "Browser-rendered MP3 (LAME CBR/VBR), MIDI, and PDF lead sheet export",
        "Zero external network dependencies or analytics tracking",
      ],
      "screenshot": `${siteUrl}/og-image.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "SonicBlueprint",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${siteUrl}/presets?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script>
          {`(function(){try{var s=localStorage.getItem("sonic_theme");var t=(s==="analog"||s==="slate")?s:"cyberpunk";document.documentElement.setAttribute("data-theme",t);}catch(e){}})()`}
        </script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rootStructuredData) }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
