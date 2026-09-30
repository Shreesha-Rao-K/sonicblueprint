import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Playback preferences and local data management for SonicBlueprint.",
  alternates: { canonical: "/settings" },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
