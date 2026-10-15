import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { featureIcons } from "@/components/marketing/data/feature-icons";
import {
  featureHref,
  featurePages,
  getFeaturePage,
} from "@/components/marketing/data/features";
import { showcaseEntries } from "@/components/marketing/data/showcase";
import { FaqAccordion } from "@/components/marketing/faq/faq-accordion";
import { HeroComposer } from "@/components/marketing/hero/hero-composer";
import { Reveal } from "@/components/marketing/motion/motion";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { PageHero } from "@/components/marketing/sections/page-hero";
import {
  JsonLd,
  breadcrumbLd,
  faqLd,
} from "@/components/marketing/seo/json-ld";
import { VideoCard } from "@/components/marketing/showcase/video-card";
import {
  CapabilityBadge,
  Container,
  Section,
  SectionHeader,
} from "@/components/marketing/ui/primitives";
import { ProductCard } from "@/components/marketing/ui/product-card";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return featurePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = getFeaturePage((await params).slug);
  if (!page) return {};
  return pageMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: featureHref(page.slug),
  });
}

export default async function FeaturePage({ params }: Params) {
  const page = getFeaturePage((await params).slug);
  if (!page) notFound();
  const examples = page.showcase
    ? showcaseEntries.filter((entry) => entry.category === page.showcase)
    : showcaseEntries.slice(0, 4);
  const others = featurePages.filter((other) => other.slug !== page.slug);
  const faqItems = page.faqs.map((faq, i) => ({
    id: `${page.slug}-faq-${i}`,
    ...faq,
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Features", path: "/features" },
            { name: page.navLabel, path: featureHref(page.slug) },
          ]),
          faqLd(page.faqs),
        ]}
      />
      <PageHero
        eyebrow={page.eyebrow}
        title={page.headline}
        lead={page.intro}
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Features", href: "/features" },
          { name: page.navLabel, href: featureHref(page.slug) },
        ]}
      >
        <div className="w-full max-w-3xl">
          <HeroComposer
            key={page.slug}
            ideaMode={page.mode}
            scriptMode={page.mode === "gameplay" ? "gameplay" : "script"}
            defaultSource={
              page.mode === "clips"
                ? "upload"
                : page.mode === "gameplay"
                  ? "script"
                  : "idea"
            }
            example={page.examplePrompt}
          />
        </div>
      </PageHero>

      <Section labelledBy="steps-title" className="pt-6 sm:pt-10">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="steps-title"
            eyebrow="How it works"
            title="Three steps to a finished video."
          />
          <ol className="grid gap-4 md:grid-cols-3">
            {page.steps.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                delay={i * 0.08}
                className="mk-card group relative flex flex-col gap-3 overflow-hidden p-6"
              >
                <span
                  aria-hidden="true"
                  className="mk-mono absolute -right-2 -top-6 text-[6rem] font-bold leading-none text-white/[0.03] transition-transform duration-500 group-hover:-translate-y-1"
                >
                  {i + 1}
                </span>
                <span className="mk-mono text-[0.8125rem] font-semibold text-(--accent-hover)">
                  Step {i + 1}
                </span>
                <h3 className="mk-h3">{step.title}</h3>
                <p className="mk-body">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      <Section labelledBy="highlights-title">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            id="highlights-title"
            align="left"
            eyebrow="What you get"
            title={`Built for ${page.navLabel.toLowerCase()}.`}
          >
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Good for">
              {page.useCases.map((useCase) => (
                <li key={useCase} className="mk-chip">
                  {useCase}
                </li>
              ))}
            </ul>
          </SectionHeader>
          <ul className="grid gap-4 sm:grid-cols-2">
            {page.highlights.map((item, i) => (
              <Reveal as="li" key={item.title} delay={(i % 2) * 0.06}>
                <ProductCard className="flex h-full flex-col gap-3 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <CheckCircle2
                      size={20}
                      aria-hidden="true"
                      className="text-(--accent-hover)"
                    />
                    <CapabilityBadge id={item.capability} />
                  </div>
                  <h3 className="mk-h4">{item.title}</h3>
                  <p className="mk-body text-[0.9375rem]">{item.body}</p>
                </ProductCard>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="examples-title">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            id="examples-title"
            eyebrow="Examples"
            title="See the format."
            lead="Illustrative samples of the format. They were not generated by Clipvero."
          />
          <ul className="flex flex-wrap justify-center gap-5">
            {examples.map((entry) => (
              <li
                key={entry.id}
                className="w-full max-w-[300px] min-[480px]:w-[calc(50%-0.625rem)] lg:w-[260px]"
              >
                <VideoCard entry={entry} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="feature-faq-title">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            id="feature-faq-title"
            align="left"
            eyebrow="FAQ"
            title="Good to know."
          />
          <FaqAccordion items={faqItems} />
        </Container>
      </Section>

      <Section labelledBy="more-title" className="pb-0 sm:pb-0">
        <Container className="flex flex-col gap-8">
          <h2 id="more-title" className="mk-h3">
            More video generators
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => {
              const Icon = featureIcons[other.slug];
              return (
                <li key={other.slug}>
                  <Link
                    href={featureHref(other.slug)}
                    className="mk-card group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-300 hover:border-(--accent)/40 hover:bg-(--surface-2)"
                  >
                    <Icon
                      size={18}
                      aria-hidden="true"
                      className="text-(--accent-hover)"
                    />
                    <span className="flex-1 font-medium">{other.navLabel}</span>
                    <ArrowUpRight
                      size={16}
                      aria-hidden="true"
                      className="text-(--muted) transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <CtaSection />
    </>
  );
}
