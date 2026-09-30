import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Projects",
  description:
    "Your saved SonicBlueprint songs, stored privately in your browser. Reopen, rename, duplicate or back them up.",
  alternates: { canonical: "/projects" },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
