import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getHoneybadgerApiKey } from "../lib/config";
import HoneybadgerInit from "../components/HoneybadgerInit";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://ejiib93jmwi0jbi4ui8598xn.ewr.prisma.build"
  ),
  title: {
    default: "BJ's Gas Prices — Current Prices, Trends & Locations",
    template: "%s | BJ's Gas Prices",
  },
  description:
    "Real-time fuel prices, interactive map, historical trends, and state price directories across BJ's Wholesale Club gas stations.",
  openGraph: {
    title: "BJ's Gas Prices — Current Prices, Trends & Locations",
    description:
      "Real-time fuel prices, interactive map, historical trends, and state price directories across BJ's Wholesale Club gas stations.",
    url: "/",
    siteName: "BJ's Gas Price Tracker",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "BJ's Gas Prices — Current Prices, Trends & Locations",
    description:
      "Real-time fuel prices, interactive map, historical trends, and state price directories across BJ's Wholesale Club gas stations.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const honeybadgerApiKey = getHoneybadgerApiKey();

  return (
    <html lang="en">
      <body>
        <HoneybadgerInit apiKey={honeybadgerApiKey} />
        <div className="site-wrapper">
          <header className="site-header">
            <div className="header-container">
              <Link href="/" className="brand-link">
                <span className="brand-title">BJ&apos;s Gas Tracker</span>
              </Link>
              <nav className="header-nav" aria-label="Main Navigation">
                <Link href="/" className="nav-link">
                  Overview
                </Link>
                <Link href="/states" className="nav-link">
                  By State
                </Link>
                <Link href="/map" className="nav-link nav-link-highlight">
                  Interactive Map
                </Link>
                <Link href="/status" className="nav-link flex items-center gap-1.5" title="System & Data Pipeline Status">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Status
                </Link>
              </nav>
            </div>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <div className="mx-auto max-w-4xl space-y-3">
              <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
                <Link href="/" className="hover:text-slate-900 transition-colors">
                  Overview
                </Link>
                <Link href="/states" className="hover:text-slate-900 transition-colors">
                  Browse by State
                </Link>
                <Link href="/map" className="hover:text-slate-900 transition-colors">
                  Interactive Map
                </Link>
                <Link href="/status" className="hover:text-slate-900 transition-colors">
                  System Status &amp; Pipeline
                </Link>
              </div>
              <p className="text-xs text-slate-500">
                BJ&apos;s Gas Price Tracker &bull; Independent community observation tool &bull; Powered by Prisma Compute
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
