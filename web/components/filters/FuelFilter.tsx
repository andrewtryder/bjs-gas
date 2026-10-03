
export interface FuelFilterItem {
  sku: string;
  name: string;
}

export interface FuelFilterProps {
  fuels: FuelFilterItem[];
  selectedFuel: string;
  onSelectFuel: (sku: string) => void;
  allLabel?: string;
  ariaLabel?: string;
}

export function FuelFilter({
  fuels,
  selectedFuel,
  onSelectFuel,
  allLabel = "All fuels",
  ariaLabel = "Filter by fuel type",
}: FuelFilterProps) {
  return (
    <div className="directory-fuel-group" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={`directory-fuel-chip ${selectedFuel === "ALL" ? "active" : ""}`}
        onClick={() => onSelectFuel("ALL")}
        aria-pressed={selectedFuel === "ALL"}
      >
        {allLabel}
      </button>
      {fuels.map((f) => (
        <button
          key={f.sku}
          type="button"
          className={`directory-fuel-chip ${selectedFuel === f.sku ? "active" : ""}`}
          onClick={() => onSelectFuel(f.sku)}
          aria-pressed={selectedFuel === f.sku}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
