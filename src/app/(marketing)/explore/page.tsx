import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import { videoFormats } from "@/components/marketing/data/formats";
import { showcaseEntries } from "@/components/marketing/data/showcase";
import { FormatGrid } from "@/components/marketing/formats/format-grid";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { PageHero } from "@/components/marketing/sections/page-hero";
import { JsonLd, breadcrumbLd } from "@/components/marketing/seo/json-ld";
import { ShowcaseGallery } from "@/components/marketing/showcase/showcase-gallery";
import {
  Container,
  Section,
  SectionHeader,
} from "@/components/marketing/ui/primitives";

export const metadata: Metadata = pageMetadata({
  title: "Explore video formats and examples",
  description:
    "Browse short-form video formats you can create with Clipvero: character stories, explainers, gameplay narration, AI stories, product promos and auto-clipped highlights.",
  path: "/explore",
});

export default function ExplorePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Explore", path: "/explore" },
        ])}
      />
      <PageHero
        eyebrow="Explore"
        title="See what you can make."
        lead="Filter by format, press play, and start a similar video with one click. Every example opens the studio with the right setup."
      />
      <Section labelledBy="gallery-title" className="pt-4 sm:pt-6">
        <Container className="flex flex-col gap-8">
          <h2 id="gallery-title" className="sr-only">
            Example videos
          </h2>
          <ShowcaseGallery entries={showcaseEntries} priorityCount={4} />
        </Container>
      </Section>
      <Section labelledBy="formats-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="formats-title"
            eyebrow="Formats"
            title="Eight ways to start."
            lead="Each format has its own setup in the studio. Formats marked upcoming are on the way and can't be started yet."
          />
          <FormatGrid formats={videoFormats} />
        </Container>
      </Section>
      <CtaSection />
    </>
  );
}
