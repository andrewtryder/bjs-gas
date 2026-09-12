import Link from "next/link";
import type { PriceMoverItem, PriceMoversResponse } from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import SectionHeader from "./ui/SectionHeader";

interface PriceMoversProps {
  movers: PriceMoversResponse;
}

function formatCentsChange(changeStr: string, isDrop: boolean): string {
  const num = Number.parseFloat(changeStr.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(num)) {
    const cents = Math.round(Math.abs(num) * 100);
    return isDrop ? `↓ ${cents}¢` : `↑ ${cents}¢`;
  }
  return isDrop ? `↓ ${changeStr}` : `↑ ${changeStr}`;
}

function MoverCompactList({
  items,
  type,
}: {
  items: PriceMoverItem[];
  type: "increase" | "decrease";
}) {
  const isDrop = type === "decrease";

  if (items.length === 0) {
    return (
      <div className="mover-empty-notice">
        No significant price {isDrop ? "drops" : "increases"} recorded this week.
      </div>
    );
  }

  return (
    <ul className="mover-list" aria-label={isDrop ? "Largest price drops" : "Largest price increases"}>
      {items.map((item) => {
        const centsBadge = formatCentsChange(item.absoluteChange, isDrop);

        return (
          <li key={item.clubNumber} className="mover-row">
            <div className="mover-station-info">
              <Link
                href={`/stations/${item.clubNumber}`}
                className="mover-station-link"
              >
                {item.city}, {item.state}
              </Link>
              <span className="mover-station-name">
                {item.name} &bull; #{item.clubNumber}
              </span>
            </div>

            <div className="mover-price-data tabular-nums">
              <span className="mover-current-price">
                {formatPrice(item.currentPrice)}
              </span>
              <span
                className={`mover-delta-badge ${
                  isDrop ? "badge-cheaper" : "badge-higher"
                }`}
                aria-label={`${isDrop ? "Decreased by" : "Increased by"} ${centsBadge}`}
              >
                {centsBadge}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function PriceMovers({ movers }: PriceMoversProps) {
  if (!movers) return null;

  return (
    <section className="movers-section">
      <SectionHeader
        title="Biggest changes this week"
        subtitle={`Stations with the largest recorded ${movers.fuel.name.toLowerCase()} price movements over the last 7 days`}
      />

      <div className="movers-grid">
        {/* Drops */}
        <div className="mover-column">
          <div className="mover-column-header">
            <span className="mover-column-title text-cheaper">
              <span aria-hidden="true">&darr;</span> Largest drops
            </span>
          </div>
          <MoverCompactList items={movers.decreases} type="decrease" />
        </div>

        {/* Increases */}
        <div className="mover-column">
          <div className="mover-column-header">
            <span className="mover-column-title text-higher">
              <span aria-hidden="true">&uarr;</span> Largest increases
            </span>
          </div>
          <MoverCompactList items={movers.increases} type="increase" />
        </div>
      </div>
    </section>
  );
}
