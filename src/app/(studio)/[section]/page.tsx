import { StudioPage } from "@/components/studio-pages";
import { notFound } from "next/navigation";
import { usesFastAPI } from "@/server/backend";
import { FoundationPage } from "@/components/foundation";
const sections = [
  "overview",
  "create",
  "projects",
  "characters",
  "pipelines",
  "review",
  "calendar",
  "analytics",
  "assets",
  "settings",
  "billing",
  "help",
];
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (usesFastAPI()) {
    if (
      section !== "overview" &&
      section !== "settings" &&
      section !== "projects"
    )
      notFound();
    return <FoundationPage section={section} />;
  }
  if (!sections.includes(section)) notFound();
  return <StudioPage section={section} />;
}
