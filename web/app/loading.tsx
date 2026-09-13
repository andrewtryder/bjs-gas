export default function Loading() {
  return (
    <div
      className="skeleton-container"
      aria-busy="true"
      aria-label="Loading page content"
    >
      {/* Title skeleton */}
      <div className="skeleton-title-group">
        <div className="skeleton-shimmer skeleton-title" />
        <div className="skeleton-shimmer skeleton-subtitle" />
      </div>

      {/* Summary KPI skeleton */}
      <div className="skeleton-kpi-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-kpi-card">
            <div className="skeleton-shimmer skeleton-line-sm" />
            <div className="skeleton-shimmer skeleton-line-lg" />
            <div className="skeleton-shimmer skeleton-line-md" />
          </div>
        ))}
      </div>

      {/* Main card skeleton */}
      <div className="skeleton-panel">
        <div className="skeleton-panel-header">
          <div className="skeleton-shimmer skeleton-line-md" />
          <div className="skeleton-shimmer skeleton-line-sm" />
        </div>
        <div className="skeleton-rows">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-shimmer skeleton-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
