"use client";

import { useEffect } from "react";
import { initHoneybadger } from "../lib/honeybadger";

interface HoneybadgerInitProps {
  apiKey?: string | null;
}

/**
 * Initializes Honeybadger error reporting on the browser client.
 * Uses the project reporting API key provided from root layout.
 *
 * Configures ignoreBrowserExtensionErrors: true and conservative
 * beforeNotify stack analysis to reject browser extension noise.
 */
export default function HoneybadgerInit({ apiKey }: HoneybadgerInitProps) {
  useEffect(() => {
    if (apiKey) {
      initHoneybadger({ apiKey });
    }
  }, [apiKey]);

  return null;
}
