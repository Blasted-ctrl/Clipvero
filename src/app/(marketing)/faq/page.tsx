import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import Link from "next/link";
import { faqEntries } from "@/components/marketing/data/faq";
import { FaqAccordion } from "@/components/marketing/faq/faq-accordion";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { PageHero } from "@/components/marketing/sections/page-hero";
import {
  JsonLd,
  breadcrumbLd,
  faqLd,
} from "@/components/marketing/seo/json-ld";
import { Container, Section } from "@/components/marketing/ui/primitives";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers about what Clipvero can create, editing, uploads, characters, Autopilot, publishing, credits, commercial use, failed renders, cancellation and privacy.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
          faqLd(),
        ]}
      />
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered."
        lead={
          <>
            Everything you need to know before your first video. Still curious?{" "}
            <Link href="/contact" className="mk-inline-link">
              Get in touch
            </Link>
            .
          </>
        }
      />
      <Section labelledBy="page-title" className="pt-2 sm:pt-4">
        <Container className="max-w-[880px]">
          <FaqAccordion
            items={faqEntries}
            headingLevel="h2"
            defaultOpen={faqEntries[0].id}
          />
        </Container>
      </Section>
      <CtaSection />
    </>
  );
}
