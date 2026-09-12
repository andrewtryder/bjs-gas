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
    "Current fuel prices, price trends, and station directories across BJ's Wholesale Club gas stations. Updated hourly.",
  openGraph: {
    title: "BJ's Gas Prices — Current Prices, Trends & Locations",
    description:
      "Current fuel prices, price trends, and station directories across BJ's Wholesale Club gas stations. Updated hourly.",
    url: "/",
    siteName: "BJ's Gas Prices",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "BJ's Gas Prices — Current Prices, Trends & Locations",
    description:
      "Current fuel prices, price trends, and station directories across BJ's Wholesale Club gas stations. Updated hourly.",
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
              <Link href="/" className="brand-link" aria-label="BJ's Gas Prices Home">
                <span className="brand-title">BJ&apos;s gas prices</span>
              </Link>
              <nav className="header-nav" aria-label="Main Navigation">
                <Link href="/map" className="nav-link">
                  Map
                </Link>
                <Link href="/states" className="nav-link">
                  States
                </Link>
                <Link
                  href="/status"
                  className="nav-link nav-status-link"
                  title="Data collection & pipeline status"
                >
                  <span className="status-dot status-dot-healthy" aria-hidden="true" />
                  <span>Data status</span>
                </Link>
              </nav>
            </div>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <div className="footer-container">
              <nav className="footer-nav" aria-label="Footer Navigation">
                <Link href="/map" className="footer-link">
                  Map
                </Link>
                <Link href="/states" className="footer-link">
                  States
                </Link>
                <Link href="/status" className="footer-link">
                  Data status
                </Link>
              </nav>
              <div className="footer-copy">
                <p className="footer-title">BJ&apos;s Gas Prices</p>
                <p className="footer-disclaimer">
                  Independent price tracking project. Not affiliated with BJ&apos;s Wholesale Club.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
