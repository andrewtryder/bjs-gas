"use client";


export interface SegmentedControlOption<T extends string | number> {
  value: T;
  label: string;
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
}

export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel = "Filter options",
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`segmented-control segmented-control-${size}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            className={`segmented-btn ${isSelected ? "active" : ""}`}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            aria-label={option.ariaLabel || option.label}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
