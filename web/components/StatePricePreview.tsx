import Link from "next/link";
import type { StateSummaryItem } from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import { getStateName, toStateSlug } from "../lib/states";
import SectionHeader from "./ui/SectionHeader";

interface StatePricePreviewProps {
  states: StateSummaryItem[];
  fuelName?: string;
}

export default function StatePricePreview({
  states,
  fuelName = "Regular",
}: StatePricePreviewProps) {
  if (!states || states.length === 0) {
    return null;
  }

  // Sort states by median price ascending
  const sortedByPrice = [...states].sort(
    (a, b) => Number.parseFloat(a.medianPrice) - Number.parseFloat(b.medianPrice)
  );

  const lowestStates = sortedByPrice.slice(0, 5);
  // Highest states in descending order, excluding any that appear in lowest if count permits
  const highestCandidates = [...sortedByPrice].reverse();
  const lowestStateCodes = new Set(lowestStates.map((s) => s.state));
  const highestStates = highestCandidates
    .filter((s) => states.length <= 5 || !lowestStateCodes.has(s.state))
    .slice(0, 5);

  return (
    <section className="state-preview-section">
      <SectionHeader
        title="Prices by state"
        subtitle={`Current ${fuelName.toLowerCase()} fuel medians across ${states.length} states`}
        action={
          <Link href="/states" className="text-link-subtle">
            View all states <span aria-hidden="true">&rarr;</span>
          </Link>
        }
      />

      <div className="state-preview-grid">
        {/* Lowest 5 */}
        <div className="state-preview-column">
          <div className="state-column-header">
            <span className="state-column-title" style={{ color: "var(--cheaper)" }}>
              Lowest
            </span>
            <span className="state-column-metric-label">Median</span>
          </div>
          <ul className="state-preview-list" aria-label="States with lowest gas prices">
            {lowestStates.map((item) => {
              const stateName = getStateName(item.state);
              const slug = toStateSlug(item.state);
              return (
                <li key={item.state} className="state-preview-item">
                  <Link href={`/states/${slug}`} className="state-item-link">
                    <span className="state-item-name">
                      {stateName}{" "}
                      <span className="state-item-abbr">({item.state})</span>
                    </span>
                    <span className="state-item-price tabular-nums">
                      {formatPrice(item.medianPrice)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Highest 5 */}
        <div className="state-preview-column">
          <div className="state-column-header">
            <span className="state-column-title" style={{ color: "var(--higher)" }}>
              Highest
            </span>
            <span className="state-column-metric-label">Median</span>
          </div>
          <ul className="state-preview-list" aria-label="States with highest gas prices">
            {highestStates.map((item) => {
              const stateName = getStateName(item.state);
              const slug = toStateSlug(item.state);
              return (
                <li key={item.state} className="state-preview-item">
                  <Link href={`/states/${slug}`} className="state-item-link">
                    <span className="state-item-name">
                      {stateName}{" "}
                      <span className="state-item-abbr">({item.state})</span>
                    </span>
                    <span className="state-item-price tabular-nums">
                      {formatPrice(item.medianPrice)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="state-preview-footer">
        <Link href="/states" className="btn btn-secondary btn-sm">
          View all {states.length} states &rarr;
        </Link>
      </div>
    </section>
  );
}
