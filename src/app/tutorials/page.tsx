import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { TutorialHub } from "@/components/tutorials/TutorialHub";

export const metadata: Metadata = {
  title: "Interactive Video Tutorials & Masterclass",
  description:
    "Master the SonicBlueprint in-browser DAW with synchronized chapter scrubbing, interactive transcript keyword search, and one-click 'Try in Studio' preset hydration.",
  openGraph: {
    title: "SonicBlueprint Tutorial Hub & Video Masterclass",
    description:
      "Interactive 7-minute masterclass covering chord voicings, polyrhythmic drum sequencing, basslines, and master DSP effects with live preset hydration.",
    type: "video.other",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SonicBlueprint Video Masterclass" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SonicBlueprint Tutorial Hub & Video Masterclass",
    description:
      "Interactive 7-minute masterclass covering chord voicings, polyrhythmic drum sequencing, basslines, and master DSP effects.",
    images: ["/og-image.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Course",
      "@id": "https://sonicblueprint.dev/tutorials#course",
      name: "SonicBlueprint In-Browser DAW Studio Masterclass",
      description:
        "Comprehensive educational masterclass and interactive tutorial for music composition, synthesis, and audio production.",
      educationalLevel: "Beginner to Advanced",
      learningResourceType: "Interactive Video Tutorial",
      provider: {
        "@type": "Organization",
        name: "SonicBlueprint",
        sameAs: "https://sonicblueprint.dev",
      },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: "PT7M",
      },
      teaches: [
        "Modal chord voicings and Drop-2 jazz algebra",
        "Polyrhythmic and polymeter drum sequencing",
        "Hardware-modeled DSP compression and reverb",
        "Dynamic song structure arrangement and energy curves",
      ],
    },
    {
      "@type": "VideoObject",
      "@id": "https://sonicblueprint.dev/tutorials#video",
      name: "SonicBlueprint Studio Masterclass",
      description: "7-minute comprehensive tutorial covering the full SonicBlueprint studio workflow.",
      thumbnailUrl: "https://sonicblueprint.dev/og-image.png",
      uploadDate: "2026-11-08T00:00:00Z",
      duration: "PT7M0S",
      contentUrl: "https://sonicblueprint.dev/tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4",
      embedUrl: "https://sonicblueprint.dev/tutorials",
      hasPart: [
        {
          "@type": "Clip",
          name: "Studio Workspace Overview",
          startOffset: 0,
          endOffset: 25,
          url: "https://sonicblueprint.dev/tutorials#pc-ch1-overview",
          description: "Project Initialization & Interface Tour: Zero-install DAW running 100% in your browser.",
        },
        {
          "@type": "Clip",
          name: "Chord Progression & Voicings",
          startOffset: 25,
          endOffset: 85,
          url: "https://sonicblueprint.dev/tutorials#pc-ch2-chords",
          description: "Modal Scales & Drop-2 Harmony: Drop-2 voicing opens up closed triads into rich studio harmonies.",
        },
        {
          "@type": "Clip",
          name: "Drum Sequencer & Polyrhythms",
          startOffset: 85,
          endOffset: 145,
          url: "https://sonicblueprint.dev/tutorials#pc-ch3-drums",
          description: "Poly-meter Grid & Velocity Accents: Independent row cycle lengths create evolving polyrhythmic motion.",
        },
        {
          "@type": "Clip",
          name: "Basslines & Arpeggiator",
          startOffset: 145,
          endOffset: 265,
          url: "https://sonicblueprint.dev/tutorials#pc-ch4-bass",
          description: "Root/Octave Rhythms & 1/16 Syncopation: Harmonically locked basslines anchor progressions and dynamic energy.",
        },
        {
          "@type": "Clip",
          name: "Instrument Mixer & Multisample Banks",
          startOffset: 265,
          endOffset: 305,
          url: "https://sonicblueprint.dev/tutorials#pc-ch5-mixer",
          description: "Acoustic Realism & Synthesis Layering: Multisampled instrument velocity layers blend realism with synth textures.",
        },
        {
          "@type": "Clip",
          name: "Song Arrangement Timeline",
          startOffset: 305,
          endOffset: 375,
          url: "https://sonicblueprint.dev/tutorials#pc-ch6-structure",
          description: "Dynamic Energy Curves & Section Scaffolding: Arrangement energy sliders automate per-section intensity.",
        },
        {
          "@type": "Clip",
          name: "Master DSP FX & Export Pipeline",
          startOffset: 375,
          endOffset: 420,
          url: "https://sonicblueprint.dev/tutorials#pc-ch7-effects",
          description: "Compressor Sidechain, Convolver & Lossless Audio: Hardware-modeled DSP effects provide professional master bus sheen.",
        },
      ],
    },
  ],
};

export default function TutorialsPage() {
  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <TutorialHub />
    </AppShell>
  );
}
