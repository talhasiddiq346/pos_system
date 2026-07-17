// ═══════════════════════════════════════════════════
// Order confirmation email — SMTP via nodemailer
// ═══════════════════════════════════════════════════
//
// Setup: add to backend/.env
//   SMTP_HOST=smtp.example.com
//   SMTP_PORT=587
//   SMTP_USER=xxx
//   SMTP_PASS=xxx
//   EMAIL_FROM="Tandoor <orders@example.com>"
//
// Until these are set, sendOrderConfirmationEmail() logs a warning and
// no-ops — it never throws, so a missing/misconfigured mailer can't break checkout.

import nodemailer from "nodemailer";

let transporter = null;
let warned = false;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendOrderConfirmationEmail({ to, brandName, orderCode, total, items }) {
  const t = getTransporter();
  if (!t) {
    if (!warned) {
      console.warn("Email not sent — SMTP_HOST/SMTP_USER/SMTP_PASS not configured in backend/.env");
      warned = true;
    }
    return;
  }

  const itemRows = items.map((it) =>
    `<tr>
       <td style="padding:6px 0;border-bottom:1px solid #eee;">
         ${it.product_name}${it.variant_name ? ` <span style="color:#888;">(${it.variant_name})</span>` : ""}
       </td>
       <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center;">×${it.quantity}</td>
       <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;">Rs ${(Number(it.unit_price) * it.quantity).toFixed(2)}</td>
     </tr>`
  ).join("");

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || `"${brandName}" <no-reply@example.com>`,
      to,
      subject: `Order confirmed — ${orderCode}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
          <h2 style="margin-bottom:4px;">Thanks for your order!</h2>
          <p style="color:#666;margin-top:0;">Your order <strong>${orderCode}</strong> from ${brandName} has been received.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr style="font-size:12px;text-transform:uppercase;color:#999;">
                <th style="text-align:left;padding-bottom:6px;">Item</th>
                <th style="padding-bottom:6px;">Qty</th>
                <th style="text-align:right;padding-bottom:6px;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="display:flex;justify-content:space-between;margin-top:12px;font-weight:700;font-size:16px;">
            <span>Total</span><span>Rs ${Number(total).toFixed(2)}</span>
          </div>
          <p style="color:#999;font-size:12px;margin-top:24px;">
            Track your order anytime with code <strong>${orderCode}</strong> on our website.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send order confirmation email:", err.message);
  }
}
