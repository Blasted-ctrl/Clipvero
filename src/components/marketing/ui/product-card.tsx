import type { ReactNode } from "react";
import { cn } from "@/components/ui/button";

export function ProductCard({
  children,
  className,
  as: Comp = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  return <Comp className={cn("mk-card", className)}>{children}</Comp>;
}
