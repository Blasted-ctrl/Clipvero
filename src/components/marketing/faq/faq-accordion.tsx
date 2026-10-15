"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/components/ui/button";

export type FaqItem = { id: string; q: string; a: string };

/** Accessible disclosure list. Panels stay in the DOM so answers are indexable and findable with Ctrl+F. */
export function FaqAccordion({
  items,
  defaultOpen,
  headingLevel = "h3",
}: {
  items: FaqItem[];
  defaultOpen?: string;
  headingLevel?: "h2" | "h3";
}) {
  const uid = useId();
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(defaultOpen ? [defaultOpen] : []),
  );
  const Heading = headingLevel;

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const expanded = open.has(item.id);
        const buttonId = `${uid}-${item.id}-q`;
        const panelId = `${uid}-${item.id}-a`;
        return (
          <li
            key={item.id}
            id={item.id}
            className={cn(
              "mk-card scroll-mt-28 transition-colors duration-300",
              expanded
                ? "border-(--accent)/40 bg-(--surface-2)/60"
                : "hover:border-[#3a3a44]",
            )}
          >
            <Heading className="mk-h4">
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
              >
                <span>{item.q}</span>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                    expanded
                      ? "border-(--accent)/50 bg-(--accent)/15 text-(--accent-hover)"
                      : "border-(--border) text-(--secondary)",
                  )}
                  aria-hidden="true"
                >
                  <ChevronDown size={16} className="mk-chevron" />
                </span>
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="mk-collapse"
              data-open={expanded}
              inert={!expanded}
            >
              <div>
                <p className="mk-body px-5 pb-5 text-[0.9375rem] leading-relaxed sm:px-6">
                  {item.a}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
