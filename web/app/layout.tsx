import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BJ's Gas Prices",
  description: "Real-time fuel prices and price history across BJ's Wholesale Club gas stations.",
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
                <span className="brand-title">BJ's Gas Tracker</span>
                <span className="brand-badge">Phase 1</span>
              </Link>
            </div>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <p>BJ's Gas Price Tracker &bull; Powered by Prisma Compute</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
