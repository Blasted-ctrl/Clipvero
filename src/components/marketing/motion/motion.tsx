"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const loadFeatures = () => import("./features").then((mod) => mod.default);

export const ease = [0.22, 1, 0.36, 1] as const;

/** Loads layout-animation features after hydration and honors the OS reduced-motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.45, ease }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

let observer: IntersectionObserver | null = null;
function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.shown = "true";
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  return observer;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section" | "article";
};

/**
 * Blur-fade into view once. Hidden only when scripting is enabled, so content is
 * always visible without JavaScript; the transition itself is plain CSS.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Comp = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = sharedObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);
  return (
    <Comp
      ref={ref as never}
      className={className ? `mk-reveal ${className}` : "mk-reveal"}
      style={
        delay ? ({ "--mk-delay": `${delay}s` } as CSSProperties) : undefined
      }
    >
      {children}
    </Comp>
  );
}

export { m };
