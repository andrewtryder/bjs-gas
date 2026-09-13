import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-card">
        <div className="not-found-badge" aria-hidden="true">
          404
        </div>
        <h1 className="not-found-title">
          Page not found
        </h1>
        <p className="not-found-desc">
          We couldn&apos;t find that station or page.
        </p>
        <div className="not-found-actions">
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
    </div>
  );
}
