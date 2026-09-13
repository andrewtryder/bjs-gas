import { useMemo } from "react";
import Link from "next/link";
import type { NearbyStationDto } from "../lib/types";
import { formatNearbyPriceDelta, formatPrice } from "../lib/stats";

interface NearbyStationsProps {
  nearby: NearbyStationDto[];
  targetStationName: string;
}

export default function NearbyStations({ nearby, targetStationName }: NearbyStationsProps) {
  const collisionKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of nearby || []) {
      if (s.city && s.state) {
        const key = `${s.city.toLowerCase().trim()}, ${s.state.toLowerCase().trim()}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const set = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) set.add(key);
    }
    return set;
  }, [nearby]);

  if (!nearby || nearby.length === 0) {
    return null;
  }

  return (
    <section className="nearby-section" aria-labelledby="nearby-stations-heading">
      <div className="nearby-section-header">
        <h2 id="nearby-stations-heading" className="section-title">
          Nearby BJ&apos;s Gas Stations
        </h2>
        <p className="section-subtitle">
          Closest reporting fuel locations compared to {targetStationName}.
        </p>
      </div>

      <div className="nearby-stations-grid">
        {nearby.map((station) => {
          const delta = formatNearbyPriceDelta(
            station.priceDeltaVsTarget || station.priceDeltaFormatted,
          );

          const regularPriceFormatted = station.regularPrice
            ? formatPrice(station.regularPrice)
            : "—";

          const isCollision = collisionKeys.has(
            `${station.city.toLowerCase().trim()}, ${station.state.toLowerCase().trim()}`,
          );

          return (
            <div
              key={station.clubNumber}
              className={`nearby-station-card ${delta.isCheaper ? "cheaper-station" : ""}`}
            >
              <div className="nearby-card-top">
                <div className="nearby-card-title-group">
                  <Link
                    href={`/stations/${station.clubNumber}`}
                    className="nearby-station-name hover:underline"
                  >
                    <span>{station.city}, {station.state}</span>
                    {isCollision && (
                      <span className="station-location-qualifier"> · #{station.clubNumber}</span>
                    )}
                  </Link>
                  <p className="nearby-station-address">
                    {station.address1 || station.address} &middot; Club #{station.clubNumber}
                  </p>
                </div>
                <span className="nearby-distance-badge" title="Distance from current station">
                  {station.distanceFormatted}
                </span>
              </div>

              <div className="nearby-card-price-row">
                <div>
                  <div className="nearby-price-label">Regular</div>
                  <div className="nearby-price-value tabular-nums">
                    {regularPriceFormatted}
                  </div>
                </div>

                {delta.text && (
                  <span
                    className={`badge ${
                      delta.isCheaper
                        ? "badge-cheaper"
                        : delta.isHigher
                        ? "badge-higher"
                        : "badge-neutral"
                    }`}
                  >
                    {delta.isCheaper && <span aria-hidden="true">&darr;</span>}
                    {delta.isHigher && <span aria-hidden="true">&uarr;</span>}
                    {delta.text}
                  </span>
                )}
              </div>

              <div className="nearby-card-actions">
                <Link
                  href={`/stations/${station.clubNumber}`}
                  className="nearby-action-link primary hover:underline"
                >
                  Details &rarr;
                </Link>
                <Link
                  href={`/map?station=${station.clubNumber}`}
                  className="nearby-action-link secondary hover:underline"
                  aria-label={`View ${station.city} station on map`}
                >
                  Map &nearr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
