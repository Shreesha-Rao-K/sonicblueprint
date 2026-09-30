import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preset Library",
  description:
    "Browse chord progression loops, drum patterns and instrument sounds to start your next song — every preset is fully editable.",
  alternates: { canonical: "/presets" },
};

export default function PresetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
