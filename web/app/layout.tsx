import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BJ's Gas Prices — Current Prices, Trends & Locations",
  description:
    "Real-time fuel prices, interactive map, historical trends, and state price directories across BJ's Wholesale Club gas stations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="site-wrapper">
          <header className="site-header">
            <div className="header-container">
              <Link href="/" className="brand-link">
                <span className="brand-title">BJ&apos;s Gas Tracker</span>
              </Link>
              <nav className="header-nav">
                <Link href="/" className="nav-link">
                  Overview
                </Link>
                <Link href="/states" className="nav-link">
                  By State
                </Link>
                <Link href="/map" className="nav-link nav-link-highlight">
                  Interactive Map
                </Link>
              </nav>
            </div>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <p>BJ&apos;s Gas Price Tracker &bull; Powered by Prisma Compute</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
