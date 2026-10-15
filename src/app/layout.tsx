import type { Metadata } from "next";
import { Providers } from "@/components/app-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Clipvero — your short-form video studio",
    template: "%s · Clipvero",
  },
  description:
    "Create, edit, and render original short-form videos. Your ideas, in motion.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
