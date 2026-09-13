import Link from "next/link";
import type { NearbyStationDto } from "../lib/types";
import { formatNearbyPriceDelta, formatPrice } from "../lib/stats";

interface NearbyStationsProps {
  nearby: NearbyStationDto[];
  targetStationName: string;
}

export default function NearbyStations({ nearby, targetStationName }: NearbyStationsProps) {
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
                    {station.city}, {station.state}
                  </Link>
                  <p className="nearby-station-address">
                    {station.address} &bull; #{station.clubNumber}
                  </p>
                </div>
                <span className="nearby-distance-badge" title="Distance from current station">
                  {station.distanceFormatted}
                </span>
              </div>

              <div className="nearby-card-price-row">
                <div>
                  <div className="nearby-price-label">Regular Unleaded</div>
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
