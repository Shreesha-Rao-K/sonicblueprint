import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only stable public pages are listed. /studio/[id] holds private,
// user-specific editor state and is intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/presets`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/dashboard`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/projects`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/settings`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
