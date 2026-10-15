import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import { faqEntries } from "@/components/marketing/data/faq";
import { trialCredits } from "@/components/marketing/data/site";
import { FaqAccordion } from "@/components/marketing/faq/faq-accordion";
import {
  PlanCards,
  PricingNotes,
} from "@/components/marketing/pricing/pricing";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { PageHero } from "@/components/marketing/sections/page-hero";
import {
  JsonLd,
  breadcrumbLd,
  faqLd,
  softwareLd,
} from "@/components/marketing/seo/json-ld";
import {
  Container,
  Section,
  SectionHeader,
} from "@/components/marketing/ui/primitives";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description: `Starter $29, Creator $79 and Studio $199 per month. Every plan includes the full studio and a monthly credit allowance. Start with ${trialCredits} trial credits, no card required.`,
  path: "/pricing",
});

const faqIds = ["credits", "cancel", "render-fails", "commercial-use"];

export default function PricingPage() {
  const items = faqEntries.filter((entry) => faqIds.includes(entry.id));
  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          softwareLd(),
          faqLd(items),
        ]}
      />
      <PageHero
        eyebrow="Pricing"
        title="Pick the pace you post at."
        lead={`Every plan includes the full studio. Plans differ by monthly credit allowance. Start with ${trialCredits} trial credits and no card.`}
      />
      <Section labelledBy="plans-title" className="pt-2 sm:pt-4">
        <Container className="flex flex-col gap-10">
          <h2 id="plans-title" className="sr-only">
            Plans
          </h2>
          <PlanCards />
          <PricingNotes />
        </Container>
      </Section>
      <Section labelledBy="pricing-faq-title">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            id="pricing-faq-title"
            align="left"
            eyebrow="FAQ"
            title="Billing questions."
          />
          <FaqAccordion items={items} defaultOpen="credits" />
        </Container>
      </Section>
      <CtaSection />
    </>
  );
}
