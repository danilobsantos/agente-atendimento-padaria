import { formatOrderNumber } from "./format-order";

interface OrderItem {
  id: string;
  price: number;
  quantity: number;
  product: {
    name: string;
  };
  notes: string | null;
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
  deliveryAddress: {
    fullAddress?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
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
      `${order.deliveryAddress.street || ""}, ${order.deliveryAddress.number || ""} - ${order.deliveryAddress.neighborhood || ""}`.trim()
    : "Retirada no Balcão";

  const itemsHtml = order.items
    .map((item) => {
      const itemTotal = (item.price * item.quantity).toFixed(2).replace(".", ",");
      const unitPrice = item.price.toFixed(2).replace(".", ",");
      return `
        <tr>
          <td style="font-weight: bold; vertical-align: top; width: 12%; text-align: left;">${item.quantity}x</td>
          <td style="vertical-align: top; width: 63%; text-align: left;">
            <div>${item.product.name}</div>
            ${item.notes ? `<div style="font-size: 11px; font-style: italic; color: #333;">Obs: ${item.notes}</div>` : ""}
            <div style="font-size: 10px; color: #555;">(R$ ${unitPrice} un)</div>
          </td>
          <td style="font-weight: bold; vertical-align: top; width: 25%; text-align: right;">R$ ${itemTotal}</td>
        </tr>
      `;
    })
    .join("");

  const formattedTotal = order.total.toFixed(2).replace(".", ",");
  const paymentMethod = order.notes || "Não informado";

  const receiptHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Comprovante #${shortId}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', Courier, monospace, monospace;
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 8px 4px;
          color: #000;
          background: #fff;
          font-size: 12px;
          line-height: 1.3;
          -webkit-print-color-adjust: exact;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
        }
        .header h1 {
          font-size: 16px;
          font-weight: bold;
          margin: 0 0 2px 0;
          text-transform: uppercase;
        }
        .header p {
          font-size: 11px;
          margin: 0;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .divider-double {
          border-top: 2px solid #000;
          margin: 8px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 3px;
        }
        .section-title {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          margin: 4px 0;
        }
        .customer-info p {
          margin: 2px 0;
          font-size: 12px;
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
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
        }
        .footer {
          text-align: center;
          margin-top: 10px;
          font-size: 11px;
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
        <span><strong>PEDIDO:</strong> #${shortId}</span>
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
        <p><strong>${addressText}</strong></p>
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
          <span style="font-weight: bold;">${paymentMethod}</span>
        </div>
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
