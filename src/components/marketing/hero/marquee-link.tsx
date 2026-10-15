"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { setShowcaseTarget } from "../showcase/showcase-target";

/** Opens Explore scrolled to one example, without a URL fragment. */
export function MarqueeLink({
  id,
  hidden,
  label,
  className,
  children,
}: {
  id: string;
  hidden: boolean;
  label?: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      href="/explore"
      tabIndex={hidden ? -1 : undefined}
      aria-label={label}
      className={className}
      onClick={() => setShowcaseTarget(id)}
    >
      {children}
    </Link>
  );
}
