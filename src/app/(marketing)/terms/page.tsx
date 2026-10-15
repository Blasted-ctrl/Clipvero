import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import { LegalPending } from "@/components/marketing/sections/legal-pending";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "Clipvero's Terms of Service will be published here once finalized.",
  path: "/terms",
  index: false,
});

export default function TermsPage() {
  return <LegalPending document="Terms of Service" />;
}
