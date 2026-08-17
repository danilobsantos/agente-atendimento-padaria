import { formatOrderNumber } from "./format-order";

interface SummaryItem {
  quantity: number;
  price: number;
  notes: string | null;
  product: { name: string };
  additionalItems?: unknown;
}

interface SummaryAddress {
  fullAddress?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
}

export interface SummarizableOrder {
  id: string;
  total: number;
  notes: string | null;
  deliveryAddress: unknown;
  items: SummaryItem[];
}

export function formatOrderSummary(order: SummarizableOrder): string {
  const fmt = (value: number) => value.toFixed(2).replace(".", ",");
  const address = (order.deliveryAddress ?? null) as SummaryAddress | null;

  const itemsText = order.items
    .map((item) => {
      const lines = [`${item.quantity}x ${item.product.name}`];
      ((item.additionalItems ?? []) as { name: string; price: number }[]).forEach((a) => {
        lines.push(`   + ${a.name} (+R$ ${fmt(a.price)})`);
      });
      if (item.notes) {
        lines.push(`   Obs: ${item.notes}`);
      }
      return lines.join("\n");
    })
    .join("\n");

  const addressText = address
    ? address.fullAddress ||
      `${address.street || ""}, ${address.number || ""} - ${address.neighborhood || ""}`.trim()
    : "Retirada no balcão";
  const typeLine = address
    ? `Entrega: ${addressText}`
    : "Retirada no balcão";

  const paymentText = order.notes || "Não informado";

  return `Olá! Seu pedido ${formatOrderNumber(order.id)} foi recebido e já está em preparo. ✅

Itens:
${itemsText}

Total: R$ ${fmt(order.total)}
Forma de pagamento: ${paymentText}
${typeLine}

Obrigado pela preferência!`;
}