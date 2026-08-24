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

/**
 * Extracts payment method and observations from order notes string.
 * Examples:
 * - "Pagamento: CARTAO | Obs: Troco para 50,00" -> { paymentMethod: "CARTÃO", observations: "Troco para 50,00" }
 * - "Pagamento: PIX" -> { paymentMethod: "PIX", observations: null }
 * - "Pagamento: Dinheiro" -> { paymentMethod: "DINHEIRO", observations: null }
 */
export function parseOrderNotes(notes: string | null | undefined): {
  paymentMethod: string;
  observations: string | null;
} {
  if (!notes || !notes.trim()) {
    return { paymentMethod: "Não informado", observations: null };
  }

  let raw = notes.trim();
  let obs: string | null = null;

  // Split by "| Obs:" or "\nObs:" or "| Observações:"
  const parts = raw.split(/\s*\|\s*(?:obs|observação|observacao|observações|observacoes):\s*|\s*\n\s*(?:obs|observação|observacao|observações|observacoes):\s*/i);
  if (parts.length > 1) {
    raw = parts[0].trim();
    obs = parts.slice(1).join(" ").trim() || null;
  }

  // Remove "Pagamento: " or "Forma de Pagamento: " prefix
  let payment = raw.replace(/^(?:forma\s+de\s+)?pagamento:\s*/i, "").trim();

  // Normalize payment method label
  const normalized = payment.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  if (normalized === "PIX") {
    payment = "PIX";
  } else if (
    normalized === "CARTAO" ||
    normalized.includes("CARTAO") ||
    normalized.includes("CREDITO") ||
    normalized.includes("DEBITO")
  ) {
    payment = "CARTÃO";
  } else if (
    normalized === "DINHEIRO" ||
    normalized.includes("DINHEIRO")
  ) {
    payment = "DINHEIRO";
  } else if (raw.toLowerCase().startsWith("pagamento:") || raw.toLowerCase().startsWith("forma de pagamento:")) {
    payment = payment.toUpperCase();
  }

  return {
    paymentMethod: payment || "Não informado",
    observations: obs,
  };
}
