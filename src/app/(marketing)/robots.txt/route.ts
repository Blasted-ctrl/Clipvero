import { siteUrl } from "@/components/marketing/data/site";

/** Served as a route handler: a metadata file inside a route group would be shadowed by the studio's `[section]` route. */
export const dynamic = "force-static";

const privatePaths = [
  "/api/",
  "/overview",
  "/create",
  "/projects",
  "/characters",
  "/pipelines",
  "/review",
  "/calendar",
  "/analytics",
  "/assets",
  "/settings",
  "/billing",
  "/help",
  "/editor/",
];

export function GET() {
  const base = siteUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    ...privatePaths.map((path) => `Disallow: ${path}`),
    "",
    `Host: ${base}`,
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
