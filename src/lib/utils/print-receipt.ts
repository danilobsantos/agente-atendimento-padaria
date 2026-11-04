import { formatOrderNumber, parseOrderNotes } from "./format-order";

interface OrderItem {
  id: string;
  price: number;
  quantity: number;
  product: {
    name: string;
  };
  notes: string | null;
  additionalItems?: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface Customer {
  name: string | null;
  phone: string;
}

export interface PrintableOrder {
  id: string;
  status: string;
  source: "WHATSAPP" | "WEB";
  total: number;
  deliveryFee?: number;
  deliveryAddress: {
    fullAddress?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    complement?: string;
  } | null;
  notes: string | null;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function printReceipt80mm(order: PrintableOrder): void {
  const shortId = formatOrderNumber(order.id);
  const formattedDate = formatDate(order.createdAt);
  const sourceLabel = order.source === "WHATSAPP" ? "WHATSAPP" : "CARDÁPIO ONLINE";
  const customerName = order.customer.name || "Cliente S/N";

  const addressText = order.deliveryAddress
    ? order.deliveryAddress.fullAddress ||
      `${order.deliveryAddress.street || ""}, ${order.deliveryAddress.number || ""} - ${order.deliveryAddress.neighborhood || ""}${order.deliveryAddress.complement ? ` (${order.deliveryAddress.complement})` : ""}`.trim()
    : "Retirada no Balcão";

  const itemsHtml = order.items
    .map((item) => {
      const itemTotal = (item.price * item.quantity).toFixed(2).replace(".", ",");
      const unitPrice = item.price.toFixed(2).replace(".", ",");
      return `
        <tr>
          <td style="font-weight: 800; font-size: 14px; vertical-align: top; width: 14%; text-align: left;">${item.quantity}x</td>
          <td style="vertical-align: top; width: 61%; text-align: left;">
            <div style="font-size: 13px; font-weight: 700;">${item.product.name}</div>
            ${item.additionalItems && item.additionalItems.length > 0
              ? item.additionalItems
                  .map((a) => `<div style="font-size: 11px; font-weight: 600; color: #000;">+ ${a.name} (+R$ ${a.price.toFixed(2).replace(".", ",")})</div>`)
                  .join("")
              : ""}
            ${item.notes ? `<div style="font-size: 12px; font-weight: 700; font-style: italic; color: #000;">Obs: ${item.notes}</div>` : ""}
            <div style="font-size: 11px; font-weight: 500; color: #000;">(R$ ${unitPrice} un)</div>
          </td>
          <td style="font-weight: 800; font-size: 13px; vertical-align: top; width: 25%; text-align: right;">R$ ${itemTotal}</td>
        </tr>
      `;
    })
    .join("");

  const formattedTotal = order.total.toFixed(2).replace(".", ",");
  const { paymentMethod, observations } = parseOrderNotes(order.notes);

  const receiptHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Comprovante ${shortId}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: Arial, Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 8px 4px;
          color: #000;
          background: #fff;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 500;
          -webkit-print-color-adjust: exact;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
        }
        .header h1 {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header p {
          font-size: 12px;
          font-weight: 600;
          margin: 0;
        }
        .divider {
          border-top: 1.5px dashed #000;
          margin: 6px 0;
        }
        .divider-double {
          border-top: 2px solid #000;
          margin: 8px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 3px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          margin: 5px 0 3px 0;
        }
        .customer-info p {
          margin: 2px 0;
          font-size: 13px;
          font-weight: 600;
        }
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 4px;
        }
        table.items-table td {
          padding: 3px 0;
        }
        .totals {
          margin-top: 6px;
        }
        .totals .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 17px;
          font-weight: 800;
          margin-top: 6px;
        }
        .footer {
          text-align: center;
          margin-top: 10px;
          font-size: 11px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SABOR DE MINAS</h1>
        <p>Comprovante de Pedido</p>
      </div>

      <div class="divider-double"></div>

      <div class="info-row">
        <span><strong>PEDIDO:</strong> <span style="font-size: 14px; font-weight: 800;">${shortId}</span></span>
        <span><strong>CANAL:</strong> ${sourceLabel}</span>
      </div>
      <div class="info-row">
        <span><strong>DATA:</strong> ${formattedDate}</span>
      </div>

      <div class="divider"></div>

      <div class="customer-info">
        <div class="section-title">CLIENTE</div>
        <p><strong>NOME:</strong> ${customerName}</p>
        <p><strong>TEL:</strong> ${order.customer.phone}</p>
      </div>

      <div class="divider"></div>

      <div class="customer-info">
        <div class="section-title">ENDEREÇO DE ENTREGA</div>
        <p style="font-size: 13px; font-weight: 700; line-height: 1.35;">${addressText}</p>
      </div>

      <div class="divider-double"></div>

      <div class="section-title">ITENS DO PEDIDO</div>
      <table class="items-table">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="divider-double"></div>

      <div class="totals">
        <div class="info-row">
          <span>Forma de Pagamento:</span>
          <span style="font-weight: 800; font-size: 13px;">${paymentMethod}</span>
        </div>
        ${observations ? `
        <div class="info-row" style="margin-top: 3px; display: flex; flex-direction: column; align-items: flex-start;">
          <span style="font-size: 12px; font-weight: 700;"><strong>Obs:</strong> ${observations}</span>
        </div>` : ""}
        ${order.deliveryAddress ? `
        <div class="info-row" style="margin-top: 4px;">
          <span>Subtotal:</span>
          <span>R$ ${(order.total - (order.deliveryFee ?? 0)).toFixed(2).replace(".", ",")}</span>
        </div>
        <div class="info-row">
          <span>Taxa de Entrega:</span>
          <span>R$ ${(order.deliveryFee ?? 0).toFixed(2).replace(".", ",")}</span>
        </div>
        ` : ""}
        <div class="divider"></div>
        <div class="total-row">
          <span>VALOR TOTAL:</span>
          <span>R$ ${formattedTotal}</span>
        </div>
      </div>

      <div class="divider-double"></div>

      <div class="footer">
        <p>Obrigado pela preferência!</p>
        <p>Sabor de Minas Padaria & Confeitaria</p>
      </div>
    </body>
    </html>
  `;

  // Create an invisible iframe for isolated printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error("Could not access iframe document for printing");
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(receiptHtml);
  doc.close();

  // Trigger print after iframe renders
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Error triggering receipt print:", err);
    } finally {
      // Remove iframe after print dialog is closed
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 300);
}
