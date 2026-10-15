import { appRoutes } from "../lib/app-routes";
import { trialCredits } from "../data/site";
import { Reveal } from "../motion/motion";
import { Container, CtaLink } from "../ui/primitives";

export function CtaSection({
  title = "Put your next video in motion.",
  lead = "Bring the brief. Build the first cut. Make it yours.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="relative py-16 sm:py-24">
      <Container>
        <Reveal className="mk-closing-cta relative px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
            <h2 id="cta-title" className="mk-h2">
              {title}
            </h2>
            <p className="mk-lead">{lead}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <CtaLink href={appRoutes.signUp} size="lg" arrow>
                Start creating
              </CtaLink>
              <CtaLink href="/explore" variant="secondary" size="lg">
                Explore examples
              </CtaLink>
            </div>
            <p className="text-[0.8125rem] text-(--muted)">
              {trialCredits} one-time trial credits · No card required
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
