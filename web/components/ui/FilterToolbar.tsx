import React from "react";

export interface FilterToolbarProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function FilterToolbarRoot({
  children,
  className = "",
  ariaLabel = "Filter and search options",
}: FilterToolbarProps) {
  return (
    <div
      className={`filter-toolbar ${className}`.trim()}
      role="search"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export interface FilterToolbarRowProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterToolbarPrimary({
  children,
  className = "",
}: FilterToolbarRowProps) {
  return (
    <div className={`filter-toolbar-primary ${className}`.trim()}>
      {children}
    </div>
  );
}

export function FilterToolbarSecondary({
  children,
  className = "",
}: FilterToolbarRowProps) {
  return (
    <div className={`filter-toolbar-secondary ${className}`.trim()}>
      {children}
    </div>
  );
}

export function FilterToolbarGroup({
  children,
  className = "",
  ariaLabel,
}: FilterToolbarRowProps & { ariaLabel?: string }) {
  return (
    <div
      className={`filter-toolbar-group ${className}`.trim()}
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function FilterToolbarStatus({
  children,
  className = "",
}: FilterToolbarRowProps) {
  return (
    <div className={`filter-toolbar-status ${className}`.trim()}>
      {children}
    </div>
  );
}

export const FilterToolbar = Object.assign(FilterToolbarRoot, {
  Primary: FilterToolbarPrimary,
  Secondary: FilterToolbarSecondary,
  Group: FilterToolbarGroup,
  Status: FilterToolbarStatus,
});

export default FilterToolbar;
