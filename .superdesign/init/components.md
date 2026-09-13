# Shared UI Components

Repository shared UI components for `bjs-gas` web application (`web/components/ui/` and shared UI utilities).

## 1. SectionHeader

- **File path**: `web/components/ui/SectionHeader.tsx`
- **Description**: Standard section heading primitive with title, optional subtitle, optional right-aligned action element, and accessibility anchor support.
- **Props**:
  - `title: string` (required)
  - `subtitle?: string`
  - `action?: React.ReactNode`
  - `id?: string`
  - `className?: string`

```tsx
import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  id?: string;
  className?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  action,
  id,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`section-header ${className}`.trim()}>
      <div>
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}
```

---

## 2. SegmentedControl

- **File path**: `web/components/ui/SegmentedControl.tsx`
- **Description**: Accessible segmented button toggle control with keyboard support, ARIA pressed states, and size variants (`sm` and `md`).
- **Props**:
  - `options: SegmentedControlOption<T>[]`
  - `value: T`
  - `onChange: (value: T) => void`
  - `ariaLabel?: string`
  - `size?: "sm" | "md"`

```tsx
"use client";

import React from "react";

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
```

---

## 3. Breadcrumbs

- **File path**: `web/components/Breadcrumbs.tsx`
- **Description**: Accessible breadcrumbs navigation bar with semantic `<nav>` and `<ol>` tags.
- **Props**:
  - `items: BreadcrumbItem[]` where `BreadcrumbItem = { label: string; href?: string }`

```tsx
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: "1.25rem" }}>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem",
          listStyle: "none",
          padding: 0,
          margin: 0,
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
        }}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={idx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {idx > 0 && <span style={{ color: "var(--border)", userSelect: "none" }}>/</span>}
              {isLast || !item.href ? (
                <span
                  style={{
                    color: "var(--text)",
                    fontWeight: 600,
                  }}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  style={{
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "color 0.15s ease",
                  }}
                  className="hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

---

## 4. HoneybadgerInit

- **File path**: `web/components/HoneybadgerInit.tsx`
- **Description**: Client-side error tracking initialization component for Honeybadger.
- **Props**:
  - `apiKey: string`

```tsx
"use client";

import { useEffect } from "react";
import { initHoneybadgerClient } from "../lib/honeybadger";

export default function HoneybadgerInit({ apiKey }: { apiKey: string }) {
  useEffect(() => {
    initHoneybadgerClient(apiKey);
  }, [apiKey]);

  return null;
}
```
