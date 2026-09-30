import type { Metadata } from "next";

// The studio renders private, user-specific editor state entirely in the
// browser, so its dynamic URLs are kept out of search indexes.
export const metadata: Metadata = {
  title: "Studio",
  description:
    "The SonicBlueprint studio: shape chords, drums, bass, instruments and song structure, then export your instrumental.",
  robots: { index: false, follow: true },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
