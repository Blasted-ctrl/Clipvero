import type { Metadata } from "next";
import { pageMetadata } from "@/components/marketing/seo/metadata";
import Link from "next/link";
import { ArrowUpRight, LifeBuoy, MessagesSquare } from "lucide-react";
import { appRoutes } from "@/components/marketing/lib/app-routes";
import { Reveal } from "@/components/marketing/motion/motion";
import { PageHero } from "@/components/marketing/sections/page-hero";
import { JsonLd, breadcrumbLd } from "@/components/marketing/seo/json-ld";
import { Container, Section } from "@/components/marketing/ui/primitives";
import { ProductCard } from "@/components/marketing/ui/product-card";

export const metadata: Metadata = pageMetadata({
  title: "Contact and support",
  description:
    "Get help with Clipvero: read the FAQ or open Help inside your studio.",
  path: "/contact",
});

type Channel = {
  icon: typeof LifeBuoy;
  title: string;
  body: string;
  href: string;
  cta: string;
  external?: boolean;
};

function ChannelLink({
  channel,
  children,
}: {
  channel: Channel;
  children: React.ReactNode;
}) {
  const className = "group flex h-full flex-col gap-4 rounded-[inherit] p-6";
  return channel.external ? (
    <a href={channel.href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={channel.href} className={className}>
      {children}
    </Link>
  );
}

export default function ContactPage() {
  const channels: Channel[] = [
    {
      icon: MessagesSquare,
      title: "Read the FAQ",
      body: "Answers about formats, credits, Autopilot, publishing and privacy.",
      href: "/faq",
      cta: "Browse questions",
    },
    {
      icon: LifeBuoy,
      title: "Help in your studio",
      body: "Step-by-step guidance for your first video, rendering, AI setup and content rights.",
      href: appRoutes.help,
      cta: "Open Help",
    },
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <PageHero
        eyebrow="Contact"
        title="We're here to help."
        lead="Pick the fastest route to an answer."
      />
      <Section labelledBy="page-title" className="pt-2 sm:pt-4">
        <Container>
          <ul
            className={`mx-auto grid max-w-4xl gap-4 ${channels.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
          >
            {channels.map((channel, i) => (
              <Reveal as="li" key={channel.title} delay={i * 0.06}>
                <ProductCard className="mk-lift h-full">
                  <ChannelLink channel={channel}>
                    <span className="flex size-11 items-center justify-center rounded-xl bg-(--accent)/12 text-(--accent-hover) transition-transform duration-300 group-hover:scale-110">
                      <channel.icon size={20} aria-hidden="true" />
                    </span>
                    <span className="mk-h3">{channel.title}</span>
                    <span className="mk-body text-[0.9375rem]">
                      {channel.body}
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-2 font-medium text-(--accent-hover)">
                      {channel.cta}
                      <ArrowUpRight
                        size={16}
                        aria-hidden="true"
                        className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </span>
                  </ChannelLink>
                </ProductCard>
              </Reveal>
            ))}
          </ul>
          <p className="mx-auto mt-10 max-w-2xl text-center text-[0.875rem] text-(--muted)">
            Help inside the studio requires signing in. We don&apos;t offer a
            contact form, so nothing you type on this site is sent anywhere.
          </p>
        </Container>
      </Section>
    </>
  );
}
