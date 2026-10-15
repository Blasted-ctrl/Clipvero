import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { isAvailable } from "../data/capabilities";
import { featureHref } from "../data/features";
import type { VideoFormat } from "../data/formats";
import { Reveal } from "../motion/motion";
import { CreateFromPrompt } from "../ui/create-from-prompt";
import { CapabilityBadge } from "../ui/primitives";
import { ProductCard } from "../ui/product-card";
import { FormatPreview } from "./format-preview";

export function FormatGrid({
  formats,
  headingLevel = "h3",
}: {
  formats: VideoFormat[];
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {formats.map((format, i) => {
        const available = isAvailable(format.capability);
        return (
          <Reveal as="li" key={format.id} delay={(i % 4) * 0.06}>
            <ProductCard
              as="article"
              className="mk-lift flex h-full flex-col gap-4 p-3 pb-4"
            >
              <FormatPreview kind={format.preview} />
              <div className="flex flex-1 flex-col gap-2 px-1">
                <div className="flex items-start justify-between gap-2">
                  <Heading className="mk-h4">{format.title}</Heading>
                  <CapabilityBadge id={format.capability} />
                </div>
                <p className="mk-body text-[0.9375rem]">{format.description}</p>
                <p className="mt-auto pt-2 text-[0.8125rem] text-(--muted)">
                  <span className="font-medium text-(--secondary)">
                    Best for:
                  </span>{" "}
                  {format.useCase}
                </p>
              </div>
              <div className="flex items-center gap-2 px-1">
                {available ? (
                  <CreateFromPrompt
                    mode={format.mode}
                    prompt={format.prompt}
                    label="Create"
                    className="flex-1"
                  />
                ) : null}
                <Link
                  href={featureHref(format.feature)}
                  className={
                    available
                      ? "mk-btn mk-btn-ghost mk-btn-sm"
                      : "mk-btn mk-btn-secondary mk-btn-sm flex-1"
                  }
                  aria-label={`Learn more about ${format.title}`}
                >
                  Learn more
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </ProductCard>
          </Reveal>
        );
      })}
    </ul>
  );
}
