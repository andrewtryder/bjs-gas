export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse py-4" aria-busy="true" aria-label="Loading page content">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-md bg-slate-200" />
        <div className="h-4 w-96 rounded-md bg-slate-100" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-7 w-28 rounded bg-slate-200" />
            <div className="h-3 w-36 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="h-72 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-5 w-48 rounded bg-slate-200" />
        <div className="h-52 w-full rounded bg-slate-50" />
      </div>

      {/* Secondary content skeleton */}
      <div className="h-64 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-5 w-40 rounded bg-slate-200" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-full rounded bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  );
}
