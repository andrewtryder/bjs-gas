export default function Loading() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-6 py-4 skeleton-container"
      aria-busy="true"
      aria-label="Loading page content"
    >
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-md bg-slate-200 skeleton-shimmer" />
        <div className="h-4 w-80 rounded-md bg-slate-100 skeleton-shimmer" />
      </div>

      {/* Summary KPI skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-slate-200 bg-white p-4 space-y-2.5"
          >
            <div className="h-3 w-24 rounded bg-slate-200 skeleton-shimmer" />
            <div className="h-6 w-20 rounded bg-slate-200 skeleton-shimmer" />
            <div className="h-3 w-32 rounded bg-slate-100 skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Main card skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 w-40 rounded bg-slate-200 skeleton-shimmer" />
          <div className="h-8 w-32 rounded bg-slate-100 skeleton-shimmer" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 w-full rounded-lg bg-slate-50 border border-slate-100 skeleton-shimmer"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
