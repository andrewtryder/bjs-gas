import React from "react";

export interface FilterToolbarProps {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  totalCount: number;
  filteredCount: number;
  unitLabel?: string;
  unitLabelSingular?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  resetLabel?: string;
  className?: string;
}

export function FilterToolbar({
  primary,
  secondary,
  totalCount,
  filteredCount,
  unitLabel = "locations",
  unitLabelSingular,
  hasActiveFilters = false,
  onResetFilters,
  resetLabel = "Clear filters",
  className = "directory-toolbar",
}: FilterToolbarProps) {
  const singular = unitLabelSingular || (unitLabel.endsWith("s") ? unitLabel.slice(0, -1) : unitLabel);
  const labelForTotal = totalCount === 1 ? singular : unitLabel;

  const countText =
    filteredCount === totalCount
      ? `${totalCount} ${labelForTotal}`
      : `${filteredCount} of ${totalCount} ${unitLabel}`;

  return (
    <div className={className}>
      <div className="directory-toolbar-primary">{primary}</div>

      {(secondary || totalCount > 0 || hasActiveFilters) && (
        <div className="directory-toolbar-secondary">
          {secondary}
          <div className="directory-meta">
            <span className="directory-count tabular-nums">{countText}</span>
            {hasActiveFilters && onResetFilters && (
              <button
                type="button"
                className="directory-clear-btn"
                onClick={onResetFilters}
              >
                {resetLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
