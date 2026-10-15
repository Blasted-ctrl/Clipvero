import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AutopilotSection } from "@/components/marketing/autopilot/autopilot-section";
import { faqEntries } from "@/components/marketing/data/faq";
import { showcaseEntries } from "@/components/marketing/data/showcase";
import { EditorDemo } from "@/components/marketing/editor/editor-demo";
import { FaqAccordion } from "@/components/marketing/faq/faq-accordion";
import { Hero } from "@/components/marketing/hero/hero";
import { Reveal } from "@/components/marketing/motion/motion";
import { PlanCards } from "@/components/marketing/pricing/pricing";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { HowItWorks } from "@/components/marketing/sections/how-it-works";
import {
  JsonLd,
  organizationLd,
  softwareLd,
} from "@/components/marketing/seo/json-ld";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import {
  siteDescription,
  siteName,
  siteTagline,
} from "@/components/marketing/data/site";
import { ShowcaseGallery } from "@/components/marketing/showcase/showcase-gallery";
import {
  Container,
  Section,
  SectionHeader,
} from "@/components/marketing/ui/primitives";
import { currentUser } from "@/server/backend";

export const metadata: Metadata = pageMetadata({
  title: `${siteName} — ${siteTagline}`,
  description: siteDescription,
  path: "/",
});

const homeFaqIds = [
  "what-can-it-create",
  "editing-experience",
  "autopilot",
  "credits",
  "publish-platforms",
  "privacy",
];

export default async function HomePage() {
  // UI.md: authenticated visitors go to Overview.
  if (await currentUser()) redirect("/overview");
  return (
    <>
      <JsonLd data={[organizationLd(), softwareLd()]} />
      <Hero />

      <Section id="showcase" labelledBy="showcase-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="showcase-title"
            eyebrow="Showcase"
            title="A format for every part of your story."
            lead="Explore the treatments, pacing and possibilities. Choose a direction, then build on it."
          />
          <ShowcaseGallery
            entries={showcaseEntries.filter((entry) =>
              [
                "coffee-cup-launch",
                "podcast-remote-work",
                "tides-moon",
                "robots-wifi",
              ].includes(entry.id),
            )}
            showFilters={false}
          />
          <Link
            href="/explore"
            className="mk-inline-link inline-flex min-h-11 w-fit items-center gap-2 text-sm"
          >
            Explore all formats <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </Container>
      </Section>

      <HowItWorks />

      <Section id="editor" labelledBy="editor-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="editor-title"
            eyebrow="The editor"
            title="The details make the difference."
            lead="Find the right moment. Tighten the cut. Give the captions your own treatment. Every part stays editable."
          />
          <Reveal>
            <EditorDemo />
          </Reveal>
        </Container>
      </Section>

      <AutopilotSection />

      <Section id="pricing" labelledBy="pricing-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="pricing-title"
            eyebrow="Pricing"
            title="Plan for the work ahead."
            lead="The same creative tools on every plan. Choose your monthly production allowance; keep the credits you don't use."
          />
          <PlanCards />
          <Reveal className="text-center">
            <Link
              href="/pricing"
              className="mk-inline-link inline-flex min-h-11 items-center gap-1.5 font-medium"
            >
              How credits work
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Reveal>
        </Container>
      </Section>

      <Section id="faq" labelledBy="faq-title">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            id="faq-title"
            align="left"
            eyebrow="FAQ"
            title="Questions, answered."
            lead="Can't find what you need? Read the full FAQ or contact us."
          >
            <Link
              href="/faq"
              className="mk-inline-link inline-flex min-h-11 items-center gap-1.5 font-medium"
            >
              See all questions
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </SectionHeader>
          <FaqAccordion
            items={faqEntries.filter((entry) => homeFaqIds.includes(entry.id))}
          />
        </Container>
      </Section>

      <CtaSection />
    </>
  );
}
