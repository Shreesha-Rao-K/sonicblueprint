import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SonicBlueprint — Music Composition Tool",
    short_name: "SonicBlueprint",
    description:
      "Design chords, drums, bass and arrangements in your browser and export MP3, MIDI and PDF blueprints.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#06070d",
    theme_color: "#06070d",
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
