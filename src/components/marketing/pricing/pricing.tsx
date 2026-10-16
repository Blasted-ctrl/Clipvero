import { Check, Info } from "lucide-react";
import { estimateCost, plans, type CreateInput } from "@/lib/model";
import { trialCredits } from "../data/site";
import { appRoutes, signUpHref } from "../lib/app-routes";
import { Reveal } from "../motion/motion";
import { CtaLink } from "../ui/primitives";
import { cn } from "@/components/ui/button";

type PlanKey = keyof typeof plans;

const planCopy: Record<PlanKey, { blurb: string; recommended?: boolean }> = {
  starter: { blurb: "For getting started with a few videos a week." },
  creator: {
    blurb: "For posting consistently across one or two series.",
    recommended: true,
  },
  studio: { blurb: "For high-volume channels running several Autopilots." },
};

const included = [
  "Scene editor and MP4 exports",
  "AI scripts, narration and original images",
  "Reusable characters and style presets",
  "Autopilot pipelines with review queue",
  "Long video to clips",
  "Review approvals and posting reminders",
];

const limits = [
  "Videos up to 180 seconds",
  "Uploads up to 100 MB each",
  "9:16, 1:1 and 16:9",
];

export function PlanCards({
  headingLevel = "h3",
}: {
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const keys = Object.keys(plans) as PlanKey[];
  return (
    <ul className="grid gap-5 lg:grid-cols-3">
      {keys.map((key, i) => {
        const plan = plans[key];
        const copy = planCopy[key];
        return (
          <Reveal as="li" key={key} delay={i * 0.08} className="flex">
            <article
              aria-labelledby={`plan-${key}`}
              className={cn(
                "mk-card mk-plan-card relative flex w-full flex-col gap-6 p-6 sm:p-7",
                copy.recommended ? "mk-plan-featured" : "",
              )}
            >
              <div className="flex min-h-8 items-center justify-between gap-3">
                <Heading id={`plan-${key}`} className="mk-h3">
                  {plan.name}
                </Heading>
                {copy.recommended && (
                  <span className="mk-badge mk-badge-accent">Recommended</span>
                )}
              </div>
              <p className="mk-body -mt-3 min-h-[3em] text-[0.9375rem]">
                {copy.blurb}
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-5xl font-semibold tracking-[-0.04em]">
                  ${plan.price}
                </span>
                <span className="text-(--secondary)">/ month</span>
              </p>

              <div className="rounded-xl border border-(--border) bg-(--bg)/60 p-4">
                <p className="text-lg font-semibold">
                  {plan.credits.toLocaleString("en-US")} credits{" "}
                  <span className="font-normal text-(--secondary)">
                    / month
                  </span>
                </p>
                <p className="mt-1 text-[0.875rem] text-(--secondary)">
                  Allowance for {plan.videos} standard videos. Unused credits
                  stay in your balance.
                </p>
              </div>

              <CtaLink
                href={signUpHref(`${appRoutes.billing}?plan=${key}`)}
                variant={copy.recommended ? "primary" : "secondary"}
                arrow
                className="w-full"
                aria-label={`Choose ${plan.name}, $${plan.price} per month`}
              >
                Choose {plan.name}
              </CtaLink>

              <div className="flex flex-col gap-3">
                <p className="mk-overline">Everything included</p>
                <ul className="flex flex-col gap-2.5 text-[0.9375rem]">
                  {included.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check
                        size={17}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-(--accent-hover)"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto flex flex-col gap-2 border-t border-(--border) pt-4">
                <p className="mk-overline">Limits</p>
                <ul className="flex flex-wrap gap-1.5">
                  {limits.map((item) => (
                    <li key={item} className="mk-chip">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </Reveal>
        );
      })}
    </ul>
  );
}

const base: CreateInput = {
  title: "Example",
  style: "classic",
  visual: "grid",
  mode: "prompt",
  content: "Example",
  duration: 45,
  aspect: "9:16",
  voice: "none",
  tone: "Conversational",
  language: "English",
  generateImages: false,
  characterIds: [],
  clipCount: 3,
  rightsConfirmed: true,
};

/** Credit examples computed from the same estimator the studio uses. */
export const creditExamples = [
  {
    label: "Your own script, rendered",
    credits: estimateCost({ ...base, mode: "script" }),
  },
  { label: "AI-written script and scenes", credits: estimateCost(base) },
  {
    label: "…with AI narration",
    credits: estimateCost({ ...base, voice: "sage" }),
  },
  {
    label: "Standard video: narration and images",
    credits: estimateCost({ ...base, voice: "sage", generateImages: true }),
  },
  {
    label: "Three clips from a long recording",
    credits: estimateCost({ ...base, mode: "clips", clipCount: 3 }),
  },
];

export function PricingNotes() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Reveal className="mk-card p-6">
        <h3 className="mk-h4">How credits work</h3>
        <ul className="mt-4 flex flex-col gap-2.5 text-[0.9375rem] text-(--secondary)">
          <li>
            A standard video is up to 60 seconds with a script, AI narration
            with timed captions, up to six images and the final render. It uses
            10 credits.
          </li>
          <li>
            Your own scripts are free to edit. Rendering uses 1 credit per
            started minute of video.
          </li>
          <li>
            Clips use 5 credits per excerpt, plus 1 per started minute of target
            length.
          </li>
          <li>
            Credits are reserved when a job starts and refunded automatically if
            it fails. Unused paid allowances accumulate.
          </li>
        </ul>
      </Reveal>
      <Reveal delay={0.08} className="mk-card p-6">
        <h3 className="mk-h4">Example generation costs</h3>
        <dl
          className="mt-4 flex flex-col divide-y divide-(--border)"
          style={{ margin: "16px 0 0" }}
        >
          {creditExamples.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-2.5 text-[0.9375rem]"
            >
              <dt className="text-(--secondary)">{row.label}</dt>
              <dd className="mk-mono m-0 shrink-0 font-semibold">
                {row.credits} credits
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[0.8125rem] text-(--muted)">
          45-second examples at current tariffs. The studio shows the exact
          price before a job starts.
        </p>
      </Reveal>
      <Reveal
        delay={0.12}
        className="flex items-start gap-3 rounded-xl border border-(--border) px-5 py-4 text-[0.875rem] text-(--secondary) lg:col-span-2"
      >
        <Info
          size={16}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-(--accent-hover)"
        />
        <p>
          New accounts start with {trialCredits} one-time trial credits, no card
          required. Paid plans are billed monthly in USD through Stripe checkout
          in your studio when billing is enabled, and credits are added only
          once payment is confirmed. Cancel any time from the billing portal.
        </p>
      </Reveal>
    </div>
  );
}
