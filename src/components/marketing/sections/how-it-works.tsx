import { Check } from "lucide-react";
import { Reveal } from "../motion/motion";
import { Container, Section, SectionHeader } from "../ui/primitives";

const steps = [
  {
    title: "Bring what you have",
    body: "An idea, a script, or a recording you own. One sentence is enough to start.",
  },
  {
    title: "Clipvero builds the video",
    body: "Scenes, captions, timing and visuals are assembled together so they fit each other.",
  },
  {
    title: "Review, change, render",
    body: "Adjust any scene in the editor, render an MP4, and approve the revision you want to keep.",
  },
];

const handled = [
  {
    title: "Script",
    body: "Written from your idea, or your own words kept as written.",
  },
  {
    title: "Scenes",
    body: "Paced into scenes with timing that fits the length you pick.",
  },
  {
    title: "Captions",
    body: "On screen and editable, in your colors and position.",
  },
  {
    title: "Narration",
    body: "AI voices for AI-written videos, or your own audio.",
  },
  {
    title: "Visuals",
    body: "Original illustrations or your own uploaded footage.",
  },
  {
    title: "Render",
    body: "A real MP4 in 9:16, 1:1 or 16:9, ready to download.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-title">
      <Container className="grid items-start gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div className="flex flex-col gap-10">
          <SectionHeader
            id="how-title"
            align="left"
            eyebrow="How it works"
            title="From the brief to the final cut."
          />
          <ol className="flex flex-col gap-8">
            {steps.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                delay={i * 0.08}
                className="group flex gap-5"
              >
                <span className="mk-mono flex size-11 shrink-0 items-center justify-center rounded-md border border-(--border) text-sm text-(--secondary)">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1.5 pt-1">
                  <h3 className="mk-h3">{step.title}</h3>
                  <p className="mk-body">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={0.1} className="mk-card mk-card-raised p-6 sm:p-8">
          <p className="mk-eyebrow">Handled for you</p>
          <ul className="mt-6 divide-y divide-(--border)">
            {handled.map((item) => (
              <li
                key={item.title}
                className="group grid grid-cols-[auto_1fr] items-start gap-x-4 py-4 sm:grid-cols-[auto_7.5rem_1fr]"
              >
                <span
                  className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-(--accent) text-white transition-transform duration-300 group-hover:scale-110"
                  aria-hidden="true"
                >
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="font-semibold">{item.title}</span>
                <span className="col-start-2 text-(--secondary) sm:col-start-3">
                  {item.body}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
