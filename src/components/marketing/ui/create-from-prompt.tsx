"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Wand2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/ui/button";
import {
  buildCreateHref,
  createDraft,
  saveCreationDraft,
  type DraftMode,
} from "../lib/creation-draft";

/** Starts the creation workflow pre-filled with a prompt and format. */
export function CreateFromPrompt({
  mode,
  prompt,
  label = "Create a similar video",
  variant = "secondary",
  size = "sm",
  className,
  icon = "wand",
}: {
  mode: DraftMode;
  prompt: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: "wand" | "arrow";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        const draft = createDraft("idea", prompt, mode);
        saveCreationDraft(draft);
        router.push(buildCreateHref(draft));
      }}
      className={cn(
        "mk-btn",
        `mk-btn-${variant}`,
        size === "sm" && "mk-btn-sm",
        size === "lg" && "mk-btn-lg",
        className,
      )}
    >
      {icon === "wand" && <Wand2 size={15} aria-hidden="true" />}
      {pending ? "Opening studio…" : label}
      {icon === "arrow" && (
        <ArrowRight className="mk-btn-arrow" size={16} aria-hidden="true" />
      )}
    </button>
  );
}
