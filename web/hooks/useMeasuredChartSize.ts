"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_FALLBACK_WIDTH = 320;

interface UseMeasuredChartSizeOptions {
  height?: number;
  fallbackWidth?: number;
}

export function useMeasuredChartSize(options: UseMeasuredChartSizeOptions = {}) {
  const { height = 300, fallbackWidth = DEFAULT_FALLBACK_WIDTH } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallbackWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const measured = el.getBoundingClientRect().width;
      if (measured > 0) {
        setWidth(measured);
      }
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ready = width >= 1;

  return { ref, width, height, ready };
}