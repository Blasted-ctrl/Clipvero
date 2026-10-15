import { plans } from "@/lib/model";
import { faqEntries } from "../data/faq";
import { siteDescription, siteName, siteUrl } from "../data/site";

type Json = Record<string, unknown>;

/** Serializes structured data safely (no `</script>` breakouts). */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function organizationLd(): Json {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url,
    logo: `${url}/marketing/brand-mark.svg`,
  };
}

export function softwareLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteName,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description: siteDescription,
    url: siteUrl(),
    offers: Object.values(plans).map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.price.toFixed(2),
      priceCurrency: "USD",
      category: "subscription",
    })),
  };
}

export function faqLd(items: { q: string; a: string }[] = faqEntries): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]): Json {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${url}${crumb.path}`,
    })),
  };
}
