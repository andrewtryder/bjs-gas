import Link from "next/link";
import type { StateSummaryItem } from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import { getStateName, toStateSlug } from "../lib/states";
import { normalizeFuelDisplayName } from "../lib/fuels";
import { getTopHighestStates, getTopLowestStates } from "../lib/analytics-view";
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

  const normalizedFuel = normalizeFuelDisplayName(fuelName);
  const lowestStates = getTopLowestStates(states, 5);
  const highestStates = getTopHighestStates(states, 5);

  return (
    <section className="state-preview-section" aria-label="Prices by state summary">
      <SectionHeader
        title="Prices by state"
        subtitle={`Current ${normalizedFuel.toLowerCase()} fuel medians across ${states.length} states`}
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
            <h3 className="state-column-title text-cheaper">
              Lowest-priced states
            </h3>
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
            <h3 className="state-column-title text-higher">
              Highest-priced states
            </h3>
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
