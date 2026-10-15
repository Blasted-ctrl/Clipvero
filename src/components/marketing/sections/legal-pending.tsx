import Link from "next/link";
import { FileClock } from "lucide-react";
import { siteName } from "../data/site";
import { Container, Section } from "../ui/primitives";
import { PageHero } from "./page-hero";

/** Placeholder for legal documents that have not been approved yet. Never shows draft policy text. */
export function LegalPending({
  document,
}: {
  document: "Terms of Service" | "Privacy Policy";
}) {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={document}
        lead={`${siteName}'s ${document} will be published on this page once finalized.`}
      />
      <Section labelledBy="page-title" className="pt-2 sm:pt-4">
        <Container className="max-w-2xl">
          <div className="mk-card flex flex-col items-center gap-4 p-8 text-center">
            <FileClock
              size={28}
              aria-hidden="true"
              className="text-(--accent-hover)"
            />
            <p className="mk-body">
              This document is still being prepared and is not yet available. In
              the meantime, the{" "}
              <Link href="/faq" className="mk-inline-link">
                FAQ
              </Link>{" "}
              explains how uploads, workspaces and credits work today.
            </p>
            <Link href="/contact" className="mk-btn mk-btn-secondary mk-btn-sm">
              Contact us
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
