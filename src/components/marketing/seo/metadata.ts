import type { Metadata } from "next";
import { siteName } from "../data/site";

export const ogImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: `${siteName}: a workspace for video production`,
};

/**
 * Complete per-page metadata. Next.js replaces (not merges) nested `openGraph`
 * and `twitter` objects, so every page sets them in full.
 */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const fullTitle = path === "/" ? title : `${title} · ${siteName}`;
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: { index, follow: true },
    openGraph: {
      type: "website",
      siteName,
      locale: "en_US",
      url: path,
      title: fullTitle,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage.url],
    },
  };
}
