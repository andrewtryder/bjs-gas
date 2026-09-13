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
          Nearby BJ&apos;s gas stations
        </h2>
        <p className="section-subtitle">
          Closest reporting fuel locations compared to {targetStationName}.
        </p>
      </div>

      <div className="nearby-stations-ledger">
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
            <div key={station.clubNumber} className="nearby-station-row">
              <div className="nearby-row-left">
                <Link
                  href={`/stations/${station.clubNumber}`}
                  className="nearby-row-title"
                >
                  <span>{station.city}, {station.state}</span>
                  {isCollision && (
                    <span className="station-location-qualifier"> · #{station.clubNumber}</span>
                  )}
                </Link>
                <div className="nearby-row-meta">
                  <span className="nearby-distance">{station.distanceFormatted}</span>
                  <span className="nearby-meta-dot" aria-hidden="true">&bull;</span>
                  <span className="nearby-address">{station.address1 || station.address}</span>
                </div>
              </div>

              <div className="nearby-row-right">
                <div className="nearby-price-block">
                  <span className="nearby-row-price tabular-nums">
                    {regularPriceFormatted}
                  </span>
                  {delta.text && (
                    <span
                      className={`nearby-delta-tag ${
                        delta.isCheaper
                          ? "text-cheaper"
                          : delta.isHigher
                          ? "text-higher"
                          : "text-muted"
                      }`}
                    >
                      {delta.isCheaper && <span aria-hidden="true">&darr; </span>}
                      {delta.isHigher && <span aria-hidden="true">&uarr; </span>}
                      {delta.text}
                    </span>
                  )}
                </div>

                <div className="nearby-row-actions">
                  <Link
                    href={`/stations/${station.clubNumber}`}
                    className="nearby-action-link"
                    aria-label={`View ${station.city} details`}
                  >
                    Details &rarr;
                  </Link>
                  <Link
                    href={`/map?station=${station.clubNumber}`}
                    className="nearby-action-map"
                    aria-label={`View ${station.city} on map`}
                  >
                    Map
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
