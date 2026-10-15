import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Layers3,
  ListChecks,
  Workflow,
} from "lucide-react";
import { currentUser } from "@/server/backend";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { plans } from "@/lib/model";
export default async function Home() {
  if (await currentUser()) redirect("/overview");
  return (
    <div className="marketing">
      <header>
        <Link href="/">
          <Logo />
        </Link>
        <nav aria-label="Public navigation">
          <a href="#workflow">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login">Sign in</Link>
          <Button asChild size="sm">
            <Link href="/signup">
              Open your studio <ArrowRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="marketing-hero">
          <span className="eyebrow">LESS BUSYWORK. MORE CREATING.</span>
          <h1>
            Big ideas.
            <br />
            Short videos.
          </h1>
          <p>
            Turn your words and footage into something worth watching. Create,
            edit, and export original shorts in one focused workspace.
          </p>
          <Button asChild>
            <Link href="/signup">
              Start creating <ArrowRight size={17} />
            </Link>
          </Button>
          <small>120 starter credits · No credit card needed</small>
          <div className="hero-storyboard" aria-hidden="true">
            <div className="storyboard-frame">
              <span>01 / THE IDEA</span>
              <Layers3 size={42} />
              <strong>
                It starts
                <br />
                with a spark.
              </strong>
            </div>
            <div className="storyboard-frame middle">
              <span>02 / YOUR STORY</span>
              <Clapperboard size={42} />
              <strong>
                Give it
                <br />
                some motion.
              </strong>
            </div>
            <div className="storyboard-frame">
              <span>03 / THE WORLD</span>
              <ArrowRight size={42} />
              <strong>
                Make it
                <br />
                worth sharing.
              </strong>
            </div>
          </div>
        </section>
        <section id="workflow" className="marketing-section">
          <span className="eyebrow">A CLEAR PATH FROM IDEA TO EXPORT</span>
          <h2>Your creativity. A little less friction.</h2>
          <div className="feature-grid">
            {[
              {
                icon: Clapperboard,
                title: "Make it yours",
                text: "Start with a script or your own footage. Shape the story scene by scene.",
              },
              {
                icon: ListChecks,
                title: "Keep creative control",
                text: "Edit captions, choose visuals, and review the finished render before sharing.",
              },
              {
                icon: Workflow,
                title: "Build your rhythm",
                text: "Save your style and set a recurring creation schedule with AI providers configured.",
              },
            ].map((f) => (
              <article key={f.title}>
                <f.icon />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="pricing" className="marketing-section">
          <span className="eyebrow">ROOM TO GROW</span>
          <h2>Find your creative pace.</h2>
          <div className="pricing-grid">
            {Object.values(plans).map((p) => (
              <article key={p.name} className="panel">
                <h3>{p.name}</h3>
                <div className="price">
                  ${p.price}
                  <small>/ month</small>
                </div>
                <p>{p.credits} monthly credits</p>
                <p>
                  <Check size={15} />
                  {p.videos} standard video allowance
                </p>
                <p>
                  <Check size={15} />
                  Scene editor & MP4 exports
                </p>
                <Button asChild variant="secondary">
                  <Link href="/signup">
                    Get started <ArrowRight size={15} />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
          <p className="muted">
            A standard video is up to 60 seconds with script, narration, and up
            to six AI images, costing 10 credits or less. Premium operations and
            longer videos use additional credits. Paid checkout becomes
            available when billing is configured.
          </p>
        </section>
      </main>
      <footer>
        <Logo />
        <span>Original ideas deserve a place to start.</span>
        <Link href="/login">
          Go to your studio <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
