import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import { LegalPending } from "@/components/marketing/sections/legal-pending";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "Clipvero's Privacy Policy will be published here once finalized.",
  path: "/privacy",
  index: false,
});

export default function PrivacyPage() {
  return <LegalPending document="Privacy Policy" />;
}
