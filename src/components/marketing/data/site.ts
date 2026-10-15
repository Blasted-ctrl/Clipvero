import { featureHref, featurePages } from "./features";

/** Marketing copy uses the product name directly (CODING.md: APP_NAME labels the workspace). */
export const siteName = "Clipvero";
export const siteTagline = "A workspace for video production";
export const siteDescription =
  "Turn scripts and recordings into short-form video. Edit every scene, save your style, and keep production moving.";

export function siteUrl(): string {
  const raw = process.env.APP_URL || "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** One-time credits granted at registration (src/server/auth.ts `register`). */
export const trialCredits = 120;

export type NavLink = { href: string; label: string };

export const primaryNav: NavLink[] = [
  { href: "/explore", label: "Explore" },
  { href: "/features", label: "Features" },
  { href: "/autopilot", label: "Autopilot" },
  { href: "/pricing", label: "Pricing" },
];

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/explore", label: "Explore examples" },
      { href: "/features", label: "Features" },
      { href: "/autopilot", label: "Autopilot" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Video generators",
    links: featurePages.map((page) => ({
      href: featureHref(page.slug),
      label: page.navLabel,
    })),
  },
  {
    title: "Help",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

/** Every public marketing route, used by the sitemap. */
export const marketingRoutes: string[] = [
  "/",
  "/explore",
  "/features",
  ...featurePages.map((page) => featureHref(page.slug)),
  "/autopilot",
  "/pricing",
  "/faq",
  "/contact",
  "/terms",
  "/privacy",
];
