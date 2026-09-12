import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card empty-state" style={{ maxWidth: "500px", margin: "4rem auto" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
        Station Not Found
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        We couldn&apos;t find the BJ&apos;s gas station you requested. It may not exist or does not currently offer fuel.
      </p>
      <Link
        href="/"
        className="filter-btn active"
        style={{ display: "inline-block", padding: "0.5rem 1rem", textDecoration: "none" }}
      >
        &larr; Return to Station Directory
      </Link>
    </div>
  );
}
