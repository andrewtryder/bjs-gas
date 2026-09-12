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
import type { NationalTrendsResponse, TrendPoint } from "../lib/analytics";
import { formatPrice } from "../lib/stats";

interface NationalTrendChartProps {
  initialTrends: NationalTrendsResponse;
}

export default function NationalTrendChart({ initialTrends }: NationalTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number>(30);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter points based on selected days window
  const chartData = useMemo(() => {
    const allPoints = initialTrends.points || [];
    if (allPoints.length === 0) return [];

    const sliceCount = Math.min(selectedDays, allPoints.length);
    const sliced = allPoints.slice(-sliceCount);

    return sliced.map((p: TrendPoint) => {
      // Parse YYYY-MM-DD
      const [y, m, d] = p.date.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y!, m! - 1, d!));
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });

      return {
        date: p.date,
        displayDate: formattedDate,
        median: Number.parseFloat(p.medianPrice),
        min: Number.parseFloat(p.minPrice),
        max: Number.parseFloat(p.maxPrice),
        stations: p.stationCount,
      };
    });
  }, [initialTrends, selectedDays]);

  if (!initialTrends || initialTrends.points.length === 0) {
    return (
      <div className="card empty-state">
        <p>No historical trend data available yet.</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div
        className="card"
        style={{
          height: "360px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Loading historical trend chart...
      </div>
    );
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
            National {initialTrends.fuel.name} Price Trend
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Reconstructed daily median and price range across reporting BJ&apos;s stations
          </p>
        </div>

        <div className="chart-controls" style={{ marginBottom: 0 }}>
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              className={`filter-btn ${selectedDays === days ? "active" : ""}`}
              onClick={() => setSelectedDays(days)}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", height: "300px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="displayDate"
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
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0]?.payload;
                if (!data) return null;

                return (
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.375rem" }}>
                      {label} ({data.date})
                    </div>
                    <div style={{ color: "#2563eb", fontWeight: 600 }}>
                      Median: {formatPrice(data.median)}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                      Range: {formatPrice(data.min)} – {formatPrice(data.max)}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                      Reporting: {data.stations} stations
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: "10px", fontSize: "0.8125rem" }}
            />
            <Line
              type="monotone"
              name="Median Price"
              dataKey="median"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 4, fill: "#2563eb" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              name="Lowest Price"
              dataKey="min"
              stroke="#15803d"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              name="Highest Price"
              dataKey="max"
              stroke="#b91c1c"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
