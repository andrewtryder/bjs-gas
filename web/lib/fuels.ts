/**
 * Public Fuel Display Label Normalization Foundation
 *
 * Normalizes raw upstream or API fuel labels/SKUs to consumer-friendly Ledger Slate names:
 * - SKU "1" / "Unleaded" / "Regular Unleaded" -> "Regular"
 * - SKU "3" / "Premium" / "Premium Unleaded" -> "Premium"
 * - SKU "4" / "Diesel" -> "Diesel"
 *
 * Preserves raw values if unrecognized, ensuring non-destructive behavior.
 */

export function normalizeFuelDisplayName(nameOrSku: string | null | undefined): string {
  if (!nameOrSku) return "Regular";

  const trimmed = nameOrSku.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "1") return "Regular";
  if (lower === "3") return "Premium";
  if (lower === "4") return "Diesel";

  // Check Premium before Unleaded/Regular so "Premium Unleaded" resolves to "Premium"
  if (lower.includes("premium")) {
    return "Premium";
  }

  // Check Diesel with word boundary to avoid capturing "Biodiesel"
  if (/\b(ultra low sulfur )?diesel\b/.test(lower)) {
    return "Diesel";
  }

  if (lower.includes("regular") || lower.includes("unleaded")) {
    return "Regular";
  }

  return trimmed;
}
