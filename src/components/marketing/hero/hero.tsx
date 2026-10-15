import Link from "next/link";
import {
  ArrowRight,
  Check,
  Film,
  Layers3,
  SlidersHorizontal,
} from "lucide-react";
import { Container } from "../ui/primitives";
import { HeroComposer } from "./hero-composer";
import { VideoMarquee } from "./video-marquee";
import { showcaseEntries } from "../data/showcase";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="mk-hero">
      <Container>
        <div className="mk-hero-layout">
          <div className="mk-hero-copy">
            <p className="mk-eyebrow">A workspace for video production</p>
            <h1 id="hero-title" className="mk-display">
              Good ideas.
              <br />
              <span>Ready for the cut.</span>
            </h1>
            <p className="mk-lead mk-hero-description">
              Turn scripts and recordings into short-form video. Edit every
              scene, save your style, and keep production moving.
            </p>
            <HeroComposer className="mk-hero-composer" />
          </div>

          <div
            className="mk-production-preview"
            aria-label="Illustrative scene editing workflow"
          >
            <div className="mk-preview-topline">
              <span>
                <Film size={16} aria-hidden="true" /> Brand film
              </span>
              <span className="mk-mono">9:16</span>
            </div>
            <div className="mk-preview-body">
              <div className="mk-preview-scenes" aria-hidden="true">
                <span className="mk-overline">Scenes</span>
                {["Opening", "The details", "Closing"].map((name, index) => (
                  <div
                    className={
                      index === 0
                        ? "mk-preview-scene is-selected"
                        : "mk-preview-scene"
                    }
                    key={name}
                  >
                    <span className={`mk-scene-swatch mk-swatch-${index}`} />
                    <span>
                      <small className="mk-mono">0{index + 1}</small>
                      <strong>{name}</strong>
                    </span>
                  </div>
                ))}
                <div className="mk-preview-tool">
                  <Layers3 size={14} /> Scenes
                </div>
                <div className="mk-preview-tool">
                  <SlidersHorizontal size={14} /> Style
                </div>
              </div>
              <div className="mk-preview-stage">
                <div className="mk-campaign-cover" aria-hidden="true">
                  <div className="mk-campaign-masthead">
                    <span>FIELDWORK</span>
                    <span>EST. 2026</span>
                  </div>
                  <div className="mk-campaign-title">
                    Made for
                    <br />
                    <em>the everyday.</em>
                  </div>
                  <svg
                    className="mk-campaign-object"
                    viewBox="0 0 240 290"
                    fill="none"
                  >
                    <defs>
                      <linearGradient
                        id="cup-body"
                        x1="51"
                        y1="80"
                        x2="186"
                        y2="160"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#D28650" />
                        <stop offset=".48" stopColor="#B65C34" />
                        <stop offset="1" stopColor="#763821" />
                      </linearGradient>
                      <linearGradient
                        id="cup-lid"
                        x1="39"
                        y1="44"
                        x2="204"
                        y2="94"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#373B35" />
                        <stop offset="1" stopColor="#151F19" />
                      </linearGradient>
                    </defs>
                    <ellipse
                      cx="121"
                      cy="257"
                      rx="78"
                      ry="11"
                      fill="#A59178"
                      opacity=".2"
                    />
                    <path
                      d="M59 80H182L170 237C169 251 76 251 74 237L59 80Z"
                      fill="url(#cup-body)"
                    />
                    <ellipse cx="120" cy="81" rx="66" ry="17" fill="#D88B59" />
                    <path
                      d="M51 57C51 39 190 39 190 57V80C190 99 51 99 51 80V57Z"
                      fill="url(#cup-lid)"
                    />
                    <ellipse cx="120" cy="56" rx="69" ry="16" fill="#41483F" />
                    <ellipse cx="120" cy="53" rx="49" ry="9" fill="#242E26" />
                    <rect
                      x="103"
                      y="43"
                      width="35"
                      height="7"
                      rx="3.5"
                      fill="#101A14"
                    />
                    <path
                      d="M85 108L92 229"
                      stroke="#E4A171"
                      strokeWidth="3"
                      opacity=".3"
                    />
                    <text
                      x="122"
                      y="166"
                      textAnchor="middle"
                      fill="#F6EBDC"
                      fontSize="12"
                      fontFamily="Arial,sans-serif"
                      fontWeight="700"
                      letterSpacing="2"
                    >
                      FIELDWORK
                    </text>
                    <path d="M109 182H135" stroke="#F6EBDC" opacity=".6" />
                  </svg>
                  <div className="mk-campaign-bottom">
                    <span>A little less disposable.</span>
                    <span>01 / 03</span>
                  </div>
                </div>
                <div className="mk-preview-caption">
                  <Check size={13} aria-hidden="true" /> Your words. Your final
                  say.
                </div>
              </div>
            </div>
            <div className="mk-preview-timeline" aria-hidden="true">
              <span className="mk-mono">00:00</span>
              <div>
                <i />
                <i />
                <i />
                <span className="mk-playhead" />
              </div>
              <span className="mk-mono">00:30</span>
            </div>
            <div className="mk-preview-footnote">
              <span>Illustrative project</span>
              <Link href="/features">
                Try the editor <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
        <div className="mk-hero-capabilities">
          <span>One production workflow</span>
          <span>Script to scenes</span>
          <i aria-hidden="true" />
          <span>Precise timeline editing</span>
          <i aria-hidden="true" />
          <span>Review before export</span>
        </div>
      </Container>
      <div className="mk-format-strip">
        <VideoMarquee entries={showcaseEntries} />
      </div>
    </section>
  );
}
