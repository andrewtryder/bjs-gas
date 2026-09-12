import Link from "next/link";
import type { PriceMoverItem, PriceMoversResponse } from "../lib/analytics";
import { formatPrice } from "../lib/stats";

interface PriceMoversProps {
  movers: PriceMoversResponse;
}

function MoverList({
  items,
  type,
}: {
  items: PriceMoverItem[];
  type: "increase" | "decrease";
}) {
  const isDrop = type === "decrease";

  if (items.length === 0) {
    return (
      <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
        No significant price {isDrop ? "decreases" : "increases"} recorded in this period.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {items.map((item) => (
        <div
          key={item.clubNumber}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            backgroundColor: "var(--bg-main)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link
              href={`/stations/${item.clubNumber}`}
              style={{
                fontWeight: 600,
                fontSize: "0.9375rem",
                color: "var(--accent)",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.name}
            </Link>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
              {item.city}, {item.state} &bull; Club #{item.clubNumber}
            </div>
          </div>

          <div style={{ textAlign: "right", marginLeft: "1rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "0.375rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "line-through" }}>
                {formatPrice(item.startingPrice)}
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatPrice(item.currentPrice)}
              </span>
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: "0.25rem",
                padding: "0.125rem 0.375rem",
                borderRadius: "4px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                backgroundColor: isDrop ? "var(--cheapest-bg)" : "var(--expensive-bg)",
                color: isDrop ? "var(--cheapest)" : "var(--expensive)",
              }}
            >
              {item.absoluteChange} ({item.percentageChange})
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PriceMovers({ movers }: PriceMoversProps) {
  if (!movers) return null;

  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Recent Price Changes ({movers.days}-Day Window)
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          Stations with the largest recorded {movers.fuel.name} price movements
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {/* Drops */}
        <div>
          <h4
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--cheapest)",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <span>&darr;</span> Largest Price Drops
          </h4>
          <MoverList items={movers.decreases} type="decrease" />
        </div>

        {/* Increases */}
        <div>
          <h4
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--expensive)",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <span>&uarr;</span> Largest Price Increases
          </h4>
          <MoverList items={movers.increases} type="increase" />
        </div>
      </div>
    </div>
  );
}
