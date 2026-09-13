import React from "react";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectControlProps {
  id: string;
  name?: string;
  label: string;
  hideLabel?: boolean;
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function SelectControl({
  id,
  name,
  label,
  hideLabel = true,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
  ariaLabel,
}: SelectControlProps) {
  return (
    <div className={`select-control ${className}`.trim()}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "select-control-label"}>
        {label}
      </label>
      <select
        id={id}
        name={name || id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel || label}
        className="select-control-native"
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
