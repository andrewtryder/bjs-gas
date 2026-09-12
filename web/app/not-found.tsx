import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md my-16 p-8 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-4 font-mono font-bold text-lg">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Page Not Found
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        The gas station, state page, or resource you requested could not be located. It may have moved or does not currently offer fuel service.
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          &larr; Overview
        </Link>
        <Link
          href="/states"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Browse States
        </Link>
        <Link
          href="/map"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Map
        </Link>
      </div>
    </div>
  );
}
