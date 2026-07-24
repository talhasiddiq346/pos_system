import type { OrderWithItems } from "./types";

export function openPrintableReceipt(
  order: OrderWithItems,
  branchName: string,
  staffName?: string
) {
  const win = window.open("", "_blank", "width=420,height=750");
  if (!win) return;

  const sourceLabel =
    order.source === "call_center" ? "Call Center" :
    order.source === "online" ? "Online" : "Walk-in";

  const tableLabel = (order as any).restaurant_table_name || order.table_number;
  const orderTypeLabel =
    order.order_type === "dine_in" ? `Dine In${tableLabel ? ` · ${tableLabel}` : ""}` :
    order.order_type === "delivery" ? "Delivery" : "Takeaway";

  const agentName = (order as any).created_by_name || staffName || "Staff";
  const isCallCenter = order.source === "call_center";

  const thankYouLabel =
    order.order_type === "dine_in" ? "Thank you for dining with us" :
    order.order_type === "delivery" ? "Thank you for your order!" :
    "Thank you for your order, see you soon!";

  const rows = order.items.map((it) => {
    const addons = (it as any).selected_addons as { name: string; price: number }[] | undefined;
    const addonLines = Array.isArray(addons) && addons.length > 0
      ? `<div style="font-size:11px;color:#888;margin-top:1px;">+ ${addons.map((a) => a.name).join(", ")}</div>`
      : "";
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">
        <div style="font-weight:600;font-size:13px;">${it.product_name}</div>
        ${it.variant_name ? `<div style="font-size:11px;color:#888;margin-top:1px;">${it.variant_name}</div>` : ""}
        ${addonLines}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;color:#888;font-size:12px;">×${it.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-family:'SF Mono',Consolas,monospace;font-size:13px;">
        Rs ${(Number(it.unit_price) * it.quantity).toFixed(2)}
      </td>
    </tr>`;
  }).join("");

  const discountAmount = Number((order as any).discount_amount || 0);
  const taxAmount = Number((order as any).tax_amount || 0);
  const deliveryFee = Number((order as any).delivery_fee || 0);
  const voucherCode = (order as any).voucher_code;

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt #${order.order_code || order.id}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 13px;
          color: #1a1a1a;
          background: #fff;
          padding: 30px 26px;
          max-width: 340px;
          margin: 0 auto;
        }

        .header { text-align: center; padding-bottom: 14px; }
        .header .name {
          font-size: 21px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #111;
        }
        .header .tagline {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          color: #999;
          margin-top: 3px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .divider { border:none; border-top:1px solid #ddd; margin:14px 0; }
        .divider-bold { border:none; border-top:2px solid #111; margin:14px 0; }

        .meta {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size:11.5px;
          line-height:1.9;
        }
        .meta-row { display:flex; justify-content:space-between; }
        .meta-label { color:#888; }
        .order-code {
          font-family:'SF Mono',Consolas,monospace;
          font-weight:700;
          font-size: 13px;
        }

        .customer-box {
          background:#fafafa;
          border-radius:6px;
          padding:10px 12px;
          margin:12px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size:12px;
          line-height:1.8;
        }
        .customer-name { font-weight:700; font-size:13px; }
        .customer-detail { color:#666; }

        table { width:100%; border-collapse:collapse; margin-top:4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .table-head th {
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:0.5px;
          color:#999;
          padding:4px 0 6px;
          font-weight:600;
          border-bottom: 1px solid #ddd;
        }
        .table-head th:nth-child(2) { text-align:center; }
        .table-head th:last-child { text-align:right; }

        .total-section { padding-top:6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .total-row {
          display:flex;
          justify-content:space-between;
          padding:4px 0;
          font-size:12.5px;
          color:#555;
        }
        .total-row .amt { font-family:'SF Mono',Consolas,monospace; }
        .grand-total {
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:10px 0 6px;
          border-top:2px solid #111;
          margin-top:6px;
          font-size:18px;
          font-weight:700;
        }
        .grand-total .amt { font-family:'SF Mono',Consolas,monospace; }

        .payment-pill {
          display:inline-block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size:10px;
          font-weight:700;
          padding:4px 12px;
          border-radius:3px;
          border:1px solid #111;
          text-transform:uppercase;
          letter-spacing:0.5px;
        }

        .footer {
          text-align:center;
          margin-top:22px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .footer .thankyou {
          font-family: Georgia, serif;
          font-size:15px;
          font-weight:700;
          margin-bottom:4px;
        }
        .footer .note {
          font-size:10.5px;
          color:#999;
          line-height:1.6;
        }

        @media print { button { display:none; } }
      </style>
    </head>
    <body>

      <div class="header">
        <div class="name">${branchName}</div>
        <div class="tagline">Official Receipt</div>
      </div>

      <hr class="divider-bold">

      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">Order No.</span>
          <span class="order-code">${order.order_code || `#${order.id}`}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Date</span>
          <span>${new Date(order.created_at).toLocaleDateString("en-PK", { day:"numeric", month:"short", year:"numeric" })}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Time</span>
          <span>${new Date(order.created_at).toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit" })}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Order Type</span>
          <span>${orderTypeLabel}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Source</span>
          <span>${sourceLabel}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">${isCallCenter ? "Agent" : "Served by"}</span>
          <span>${agentName}</span>
        </div>
      </div>

      ${order.customer_name ? `
        <div class="customer-box">
          <div class="customer-name">${order.customer_name}</div>
          ${(order as any).customer_phone ? `<div class="customer-detail">${(order as any).customer_phone}</div>` : ""}
          ${(order as any).customer_address ? `<div class="customer-detail">${(order as any).customer_address}</div>` : ""}
        </div>
      ` : `<hr class="divider">`}

      <table>
        <thead>
          <tr class="table-head">
            <th style="text-align:left;">Item</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="total-section">
        <div class="total-row">
          <span>Subtotal</span>
          <span class="amt">Rs ${Number(order.subtotal).toFixed(2)}</span>
        </div>
        ${discountAmount > 0 ? `
        <div class="total-row" style="color:#1a7a4a;">
          <span>Discount${voucherCode ? ` (${voucherCode})` : ""}</span>
          <span class="amt">− Rs ${discountAmount.toFixed(2)}</span>
        </div>` : ""}
        ${deliveryFee > 0 ? `
        <div class="total-row">
          <span>Delivery Fee</span>
          <span class="amt">Rs ${deliveryFee.toFixed(2)}</span>
        </div>` : ""}
        ${taxAmount > 0 ? `
        <div class="total-row">
          <span>Tax</span>
          <span class="amt">Rs ${taxAmount.toFixed(2)}</span>
        </div>` : ""}
        <div class="grand-total">
          <span>Total</span>
          <span class="amt">Rs ${Number(order.total).toFixed(2)}</span>
        </div>
        <div style="margin-top:8px;text-align:right;">
          <span class="payment-pill">${order.payment_method === "cash" ? "Cash" : "Card"}</span>
        </div>
      </div>

      <hr class="divider">

      <div class="footer">
        <div class="thankyou">${thankYouLabel}</div>
        <div class="note">Please keep this receipt for your records.<br>We look forward to serving you again.</div>
      </div>

      <script>window.onload = () => { window.focus(); window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}
