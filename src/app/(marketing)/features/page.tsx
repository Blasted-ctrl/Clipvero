import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  capabilities,
  type CapabilityId,
} from "@/components/marketing/data/capabilities";
import { featureIcons } from "@/components/marketing/data/feature-icons";
import {
  featureHref,
  featurePages,
} from "@/components/marketing/data/features";
import { EditorDemo } from "@/components/marketing/editor/editor-demo";
import { Reveal } from "@/components/marketing/motion/motion";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { HowItWorks } from "@/components/marketing/sections/how-it-works";
import { PageHero } from "@/components/marketing/sections/page-hero";
import { JsonLd, breadcrumbLd } from "@/components/marketing/seo/json-ld";
import {
  CapabilityBadge,
  Container,
  CtaLink,
  Section,
  SectionHeader,
} from "@/components/marketing/ui/primitives";
import { ProductCard } from "@/components/marketing/ui/product-card";
import { appRoutes } from "@/components/marketing/lib/app-routes";

export const metadata: Metadata = pageMetadata({
  title: "Features",
  description:
    "AI video generation, reusable characters, gameplay narration, explainers, automatic clipping, a browser editor and Autopilot pipelines. See what's available today and what's coming next.",
  path: "/features",
});

const capabilityGroups: { title: string; ids: CapabilityId[] }[] = [
  {
    title: "Create",
    ids: [
      "promptToVideo",
      "scriptToVideo",
      "scriptFileImport",
      "characters",
      "narration",
      "originalImages",
      "uploads",
      "autoClipping",
    ],
  },
  {
    title: "Edit and review",
    ids: [
      "browserEditor",
      "editCommands",
      "presets",
      "mp4Render",
      "reviewApproval",
      "reminders",
      "autopilot",
    ],
  },
  {
    title: "Coming next",
    ids: [
      "scriptNarration",
      "templates",
      "speakerTracking",
      "urlImport",
      "documentImport",
      "multiVoiceDialogue",
      "chatStories",
      "elementRegeneration",
      "directPublishing",
      "analytics",
      "teamReview",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Features", path: "/features" },
        ])}
      />
      <PageHero
        eyebrow="Features"
        title="Everything between an idea and a finished short."
        lead="Generators for every format, an editor that renders exactly what you preview, and pipelines that keep drafting while you focus on the next idea."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <CtaLink href={appRoutes.signUp} size="lg" arrow>
            Start creating
          </CtaLink>
          <CtaLink href="/explore" variant="secondary" size="lg">
            Explore examples
          </CtaLink>
        </div>
      </PageHero>

      <Section labelledBy="generators-title" className="pt-4 sm:pt-8">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            id="generators-title"
            eyebrow="Video generators"
            title="Choose where to start."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featurePages.map((page, i) => {
              const Icon = featureIcons[page.slug];
              return (
                <Reveal as="li" key={page.slug} delay={(i % 3) * 0.06}>
                  <ProductCard className="mk-lift h-full">
                    <Link
                      href={featureHref(page.slug)}
                      className="group flex h-full flex-col gap-4 rounded-[inherit] p-6"
                    >
                      <span className="flex size-11 items-center justify-center rounded-xl border border-(--accent)/30 bg-(--accent)/12 text-(--accent-hover) transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="flex flex-col gap-2">
                        <span className="mk-h3 flex items-center justify-between gap-2">
                          {page.navLabel}
                          <ArrowUpRight
                            size={18}
                            aria-hidden="true"
                            className="text-(--muted) transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--text)"
                          />
                        </span>
                        <span className="mk-body text-[0.9375rem]">
                          {page.metaDescription}
                        </span>
                      </span>
                    </Link>
                  </ProductCard>
                </Reveal>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="editor-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="editor-title"
            eyebrow="The editor"
            title="Trim, reframe and restyle in one place."
            lead="Keep the right moments. Set exact in and out points, switch to vertical, and give the captions your own treatment."
          />
          <Reveal>
            <EditorDemo />
          </Reveal>
        </Container>
      </Section>

      <HowItWorks />

      <Section labelledBy="status-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="status-title"
            eyebrow="Availability"
            title="What works today, and what's next."
            lead="We label capabilities honestly. Upcoming items are in development and not yet part of any plan."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {capabilityGroups.map((group, i) => (
              <Reveal
                key={group.title}
                delay={i * 0.08}
                className="mk-card p-6"
              >
                <h3 className="mk-h4">{group.title}</h3>
                <ul className="mt-4 flex flex-col divide-y divide-(--border)">
                  {group.ids.map((id) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-3 py-2.5 text-[0.9375rem]"
                    >
                      <span
                        className={
                          capabilities[id].status === "upcoming"
                            ? "text-(--secondary)"
                            : undefined
                        }
                      >
                        {capabilities[id].label}
                      </span>
                      <CapabilityBadge id={id} showAvailable />
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <CtaSection />
    </>
  );
}
