import type { Metadata } from "next";
import Breadcrumbs from "../../components/Breadcrumbs";
import { getSystemStatus } from "../../lib/api";
import { resolveStatusHero } from "../../lib/status-view";

export const metadata: Metadata = {
  title: {
    absolute: "About — BJ's Gas Prices",
  },
  description:
    "BJ's Gas Prices is an independently operated personal project by Andrew Ryder for browsing and comparing publicly available BJ's Wholesale Club gas prices and how recently they were checked.",
};

export const revalidate = 60;

const ANDREW_HOME = "https://www.andrewtryder.com";

export default async function AboutPage() {
  let status = null;
  let fetchError = null;

  try {
    status = await getSystemStatus();
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : "Failed to fetch status";
  }

  const freshness = status?.freshness;
  const hero = resolveStatusHero(status, fetchError, freshness?.latestObservedAt);
  const reported = freshness?.stationsObservedRecently ?? 0;
  const configured = status?.configuredGasClubs ?? 0;

  return (
    <div className="about-page-container">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />

      <div className="page-header">
        <h1 className="page-title">About</h1>
        <p className="page-subtitle">
          A small personal project for browsing BJ&apos;s gas prices.
        </p>
      </div>

      <div className="about-prose">
        <p>
          BJ&apos;s Gas Prices is a small personal project by{" "}
          <a href={ANDREW_HOME} target="_blank" rel="noopener noreferrer">
            Andrew Ryder
          </a>{" "}
          that makes publicly available BJ&apos;s Wholesale Club gas prices easier to
          browse, compare, and explore over time.
        </p>
        <p className="about-disclaimer">
          This site is independently operated and is not affiliated with, sponsored
          by, or endorsed by BJ&apos;s Wholesale Club. Fuel prices can change at any
          time, so the price shown at the station should be treated as authoritative.
        </p>
        <p>
          Prices are checked automatically approximately every two hours. The exact
          clock time can shift after a site update, so treat the freshness note
          below as the current picture rather than a fixed timetable.
        </p>
      </div>

      <section className={`status-hero-banner status-${hero.level}`} aria-labelledby="about-freshness-heading">
        <div className="status-hero-main">
          <div className="status-hero-indicator-group">
            <span className={`status-dot status-dot-${hero.level}`} aria-hidden="true" />
            <div>
              <h2 id="about-freshness-heading" className="status-hero-heading">
                Data freshness
              </h2>
              <p className="status-hero-desc">{hero.description}</p>
              {configured > 0 && !fetchError ? (
                <p className="status-hero-desc about-freshness-count">
                  {reported} of {configured} locations reported in the latest collection
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
