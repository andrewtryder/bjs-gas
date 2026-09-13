"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FuelPriceHistoryItem } from "../lib/types";
import { formatPrice } from "../lib/stats";
import SegmentedControl from "./ui/SegmentedControl";

interface PriceHistoryChartProps {
  history: FuelPriceHistoryItem[];
  defaultFuelName?: string;
}

export default function PriceHistoryChart({
  history,
  defaultFuelName,
}: PriceHistoryChartProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [selectedFuel, setSelectedFuel] = useState<string>("Unleaded");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract distinct fuels
  const availableFuels = useMemo(() => {
    const map = new Map<string, string>(); // sku -> name
    for (const item of history) {
      if (item.fuelName) {
        map.set(item.fuelName, item.fuelSku);
      }
    }
    const names = Array.from(map.keys()).sort((a, b) => {
      // Prioritize unleaded / regular first
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      if (aLower.includes("unleaded") || aLower.includes("regular")) return -1;
      if (bLower.includes("unleaded") || bLower.includes("regular")) return 1;
      return a.localeCompare(b);
    });
    return names;
  }, [history]);

  // Set initial selected fuel when available
  useEffect(() => {
    if (availableFuels.length > 0) {
      if (defaultFuelName && availableFuels.includes(defaultFuelName)) {
        setSelectedFuel(defaultFuelName);
      } else if (!availableFuels.includes(selectedFuel)) {
        setSelectedFuel(availableFuels[0]!);
      }
    }
  }, [availableFuels, defaultFuelName, selectedFuel]);

  // Filter and transform chronological data for the selected fuel
  const filteredHistory = useMemo(() => {
    return history
      .filter((item) => item.fuelName === selectedFuel)
      .sort(
        (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
      );
  }, [history, selectedFuel]);

  // Filter based on selected time window (days)
  const chartData = useMemo(() => {
    if (filteredHistory.length === 0) return [];

    const now = Date.now();
    const cutoffTime = now - selectedDays * 24 * 60 * 60 * 1000;

    // Keep items within the cutoff, but always keep at least the last few points if available
    let items = filteredHistory.filter(
      (item) => new Date(item.observedAt).getTime() >= cutoffTime,
    );
    if (items.length < 2 && filteredHistory.length >= 2) {
      items = filteredHistory.slice(-selectedDays);
    }

    // Deduplicate by formatted time label
    const map = new Map<string, { dateLabel: string; fullDate: string; price: number; timestamp: number }>();
    for (const item of items) {
      const d = new Date(item.observedAt);
      const num = Number.parseFloat(item.price);
      if (!Number.isFinite(num)) continue;

      const dateLabel = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      map.set(dateLabel, {
        dateLabel,
        fullDate: d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        price: num,
        timestamp: d.getTime(),
      });
    }

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredHistory, selectedDays]);

  // Concise summary above chart: e.g. "$3.979 now • ↓ 12¢ in 30 days"
  const summary = useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1]!;
    if (chartData.length === 1) {
      return {
        currentPrice: latest.price,
        changeText: "Latest recorded price",
        isFavorable: false,
        isUnfavorable: false,
      };
    }

    const earliest = chartData[0]!;
    const diff = latest.price - earliest.price;
    const cents = Math.round(diff * 100);

    let changeText = `No change over ${selectedDays} days`;
    let isFavorable = false;
    let isUnfavorable = false;

    if (cents > 0) {
      changeText = `↑ ${cents}¢ in ${selectedDays} days`;
      isUnfavorable = true;
    } else if (cents < 0) {
      changeText = `↓ ${Math.abs(cents)}¢ in ${selectedDays} days`;
      isFavorable = true;
    }

    return {
      currentPrice: latest.price,
      changeText,
      isFavorable,
      isUnfavorable,
    };
  }, [chartData, selectedDays]);

  if (history.length === 0 || chartData.length < 2) {
    return (
      <div className="card empty-state" style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
          Not enough history yet
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>
          Price history will appear as more observations are collected.
        </p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="card trend-loading-placeholder" style={{ minHeight: "280px" }}>
        Loading price history chart...
      </div>
    );
  }

  return (
    <div className="station-history-card">
      <div className="station-history-header">
        <div>
          {summary && (
            <div className="trend-stat-summary">
              <span className="trend-stat-price tabular-nums">
                {formatPrice(summary.currentPrice)}
              </span>
              <span
                className={`trend-stat-change ${
                  summary.isFavorable
                    ? "text-cheaper"
                    : summary.isUnfavorable
                    ? "text-higher"
                    : "text-muted"
                }`}
              >
                {summary.changeText}
              </span>
            </div>
          )}
        </div>

        <div className="station-history-controls">
          {availableFuels.length > 1 && (
            <div className="chart-fuel-segmented" role="group" aria-label="Select fuel type for history">
              {availableFuels.map((name) => (
                <button
                  type="button"
                  key={name}
                  className={`fuel-pill-btn ${selectedFuel === name ? "active" : ""}`}
                  onClick={() => setSelectedFuel(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <SegmentedControl
            options={[
              { value: 7, label: "7D", ariaLabel: "7 day price history" },
              { value: 14, label: "14D", ariaLabel: "14 day price history" },
              { value: 30, label: "30D", ariaLabel: "30 day price history" },
            ]}
            value={selectedDays}
            onChange={(val) => setSelectedDays(val)}
            ariaLabel="Price history time window"
            size="sm"
          />
        </div>
      </div>

      <div className="trend-chart-container" style={{ minHeight: "260px", width: "100%" }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              dy={6}
            />
            <YAxis
              domain={["auto", "auto"]}
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              dx={-4}
              className="tabular-nums"
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0]?.payload;
                if (!data) return null;

                return (
                  <div className="chart-tooltip tabular-nums">
                    <div className="chart-tooltip-title">{data.fullDate}</div>
                    <div className="chart-tooltip-median">
                      {selectedFuel}: {formatPrice(data.price)}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              name={selectedFuel}
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Screen Reader Accessible Table Fallback */}
      <div className="sr-only">
        <h4>Station Price History Log for {selectedFuel}</h4>
        <table>
          <caption>Recorded price points</caption>
          <thead>
            <tr>
              <th scope="col">Date &amp; Time</th>
              <th scope="col">Price</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((pt, i) => (
              <tr key={i}>
                <td>{pt.fullDate}</td>
                <td>{formatPrice(pt.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
