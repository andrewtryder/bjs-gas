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
    <div className="mx-auto max-w-lg my-16 p-8 rounded-2xl border border-rose-200 bg-white shadow-sm text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4 font-bold text-xl">
        !
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        An unexpected error occurred while loading this view or fetching the latest pricing data.
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Return to Overview
        </Link>
        <Link
          href="/status"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Check System Status
        </Link>
      </div>
    </div>
  );
}
