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
import { getStateName } from "../lib/states";
import SegmentedControl from "./ui/SegmentedControl";

interface NationalTrendChartProps {
  initialTrends: NationalTrendsResponse;
  title?: string;
  subtitle?: string;
}

export default function NationalTrendChart({
  initialTrends,
  title,
  subtitle,
}: NationalTrendChartProps) {
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

  // Derived trend delta
  const trendSummary = useMemo(() => {
    if (chartData.length < 2) return null;
    const latest = chartData[chartData.length - 1]!;
    const earliest = chartData[0]!;
    const diff = latest.median - earliest.median;
    const cents = Math.round(diff * 100);

    let changeText = `No change over ${selectedDays} days`;
    let isFavorable = false;
    let isUnfavorable = false;

    if (cents > 0) {
      changeText = `+${cents}¢ over ${selectedDays} days`;
      isUnfavorable = true;
    } else if (cents < 0) {
      changeText = `${cents}¢ over ${selectedDays} days`;
      isFavorable = true;
    }

    return {
      currentMedian: latest.median,
      changeText,
      isFavorable,
      isUnfavorable,
    };
  }, [chartData, selectedDays]);

  if (!initialTrends || initialTrends.points.length === 0) {
    return (
      <div className="card empty-state" style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
          Not enough history yet
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>
          Price trends will appear as more observations are collected.
        </p>
      </div>
    );
  }

  const defaultTitle = initialTrends.state
    ? `${getStateName(initialTrends.state)} (${initialTrends.state}) price trend`
    : `National price trend`;

  const defaultSubtitle = initialTrends.state
    ? `Daily median and price range for BJ's stations in ${getStateName(initialTrends.state)}`
    : `Daily median and range across reporting BJ's stations`;

  return (
    <div className="trend-section">
      <div className="trend-header">
        <div>
          <h3 className="section-title">{title || defaultTitle}</h3>
          <p className="section-subtitle">{subtitle || defaultSubtitle}</p>
          {trendSummary && (
            <div className="trend-stat-summary">
              <span className="trend-stat-price tabular-nums">
                {formatPrice(trendSummary.currentMedian)}
              </span>
              <span
                className={`trend-stat-change ${
                  trendSummary.isFavorable
                    ? "text-cheaper"
                    : trendSummary.isUnfavorable
                    ? "text-higher"
                    : "text-muted"
                }`}
              >
                {trendSummary.changeText}
              </span>
            </div>
          )}
        </div>

        <div className="trend-controls">
          <SegmentedControl
            options={[
              { value: 7, label: "7D", ariaLabel: "7 day price trend" },
              { value: 14, label: "14D", ariaLabel: "14 day price trend" },
              { value: 30, label: "30D", ariaLabel: "30 day price trend" },
            ]}
            value={selectedDays}
            onChange={(val) => setSelectedDays(val)}
            ariaLabel="Price trend time window"
            size="sm"
          />
        </div>
      </div>

      <div className="trend-chart-container">
        {!mounted ? (
          <div className="trend-loading-placeholder">
            Loading historical trend chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="displayDate"
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
                      <div className="chart-tooltip-title">
                        {label} ({data.date})
                      </div>
                      <div className="chart-tooltip-median">
                        Median: {formatPrice(data.median)}
                      </div>
                      <div className="chart-tooltip-range">
                        Range: {formatPrice(data.min)} – {formatPrice(data.max)}
                      </div>
                      <div className="chart-tooltip-count">
                        Reporting: {data.stations} stations
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "0.8125rem" }}
                iconType="plainline"
              />
              {/* Dominant Median Line */}
              <Line
                type="monotone"
                name="Median"
                dataKey="median"
                stroke="#2563eb"
                strokeWidth={2.75}
                dot={false}
                activeDot={{ r: 5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
              />
              {/* Subtle Range Boundary Lines */}
              <Line
                type="monotone"
                name="Lowest"
                dataKey="min"
                stroke="#94a3b8"
                strokeWidth={1.25}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                name="Highest"
                dataKey="max"
                stroke="#94a3b8"
                strokeWidth={1.25}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Screen Reader Accessible Data Table Fallback */}
      <div className="sr-only">
        <h4>{title || defaultTitle} Data</h4>
        <table>
          <caption>Daily fuel prices and reporting station count</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Median Price</th>
              <th scope="col">Lowest Price</th>
              <th scope="col">Highest Price</th>
              <th scope="col">Stations Reporting</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((d) => (
              <tr key={d.date}>
                <td>
                  {d.displayDate} ({d.date})
                </td>
                <td>{formatPrice(d.median)}</td>
                <td>{formatPrice(d.min)}</td>
                <td>{formatPrice(d.max)}</td>
                <td>{d.stations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
