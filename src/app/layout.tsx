import { SerwistProvider } from "@serwist/next/react";
import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Zestman", template: "%s · Zestman" },
  description:
    "An API client and test suite that starts from your running backend — routes, request schemas and response shapes, without a collection to maintain.",
  metadataBase: new URL("https://zestman.xyz"),
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Dark ("graphite") is canonical; the theme switcher writes this attribute. */
    <html lang="en" data-theme="graphite" suppressHydrationWarning>
      <body className="h-dvh overflow-hidden bg-canvas text-ink antialiased">
        {/* Registers the worker that keeps the shell openable with no internet. */}
        <SerwistProvider swUrl="/sw.js">{children}</SerwistProvider>
      </body>
    </html>
  );
}
