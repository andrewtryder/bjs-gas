"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportErrorToHoneybadger } from "../lib/honeybadger";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for client-side diagnosis
    console.error("App Error Boundary caught:", error);
    reportErrorToHoneybadger(error, {
      digest: error.digest,
      runtime: "client_error_boundary",
    });
  }, [error]);

  return (
    <div className="error-container">
      <div className="error-card">
        <div className="error-icon" aria-hidden="true">
          !
        </div>
        <h1 className="error-title">
          Something went wrong
        </h1>
        <p className="error-desc">
          We couldn&apos;t load this page right now.
        </p>
        <div className="error-actions">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary"
          >
            Try again
          </button>
          <Link
            href="/"
            className="btn btn-secondary"
          >
            Return home
          </Link>
          <Link
            href="/status"
            className="btn btn-secondary"
          >
            Data status
          </Link>
        </div>
      </div>
    </div>
  );
}
