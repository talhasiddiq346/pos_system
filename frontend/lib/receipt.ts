import type { OrderWithItems } from "./types";

const QUOTES = [
  "Good food is the foundation of genuine happiness.",
  "One cannot think well, love well, sleep well, if one has not dined well.",
  "Food is our common ground, a universal experience.",
  "Life is uncertain. Eat dessert first.",
  "First we eat, then we do everything else.",
];

function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

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

  const agentName = (order as any).created_by_name || staffName || "Staff";
  const isCallCenter = order.source === "call_center";

  const rows = order.items.map((it) => `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #f0f0f0;">
        <div style="font-weight:600;font-size:13px;">${it.product_name}</div>
        ${it.variant_name ? `<div style="font-size:11px;color:#888;margin-top:1px;">${it.variant_name}</div>` : ""}
      </td>
      <td style="padding:7px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#888;font-size:12px;">×${it.quantity}</td>
      <td style="padding:7px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;font-size:13px;">
        Rs ${(Number(it.unit_price) * it.quantity).toFixed(2)}
      </td>
    </tr>`).join("");

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt #${order.id}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px;
          color: #111;
          background: #fff;
          padding: 28px 24px;
          max-width: 320px;
          margin: 0 auto;
        }

        /* Header */
        .header {
          text-align: center;
          padding-bottom: 16px;
        }
        .header .logo {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -1px;
          color: #111;
        }
        .header .tagline {
          font-size: 10px;
          color: #999;
          margin-top: 2px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .header .order-num {
          display: inline-block;
          margin-top: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          background: #111;
          padding: 3px 12px;
          border-radius: 20px;
          letter-spacing: 0.5px;
        }

        .divider-dash { border:none; border-top:1px dashed #ccc; margin:14px 0; }
        .divider-bold { border:none; border-top:2px solid #111; margin:14px 0; }

        /* Meta info */
        .meta { font-size:11px; line-height:2; }
        .meta-row { display:flex; justify-content:space-between; }
        .meta-label { color:#999; }
        .badge {
          font-size:9px;
          font-weight:700;
          padding:2px 8px;
          border-radius:20px;
          background:#f0f0f0;
          color:#555;
          text-transform:uppercase;
          letter-spacing:0.5px;
        }

        /* Customer box */
        .customer-box {
          background:#f8f8f8;
          border-left:3px solid #111;
          border-radius:0 6px 6px 0;
          padding:10px 12px;
          margin:12px 0;
          font-size:12px;
          line-height:1.9;
        }
        .customer-name {
          font-weight:700;
          font-size:14px;
          margin-bottom:2px;
        }
        .customer-detail { color:#555; }

        /* Items table */
        table { width:100%; border-collapse:collapse; margin-top:4px; }
        .table-head th {
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:0.5px;
          color:#999;
          padding:4px 0 6px;
          font-weight:600;
        }
        .table-head th:nth-child(2) { text-align:center; }
        .table-head th:last-child { text-align:right; }

        /* Total */
        .total-section { padding-top:4px; }
        .total-row {
          display:flex;
          justify-content:space-between;
          padding:4px 0;
          font-size:12px;
          color:#555;
        }
        .total-row .amt { font-family:monospace; }
        .grand-total {
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:10px 0 6px;
          border-top:2px solid #111;
          margin-top:6px;
          font-size:17px;
          font-weight:800;
        }
        .grand-total .amt { font-family:monospace; }

        /* Payment pill */
        .payment-pill {
          display:inline-block;
          font-size:10px;
          font-weight:700;
          padding:3px 10px;
          border-radius:20px;
          border:1px solid #111;
          text-transform:uppercase;
          letter-spacing:0.5px;
        }

        /* Footer */
        .footer {
          text-align:center;
          margin-top:20px;
        }
        .footer .thankyou {
          font-size:15px;
          font-weight:700;
          margin-bottom:6px;
        }
        .footer .quote {
          font-size:10px;
          color:#999;
          font-style:italic;
          line-height:1.6;
          padding:0 8px;
        }
        .footer .visit-again {
          font-size:11px;
          color:#666;
          margin-top:6px;
        }

        @media print { button { display:none; } }
      </style>
    </head>
    <body>

      <div class="header">
        <div class="logo">${branchName}</div>
        <div class="tagline">Official Receipt</div>
        <div class="order-num">Order #${order.id}</div>
      </div>

      <hr class="divider-bold">

      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">Date</span>
          <span>${new Date(order.created_at).toLocaleDateString("en-PK", { day:"numeric", month:"short", year:"numeric" })}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Time</span>
          <span>${new Date(order.created_at).toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit" })}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Source</span>
          <span><span class="badge">${sourceLabel}</span></span>
        </div>
        <div class="meta-row">
          <span class="meta-label">${isCallCenter ? "Agent" : "Cashier"}</span>
          <span>${agentName}</span>
        </div>
      </div>

      ${order.customer_name ? `
        <div class="customer-box">
          <div class="customer-name">👤 ${order.customer_name}</div>
          ${(order as any).customer_phone ? `<div class="customer-detail">📞 ${(order as any).customer_phone}</div>` : ""}
          ${(order as any).customer_address ? `<div class="customer-detail">📍 ${(order as any).customer_address}</div>` : ""}
        </div>
      ` : "<hr class='divider-dash'>"}

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

      <hr class="divider-dash">

      <div class="total-section">
        <div class="total-row">
          <span>Subtotal</span>
          <span class="amt">Rs ${Number(order.subtotal).toFixed(2)}</span>
        </div>
        <div class="grand-total">
          <span>Total</span>
          <span class="amt">Rs ${Number(order.total).toFixed(2)}</span>
        </div>
        <div style="margin-top:8px;text-align:right;">
          <span class="payment-pill">${order.payment_method === "cash" ? "💵 Cash" : "💳 Card"}</span>
        </div>
      </div>

      <hr class="divider-dash">

      <div class="footer">
        <div class="thankyou">Thank you for your order! 🙏</div>
        <div class="quote">"${randomQuote()}"</div>
        <div class="visit-again">We hope to see you again soon</div>
      </div>

      <script>window.onload = () => { window.focus(); window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}