"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StateSummaryItem } from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import { getStateName } from "../lib/states";
interface StateComparisonTableProps {
  states: StateSummaryItem[];
  fuelName: string;
}

export default function StateComparisonTable({
  states,
  fuelName,
}: StateComparisonTableProps) {
  const [sortOrder, setSortOrder] = useState<"cheapest" | "expensive">("cheapest");

  const sortedStates = useMemo(() => {
    const list = [...states];
    return list.sort((a, b) => {
      const priceA = Number.parseFloat(a.medianPrice);
      const priceB = Number.parseFloat(b.medianPrice);
      return sortOrder === "cheapest" ? priceA - priceB : priceB - priceA;
    });
  }, [states, sortOrder]);

  if (!states || states.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            State Price Rankings ({fuelName})
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Compare current median and range across {states.length} states with BJ&apos;s gas
          </p>
        </div>

        <div className="chart-controls" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`filter-btn ${sortOrder === "cheapest" ? "active" : ""}`}
            onClick={() => setSortOrder("cheapest")}
          >
            Cheapest First
          </button>
          <button
            type="button"
            className={`filter-btn ${sortOrder === "expensive" ? "active" : ""}`}
            onClick={() => setSortOrder("expensive")}
          >
            Highest First
          </button>
        </div>
      </div>

      <div className="table-container" style={{ border: "none", boxShadow: "none" }}>
        <table className="station-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: "60px" }}>Rank</th>
              <th scope="col">State</th>
              <th scope="col">Median Price</th>
              <th scope="col">Range (Min – Max)</th>
              <th scope="col" style={{ textAlign: "right" }}>Stations</th>
            </tr>
          </thead>
          <tbody>
            {sortedStates.map((s, index) => {
              const rank = index + 1;
              const isTop3Cheapest = sortOrder === "cheapest" && rank <= 3;
              const isTop3Expensive = sortOrder === "expensive" && rank <= 3;

              return (
                <tr key={s.state}>
                  <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                    #{rank}
                  </td>
                  <td>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link
                        href={`/states/${s.state.toLowerCase()}`}
                        style={{
                          fontWeight: 700,
                          color: "var(--primary)",
                          textDecoration: "none",
                        }}
                        className="hover:underline"
                      >
                        {getStateName(s.state)} ({s.state})
                      </Link>
                      <Link
                        href={`/map?state=${s.state}`}
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: "var(--text-muted)",
                          textDecoration: "none",
                        }}
                        className="hover:underline"
                        title={`View ${s.state} stations on map`}
                      >
                        Map ↗
                      </Link>
                    </div>
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: isTop3Cheapest
                        ? "var(--cheapest)"
                        : isTop3Expensive
                        ? "var(--expensive)"
                        : "var(--text-primary)",
                      fontSize: "1.05rem",
                    }}
                  >
                    {formatPrice(s.medianPrice)}
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    {formatPrice(s.minPrice)} – {formatPrice(s.maxPrice)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text-muted)" }}>
                    {s.stationCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <Link
          href="/states"
          style={{
            color: "var(--primary)",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
          className="hover:underline"
        >
          View all state guides & statistics →
        </Link>
      </div>
    </div>
  );
}
