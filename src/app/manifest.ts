import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SonicBlueprint — Music Composition Tool",
    short_name: "SonicBlueprint",
    description:
      "Design chords, drums, bass and arrangements in your browser and export MP3, MIDI and PDF blueprints.",
    start_url: "/dashboard",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#06070d",
    theme_color: "#06070d",
    categories: ["music", "audio", "multimedia", "productivity"],
    shortcuts: [
      {
        name: "New Studio Session",
        short_name: "New Studio",
        description: "Launch a new SonicBlueprint DAW project session",
        url: "/studio/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Chord & Drum Presets",
        short_name: "Presets",
        description: "Explore 40+ chord progressions and drum patterns",
        url: "/presets",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Video Tutorials",
        short_name: "Tutorials",
        description: "Watch the 7-minute studio masterclass",
        url: "/tutorials",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
