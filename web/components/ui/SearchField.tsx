import React from "react";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  hideLabel?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export default function SearchField({
  value,
  onChange,
  onClear,
  placeholder = "Search city, ZIP, or club",
  label = "Search gas stations",
  hideLabel = true,
  id = "station-search-input",
  name = "search",
  disabled = false,
  autoFocus = false,
  className = "",
}: SearchFieldProps) {
  const handleClear = () => {
    onChange("");
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={`search-field ${className}`.trim()} role="search">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "search-field-label"}>
        {label}
      </label>
      <span className="search-field-icon" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        id={id}
        name={name}
        type="search"
        className="search-field-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck="false"
      />
      {value && (
        <button
          type="button"
          className="search-field-clear"
          onClick={handleClear}
          aria-label="Clear search input"
          title="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
}
