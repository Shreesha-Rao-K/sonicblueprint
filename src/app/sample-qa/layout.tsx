import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Sample QA & Diagnostic Lab",
  description: "Internal developer diagnostics and audio sample validation suite.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SampleQaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
