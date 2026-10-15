import type { MetadataRoute } from "next";
import { marketingRoutes, siteUrl } from "@/components/marketing/data/site";

const unindexed = new Set(["/terms", "/privacy"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return marketingRoutes
    .filter((route) => !unindexed.has(route))
    .map((route) => ({
      url: `${base}${route === "/" ? "" : route}`,
      changeFrequency: route === "/" ? "weekly" : "monthly",
      priority: route === "/" ? 1 : route.startsWith("/features/") ? 0.7 : 0.8,
    }));
}
