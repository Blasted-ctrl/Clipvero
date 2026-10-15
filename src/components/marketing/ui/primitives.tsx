import Link from "next/link";
import { ArrowRight, AudioLines } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/components/ui/button";
import { capabilities, type CapabilityId } from "../data/capabilities";
import { siteName } from "../data/site";
import { Reveal } from "../motion/motion";

/** Brand lockup matching the studio Logo, without pulling the client shell into marketing bundles. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[1.375rem] font-semibold leading-none tracking-[-0.04em]",
        className,
      )}
    >
      <span className="mk-brand-symbol">
        <AudioLines size={19} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span>{siteName}</span>
    </span>
  );
}

type CtaProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  arrow?: boolean;
  className?: string;
};

/** Link styled as a button. Use for navigation; use <button> for in-page actions. */
export function CtaLink({
  variant = "primary",
  size = "md",
  arrow = false,
  className,
  children,
  ...props
}: CtaProps) {
  return (
    <Link
      className={cn(
        "mk-btn",
        `mk-btn-${variant}`,
        size === "lg" && "mk-btn-lg",
        size === "sm" && "mk-btn-sm",
        className,
      )}
      {...props}
    >
      {children}
      {arrow && (
        <ArrowRight
          className="mk-btn-arrow"
          size={size === "sm" ? 15 : 17}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mk-container mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("mk-section relative py-16 sm:py-24", className)}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  lead,
  align = "left",
  as: Heading = "h2",
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2";
  children?: ReactNode;
}) {
  return (
    <Reveal
      className={cn(
        "mk-section-header flex flex-col gap-4",
        align === "center"
          ? "mx-auto max-w-3xl items-center text-center"
          : "max-w-2xl",
      )}
    >
      <span className="mk-eyebrow">{eyebrow}</span>
      <Heading id={id} className={Heading === "h1" ? "mk-h1" : "mk-h2"}>
        {title}
      </Heading>
      {lead && <p className="mk-lead max-w-2xl">{lead}</p>}
      {children}
    </Reveal>
  );
}

export function CapabilityBadge({
  id,
  showAvailable = false,
}: {
  id: CapabilityId;
  showAvailable?: boolean;
}) {
  const status = capabilities[id].status;
  if (status === "upcoming")
    return <span className="mk-badge mk-badge-upcoming">Upcoming</span>;
  return showAvailable ? (
    <span className="mk-badge mk-badge-success">Available</span>
  ) : null;
}

export function PreviewLabel() {
  return <span className="mk-preview-label">Interactive preview</span>;
}
