import Link from "next/link";
import type { PriceMoverItem, PriceMoversResponse } from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import { normalizeFuelDisplayName } from "../lib/fuels";
import SectionHeader from "./ui/SectionHeader";
import DeltaBadge from "./ui/DeltaBadge";

interface PriceMoversProps {
  movers: PriceMoversResponse;
}

function MoverCompactList({
  items,
  type,
}: {
  items: PriceMoverItem[];
  type: "increase" | "decrease";
}) {
  const isDrop = type === "decrease";
  // Display approximately 3 items per column as specified by Ledger Slate design
  const displayItems = items.slice(0, 3);

  if (displayItems.length === 0) {
    return (
      <div className="mover-empty-notice">
        No significant price {isDrop ? "drops" : "increases"} recorded this week.
      </div>
    );
  }

  return (
    <ul className="mover-list" aria-label={isDrop ? "Largest price drops" : "Largest price increases"}>
      {displayItems.map((item) => {
        const num = Number.parseFloat(item.absoluteChange.replace(/[^0-9.-]/g, ""));
        const absCents = Number.isFinite(num) ? Math.round(Math.abs(num) * 100) : 0;
        const signedCents = isDrop ? -absCents : absCents;

        return (
          <li key={item.clubNumber} className="mover-row">
            <div className="mover-station-info">
              <Link
                href={`/stations/${item.clubNumber}`}
                className="mover-station-link"
              >
                <span>{item.city}, {item.state}</span>
                <span className="station-location-qualifier"> &middot; #{item.clubNumber}</span>
              </Link>
              <span className="mover-station-name">
                {item.name}
              </span>
            </div>

            <div className="mover-price-data tabular-nums">
              <span className="mover-current-price">
                {formatPrice(item.currentPrice)}
              </span>
              <DeltaBadge cents={signedCents} size="sm" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function PriceMovers({ movers }: PriceMoversProps) {
  if (!movers) return null;
  const fuelName = normalizeFuelDisplayName(movers.fuel.name);

  return (
    <section className="movers-section" aria-label="Weekly price movers">
      <SectionHeader
        title="Biggest changes this week"
        subtitle={`Stations with the largest recorded ${fuelName.toLowerCase()} price movements over the last 7 days`}
      />

      <div className="movers-grid">
        {/* Drops */}
        <div className="mover-column">
          <div className="mover-column-header">
            <h3 className="mover-column-title text-cheaper">
              <span aria-hidden="true">&darr;</span> Largest drops
            </h3>
          </div>
          <MoverCompactList items={movers.decreases} type="decrease" />
        </div>

        {/* Increases */}
        <div className="mover-column">
          <div className="mover-column-header">
            <h3 className="mover-column-title text-higher">
              <span aria-hidden="true">&uarr;</span> Largest increases
            </h3>
          </div>
          <MoverCompactList items={movers.increases} type="increase" />
        </div>
      </div>
    </section>
  );
}
