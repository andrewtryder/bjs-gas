import Link from "next/link";
import type { StationDto } from "../lib/types";
import {
  formatStationTitle,
  getCanonicalFuelPrices,
  getLatestObservation,
  getMobileStationRowData,
} from "../lib/discovery";
import { formatDate } from "../lib/stats";
import { getFreshnessInfo } from "../lib/freshness";

export interface StationLedgerProps {
  stations: StationDto[];
  collisionKeys: Set<string>;
  selectedFuel?: string;
  onResetFilters?: () => void;
  ariaLabel?: string;
}

export default function StationLedger({
  stations,
  collisionKeys,
  selectedFuel = "ALL",
  onResetFilters,
  ariaLabel = "BJ's Gas Stations Directory",
}: StationLedgerProps) {
  if (stations.length === 0) {
    return (
      <div className="directory-empty-state" role="status">
        <h3 className="directory-empty-title">No matching stations</h3>
        <p className="directory-empty-desc">
          Try another city, ZIP code, or remove a filter.
        </p>
        {onResetFilters && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onResetFilters}
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  const fuelLower = selectedFuel.trim().toLowerCase();
  const isRegularSelected = selectedFuel === "1" || fuelLower === "regular";
  const isPremiumSelected = selectedFuel === "3" || fuelLower === "premium";
  const isDieselSelected = selectedFuel === "4" || fuelLower === "diesel";

  return (
    <div className="directory-ledger-root">
      {/* Desktop Ledger Table (Visible >= 768px) */}
      <div className="directory-table-wrapper">
        <table className="directory-table" aria-label={ariaLabel}>
          <thead>
            <tr>
              <th scope="col" className="ledger-col-station">
                Station
              </th>
              <th
                scope="col"
                className={`ledger-col-price ${isRegularSelected ? "is-selected-fuel" : ""}`}
              >
                Regular
              </th>
              <th
                scope="col"
                className={`ledger-col-price ${isPremiumSelected ? "is-selected-fuel" : ""}`}
              >
                Premium
              </th>
              <th
                scope="col"
                className={`ledger-col-price ${isDieselSelected ? "is-selected-fuel" : ""}`}
              >
                Diesel
              </th>
              <th scope="col" className="ledger-col-updated">
                Updated
              </th>
              <th scope="col" className="ledger-col-actions">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => {
              const prices = getCanonicalFuelPrices(station);
              const latestObs = getLatestObservation(station);
              const freshness = latestObs ? getFreshnessInfo(latestObs) : null;
              const title = formatStationTitle(station, collisionKeys);

              return (
                <tr key={station.clubNumber} className="directory-row">
                  <td className="ledger-col-station">
                    <div className="station-location-block">
                      <Link
                        href={`/stations/${station.clubNumber}`}
                        className="station-location-title"
                      >
                        {title}
                      </Link>
                      <span className="station-location-sub">
                        {station.address1 || station.address} &middot; Club #{station.clubNumber}
                      </span>
                    </div>
                  </td>

                  <td
                    className={`ledger-col-price ${isRegularSelected ? "is-selected-fuel" : ""}`}
                  >
                    <span
                      className={`ledger-price-regular tabular-nums ${!prices.regular.isAvailable ? "is-unavailable" : ""}`}
                      aria-label={
                        prices.regular.isAvailable
                          ? `${prices.regular.priceFormatted} Regular`
                          : "Regular price unavailable"
                      }
                    >
                      {prices.regular.priceFormatted}
                    </span>
                  </td>

                  <td
                    className={`ledger-col-price ${isPremiumSelected ? "is-selected-fuel" : ""}`}
                  >
                    <span
                      className={`ledger-price-secondary tabular-nums ${!prices.premium.isAvailable ? "is-unavailable" : ""}`}
                      aria-label={
                        prices.premium.isAvailable
                          ? `${prices.premium.priceFormatted} Premium`
                          : "Premium price unavailable"
                      }
                    >
                      {prices.premium.priceFormatted}
                    </span>
                  </td>

                  <td
                    className={`ledger-col-price ${isDieselSelected ? "is-selected-fuel" : ""}`}
                  >
                    <span
                      className={`ledger-price-secondary tabular-nums ${!prices.diesel.isAvailable ? "is-unavailable" : ""}`}
                      aria-label={
                        prices.diesel.priceFormatted !== "—"
                          ? `${prices.diesel.priceFormatted} Diesel`
                          : "Diesel price unavailable"
                      }
                    >
                      {prices.diesel.priceFormatted}
                    </span>
                  </td>

                  <td className="ledger-col-updated">
                    {freshness ? (
                      <span
                        className={`freshness-text ${
                          freshness.level === "aging"
                            ? "text-warning"
                            : freshness.level === "stale"
                            ? "text-higher"
                            : "text-muted"
                        }`}
                        title={latestObs ? formatDate(latestObs) : undefined}
                      >
                        {freshness.relativeText}
                        {freshness.level === "aging" && " · Aging"}
                        {freshness.level === "stale" && " · Stale"}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>

                  <td className="ledger-col-actions">
                    <Link
                      href={`/map?station=${station.clubNumber}`}
                      className="station-map-action"
                      aria-label={`View ${station.city}, ${station.state} on map`}
                    >
                      Map &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Ledger Records (Visible < 768px) */}
      <div className="directory-mobile-list" aria-label={ariaLabel}>
        {stations.map((station) => {
          const mobileData = getMobileStationRowData(station, selectedFuel);
          const latestObs = getLatestObservation(station);
          const freshness = latestObs ? getFreshnessInfo(latestObs) : null;
          const title = formatStationTitle(station, collisionKeys);

          return (
            <div key={station.clubNumber} className="station-mobile-row">
              <div className="mobile-row-header">
                <div className="mobile-row-location">
                  <Link
                    href={`/stations/${station.clubNumber}`}
                    className="mobile-row-title"
                  >
                    {title}
                  </Link>
                </div>
                <div className="mobile-row-price-block">
                  <span className="mobile-row-price tabular-nums">
                    {mobileData.primaryPriceFormatted}
                  </span>
                </div>
              </div>

              <div className="mobile-row-sub">
                <span className="mobile-row-address">
                  {station.address1 || station.address} &middot; Club #{station.clubNumber}
                </span>
                <span className="mobile-row-fuel-label">
                  {mobileData.primaryFuelLabel}
                </span>
              </div>

              {mobileData.secondaryFuels.length > 0 && (
                <div className="mobile-row-secondary-fuels">
                  {mobileData.secondaryFuels.map((sf) => (
                    <span key={sf.label} className="mobile-secondary-fuel">
                      <span className="mobile-secondary-fuel-name">{sf.label}</span>
                      <span className="mobile-secondary-fuel-price tabular-nums">
                        {sf.price}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              <div className="mobile-row-footer">
                <div className="mobile-row-freshness">
                  {freshness ? (
                    <span
                      className={`freshness-text ${
                        freshness.level === "aging"
                          ? "text-warning"
                          : freshness.level === "stale"
                          ? "text-higher"
                          : "text-muted"
                      }`}
                      title={latestObs ? formatDate(latestObs) : undefined}
                    >
                      {freshness.relativeText}
                      {freshness.level === "aging" && " · Aging"}
                      {freshness.level === "stale" && " · Stale"}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>

                <div className="mobile-row-actions">
                  <Link
                    href={`/map?station=${station.clubNumber}`}
                    className="mobile-row-action-link"
                    aria-label={`View ${station.city}, ${station.state} on map`}
                  >
                    Map &rarr;
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
