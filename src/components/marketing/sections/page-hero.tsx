import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "../ui/primitives";

export function PageHero({
  eyebrow,
  title,
  lead,
  crumbs,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  crumbs?: { name: string; href: string }[];
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="page-title"
      className="mk-page-hero relative overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40"
    >
      <Container className="relative flex flex-col items-start text-left">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mk-rise mb-6">
            <ol className="flex flex-wrap items-center justify-center gap-1 text-[0.875rem] text-(--muted)">
              {crumbs.map((crumb, i) => (
                <li key={crumb.href} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
                  {i === crumbs.length - 1 ? (
                    <span aria-current="page" className="text-(--secondary)">
                      {crumb.name}
                    </span>
                  ) : (
                    <Link href={crumb.href} className="mk-link">
                      {crumb.name}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <span className="mk-eyebrow mk-rise">{eyebrow}</span>
        <h1
          id="page-title"
          className="mk-h1 mk-rise mt-4 max-w-4xl"
          style={{ "--mk-delay": "0.08s" } as React.CSSProperties}
        >
          {title}
        </h1>
        {lead && (
          <p
            className="mk-lead mk-rise mt-6 max-w-2xl"
            style={{ "--mk-delay": "0.16s" } as React.CSSProperties}
          >
            {lead}
          </p>
        )}
        {children && (
          <div
            className="mk-rise mt-9 flex w-full flex-col items-center"
            style={{ "--mk-delay": "0.24s" } as React.CSSProperties}
          >
            {children}
          </div>
        )}
      </Container>
    </section>
  );
}
