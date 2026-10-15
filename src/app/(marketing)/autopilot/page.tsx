import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import {
  BellRing,
  Gauge,
  PauseCircle,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";
import { AutopilotSection } from "@/components/marketing/autopilot/autopilot-section";
import { faqEntries } from "@/components/marketing/data/faq";
import { FaqAccordion } from "@/components/marketing/faq/faq-accordion";
import { Reveal } from "@/components/marketing/motion/motion";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import {
  JsonLd,
  breadcrumbLd,
  faqLd,
} from "@/components/marketing/seo/json-ld";
import {
  Container,
  Section,
  SectionHeader,
} from "@/components/marketing/ui/primitives";

export const metadata: Metadata = pageMetadata({
  title: "Autopilot: recurring short-form video pipelines",
  description:
    "Save a format and style, set a schedule, run cap and credit budget, and let Clipvero draft videos into your review queue. You approve every video.",
  path: "/autopilot",
});

const guardrails = [
  {
    icon: Timer,
    title: "Your schedule",
    body: "Run every day, every few days, or up to once every 30 days.",
  },
  {
    icon: Gauge,
    title: "Run cap",
    body: "Set a lifetime limit on how many runs a pipeline may make.",
  },
  {
    icon: Wallet,
    title: "Credit budget",
    body: "Cap the total credits a pipeline can commit. It stops when the budget is reached.",
  },
  {
    icon: PauseCircle,
    title: "Saved paused",
    body: "New pipelines start paused. Activate when you're ready, pause any time.",
  },
  {
    icon: ShieldCheck,
    title: "Review first",
    body: "Every run lands in your review queue. Approval needs the current render.",
  },
  {
    icon: BellRing,
    title: "Posting reminders",
    body: "Schedule a reminder for each approved video. Publishing stays manual for now.",
  },
];

const faqIds = ["autopilot", "publish-platforms", "credits", "render-fails"];

export default function AutopilotPage() {
  const items = faqEntries.filter((entry) => faqIds.includes(entry.id));
  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Autopilot", path: "/autopilot" },
          ]),
          faqLd(items),
        ]}
      />
      <div className="pt-16 sm:pt-20">
        <AutopilotSection headingLevel="h1" />
      </div>

      <Section labelledBy="guardrails-title">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            id="guardrails-title"
            eyebrow="Guardrails"
            title="Automation you stay in charge of."
            lead="Autopilot drafts on your schedule. Limits and review keep the output, and your credits, under your control."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guardrails.map((item, i) => (
              <Reveal
                as="li"
                key={item.title}
                delay={(i % 3) * 0.06}
                className="mk-card group flex flex-col gap-3 p-6 transition-colors duration-300 hover:border-(--accent)/40"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-(--accent)/12 text-(--accent-hover) transition-transform duration-300 group-hover:scale-110">
                  <item.icon size={19} aria-hidden="true" />
                </span>
                <h3 className="mk-h4">{item.title}</h3>
                <p className="mk-body text-[0.9375rem]">{item.body}</p>
              </Reveal>
            ))}
          </ul>
          <Reveal className="flex flex-wrap items-center justify-center gap-2 text-center text-[0.875rem] text-(--secondary)">
            <span className="mk-badge mk-badge-upcoming">Upcoming</span>
            Direct publishing to TikTok, Instagram and YouTube, and upload or
            source-change triggers.
          </Reveal>
        </Container>
      </Section>

      <Section labelledBy="autopilot-faq-title">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            id="autopilot-faq-title"
            align="left"
            eyebrow="FAQ"
            title="Autopilot questions."
          />
          <FaqAccordion items={items} defaultOpen="autopilot" />
        </Container>
      </Section>

      <CtaSection
        title="Set it up once. Review when you're ready."
        lead="Start with a single video, then turn the style you like into an Autopilot."
      />
    </>
  );
}
