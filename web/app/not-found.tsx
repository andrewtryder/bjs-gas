import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md my-16 p-8 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-4 font-mono font-bold text-lg">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Page not found
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        We couldn&apos;t find that station or page.
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="btn btn-primary"
        >
          Find a station
        </Link>
        <Link
          href="/map"
          className="btn btn-secondary"
        >
          View map
        </Link>
      </div>
    </div>
  );
}
