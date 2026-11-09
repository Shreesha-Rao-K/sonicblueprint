import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preset Library — Chord Progressions, Drum Patterns & Sound Blueprints",
  description:
    "Browse chord progression loops, drum patterns and instrument sounds to start your next song — every preset is fully editable.",
  alternates: { canonical: "/presets" },
  openGraph: {
    title: "SonicBlueprint Preset Library",
    description:
      "Explore 40+ chord progressions, 20+ drum patterns, and full-song quick start templates with instant browser audition.",
    url: "/presets",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SonicBlueprint Presets" }],
  },
};

const presetsStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://sonicblueprint.dev/presets#collection",
      name: "SonicBlueprint Music Preset Library",
      description:
        "Comprehensive collection of chord progression loops, polyrhythmic drum patterns, and full-song starter blueprints.",
      url: "https://sonicblueprint.dev/presets",
      mainEntity: {
        "@type": "ItemList",
        name: "Music Production Presets & Blueprints",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Neo-Soul & Jazz Progressions",
            description: "Extended 9th, 11th, and Drop-2 chord voicings for neo-soul, R&B, and jazz.",
            url: "https://sonicblueprint.dev/presets?cat=neo-soul",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Pop & Mainstage Anthems",
            description: "High-energy I-V-vi-IV and minor-turnaround progressions for modern pop and dance.",
            url: "https://sonicblueprint.dev/presets?cat=pop",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Cinematic & Film Score Palettes",
            description: "Modal interchange, suspended textures, and dramatic minor lifts for screen scoring.",
            url: "https://sonicblueprint.dev/presets?cat=cinematic",
          },
          {
            "@type": "ListItem",
            position: 4,
            name: "Polyrhythmic & Boom-Bap Drum Kits",
            description: "16-step poly-meter drum patterns, syncopated boom-bap, trap hi-hat rolls, and UK garage.",
            url: "https://sonicblueprint.dev/presets?tab=drums",
          },
          {
            "@type": "ListItem",
            position: 5,
            name: "Full-Song Quick-Start Templates",
            description: "Thirteen production-ready multi-track templates with chords, drums, bass, and master DSP.",
            url: "https://sonicblueprint.dev/presets?tab=quickstarts",
          },
        ],
      },
    },
  ],
};

export default function PresetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(presetsStructuredData) }}
      />
      {children}
    </>
  );
}
