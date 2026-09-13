"use client";

import { useEffect } from "react";
import { reportErrorToHoneybadger } from "../lib/honeybadger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error caught:", error);
    reportErrorToHoneybadger(error, {
      digest: error.digest,
      runtime: "global_root_boundary",
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: "2rem", fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#F8FAFC" }}>
        <div
          style={{
            maxWidth: "32rem",
            margin: "4rem auto",
            padding: "2rem",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              backgroundColor: "#F1F5F9",
              color: "#475569",
              fontSize: "1.25rem",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1.5rem" }}>
            A critical application error occurred while loading this page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
