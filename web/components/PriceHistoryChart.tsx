"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FuelPriceHistoryItem } from "../lib/types";
import { formatPrice } from "../lib/stats";

const FUEL_COLORS: Record<string, string> = {
  unleaded: "#2563eb", // blue
  regular: "#2563eb",
  premium: "#9333ea", // purple
  diesel: "#16a34a", // green
};

function getFuelColor(fuelName: string, index: number): string {
  const lower = fuelName.toLowerCase();
  for (const [key, color] of Object.entries(FUEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  const fallbackColors = ["#0284c7", "#d97706", "#dc2626", "#4f46e5"];
  return fallbackColors[index % fallbackColors.length]!;
}

export default function PriceHistoryChart({
  history,
}: {
  history: FuelPriceHistoryItem[];
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState<string>("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get distinct fuel names
  const fuelNames = useMemo(() => {
    const set = new Set<string>();
    for (const item of history) {
      if (item.fuelName) set.add(item.fuelName);
    }
    return Array.from(set).sort();
  }, [history]);

  // Transform history into chronological time series points
  const chartData = useMemo(() => {
    // Group by timestamp or sorted timeline
    const sorted = [...history].sort(
      (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
    );

    // Group observations by date/time (e.g. "MMM D, h:mm a")
    const map = new Map<string, Record<string, any>>();
    for (const item of sorted) {
      const d = new Date(item.observedAt);
      const timeKey = d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const numericPrice = Number.parseFloat(item.price);
      if (!Number.isFinite(numericPrice)) continue;

      if (!map.has(timeKey)) {
        map.set(timeKey, {
          time: timeKey,
          timestamp: d.getTime(),
        });
      }
      const point = map.get(timeKey)!;
      point[item.fuelName] = numericPrice;
    }

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <p>No price changes have been recorded for this station yet.</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div
        className="chart-wrapper"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "0.875rem",
        }}
      >
        Loading price history chart...
      </div>
    );
  }

  const activeFuels =
    selectedFuel === "ALL" ? fuelNames : fuelNames.filter((f) => f === selectedFuel);

  return (
    <div>
      {fuelNames.length > 1 && (
        <div className="chart-controls">
          <button
            type="button"
            className={`filter-btn ${selectedFuel === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedFuel("ALL")}
          >
            All Fuels
          </button>
          {fuelNames.map((name) => (
            <button
              type="button"
              key={name}
              className={`filter-btn ${selectedFuel === name ? "active" : ""}`}
              onClick={() => setSelectedFuel(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              dy={5}
            />
            <YAxis
              domain={["auto", "auto"]}
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              dx={-5}
            />
            <Tooltip
              formatter={(value: any, name: any) => [formatPrice(value), name]}
              labelFormatter={(label) => `Observed: ${label}`}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "0.875rem",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.875rem" }} />
            {activeFuels.map((name, idx) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={getFuelColor(name, idx)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
