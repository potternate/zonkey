import type { MetadataRoute } from "next";
import { dailyArchiveDates } from "@/lib/game/archive";
import { toIsoDate } from "@/lib/game/daily";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date();
  const dailyPages: MetadataRoute.Sitemap = dailyArchiveDates(today).map(
    (date) => ({
      url: `https://zonkey.io/daily/${date}`,
      lastModified: new Date(`${date}T00:00:00Z`),
      changeFrequency: "never",
      priority: 0.6,
    }),
  );

  return [
    {
      url: "https://zonkey.io",
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://zonkey.io/daily",
      lastModified: new Date(`${toIsoDate(today)}T00:00:00Z`),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...dailyPages,
  ];
}
