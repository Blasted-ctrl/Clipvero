import { appRoutes, signUpHref } from "../lib/app-routes";
import { Reveal } from "../motion/motion";
import { Container, CtaLink, Section, SectionHeader } from "../ui/primitives";
import { AutopilotDemo } from "./autopilot-demo";

export const autopilotSteps = [
  {
    title: "Pick your content format",
    body: "Choose any format, from explainers to character stories, and the topic it should cover.",
  },
  {
    title: "Customize the look and voice",
    body: "Save caption colors, placement, voice and tone as a reusable style.",
  },
  {
    title: "Set your schedule",
    body: "Run daily, weekly or up to every 30 days, with a run cap and a total credit budget.",
  },
  {
    title: "Review or approve",
    body: "Every run lands in your review queue. Approve it, return it to draft, or set a posting reminder.",
  },
  {
    title: "Let Clipvero produce the videos",
    body: "Runs keep drafting on schedule until you pause, or until a limit is reached.",
  },
];

export function AutopilotSection({
  headingLevel = "h2",
}: {
  headingLevel?: "h1" | "h2";
}) {
  return (
    <Section
      id="autopilot"
      labelledBy="autopilot-title"
      className="overflow-hidden"
    >
      <Container className="relative flex flex-col gap-14">
        <SectionHeader
          id="autopilot-title"
          as={headingLevel}
          eyebrow="Autopilot"
          title="A repeatable process. A consistent output."
          lead="Set the format, style, schedule and budget once. Review each draft before it leaves your workspace."
        >
          <CtaLink
            href={signUpHref(appRoutes.autopilot)}
            size="lg"
            arrow
            className="mt-2"
          >
            Set up your Autopilot
          </CtaLink>
        </SectionHeader>

        <Reveal>
          <AutopilotDemo />
        </Reveal>

        <ol className="mk-process-steps grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {autopilotSteps.map((step, i) => (
            <Reveal
              as="li"
              key={step.title}
              delay={i * 0.06}
              className="group flex flex-col gap-3 border-t border-(--border) px-1 py-5"
            >
              <span className="mk-mono text-[0.8125rem] font-semibold text-(--accent-hover) transition-transform duration-300 group-hover:translate-x-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mk-h4">{step.title}</h3>
              <p className="mk-body text-[0.9375rem]">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
