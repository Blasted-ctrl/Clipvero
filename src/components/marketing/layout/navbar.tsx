"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/button";
import { appRoutes } from "../lib/app-routes";
import { primaryNav } from "../data/site";
import { m } from "../motion/motion";
import { BrandMark, CtaLink } from "../ui/primitives";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const active =
    primaryNav.find((link) => isActive(pathname, link.href))?.href ?? null;
  const highlighted = hovered ?? active;

  return (
    <header className="mk-site-header fixed inset-x-0 top-0 z-40">
      <div
        data-scrolled={scrolled}
        className={cn(
          "mk-header-bar mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12",
        )}
      >
        <Link href="/" className="rounded-lg p-1" aria-label="Clipvero home">
          <BrandMark />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul
            className="flex items-center gap-1"
            onPointerLeave={() => setHovered(null)}
          >
            {primaryNav.map((link) => (
              <li key={link.href} className="relative">
                {highlighted === link.href && (
                  <m.span
                    layoutId="mk-nav-pill"
                    className="absolute inset-0 rounded-md bg-(--surface-2)"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                  />
                )}
                <Link
                  href={link.href}
                  aria-current={active === link.href ? "page" : undefined}
                  onPointerEnter={() => setHovered(link.href)}
                  onFocus={() => setHovered(link.href)}
                  onBlur={() => setHovered(null)}
                  className="mk-link relative z-10 inline-flex min-h-11 items-center rounded-md px-3.5 text-[0.875rem] font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={appRoutes.signIn}
            className="mk-btn mk-btn-ghost mk-btn-sm"
          >
            Sign in
          </Link>
          <CtaLink href={appRoutes.signUp} size="sm" arrow>
            Start creating
          </CtaLink>
        </div>

        <div className="md:hidden">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="mk-icon-btn"
                aria-label="Open menu"
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="mk-sheet-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              <Dialog.Content
                className="mk mk-sheet fixed inset-x-3 top-3 z-50 min-h-0 rounded-3xl border border-(--border) bg-(--surface) p-4 shadow-2xl"
                aria-describedby={undefined}
              >
                <div className="flex items-center justify-between">
                  <BrandMark />
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="mk-icon-btn"
                      aria-label="Close menu"
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <Dialog.Title className="sr-only">Menu</Dialog.Title>
                <nav
                  aria-label="Mobile"
                  className="mt-6"
                  onClick={(event) =>
                    (event.target as HTMLElement).closest("a") && setOpen(false)
                  }
                >
                  <ul className="flex flex-col">
                    {[...primaryNav, { href: "/faq", label: "FAQ" }].map(
                      (link, i) => (
                        <li
                          key={link.href}
                          className="mk-rise"
                          style={
                            {
                              "--mk-delay": `${i * 40}ms`,
                            } as React.CSSProperties
                          }
                        >
                          <Link
                            href={link.href}
                            aria-current={
                              isActive(pathname, link.href) ? "page" : undefined
                            }
                            className="mk-link flex min-h-14 items-center justify-between border-b border-(--border) text-xl font-medium tracking-tight"
                          >
                            {link.label}
                            <ArrowRight
                              size={18}
                              aria-hidden="true"
                              className="text-(--muted)"
                            />
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                </nav>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Link
                    href={appRoutes.signIn}
                    className="mk-btn mk-btn-secondary"
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </Link>
                  <CtaLink
                    href={appRoutes.signUp}
                    onClick={() => setOpen(false)}
                  >
                    Start creating
                  </CtaLink>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
