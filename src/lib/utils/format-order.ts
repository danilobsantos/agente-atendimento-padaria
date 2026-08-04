/**
 * Formats a raw order UUID/cuid into a short, friendly, 4-character uppercase order code.
 * Example: "72b04f0b-0a4b-4c30-98e5-71d69a43e625" -> "#E625"
 */
export function formatOrderNumber(orderId: string): string {
  if (!orderId) return "#0000";
  const clean = orderId.replace(/-/g, "").toUpperCase();
  const short = clean.length >= 4 ? clean.slice(-4) : clean;
  return `#${short}`;
}
