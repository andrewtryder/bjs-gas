import { timingSafeEqual } from "node:crypto";

export function authorizeCollector(
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
