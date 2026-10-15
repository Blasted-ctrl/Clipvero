import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Footer } from "@/components/marketing/layout/footer";
import { Navbar } from "@/components/marketing/layout/navbar";
import { SkipLink } from "@/components/marketing/layout/skip-link";
import { MotionProvider } from "@/components/marketing/motion/motion";
import {
  siteDescription,
  siteName,
  siteTagline,
  siteUrl,
} from "@/components/marketing/data/site";
import { ogImage } from "@/components/marketing/seo/metadata";
import "@/components/marketing/marketing.css";

const geist = localFont({
  src: "../../components/marketing/fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
  fallback: ["Inter", "Segoe UI", "system-ui", "Arial", "sans-serif"],
});

const geistMono = localFont({
  src: "../../components/marketing/fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["Consolas", "ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName} — ${siteTagline}`,
    description: siteDescription,
    locale: "en_US",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — ${siteTagline}`,
    description: siteDescription,
    images: [ogImage.url],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mk ${geist.variable} ${geistMono.variable} relative flex min-h-dvh flex-col overflow-x-clip`}
    >
      <SkipLink />
      <MotionProvider>
        <Navbar />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <Footer />
      </MotionProvider>
    </div>
  );
}
