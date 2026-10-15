import { StudioPage } from "@/components/studio-pages";
import { notFound } from "next/navigation";
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
  if (!sections.includes(section)) notFound();
  return <StudioPage section={section} />;
}
