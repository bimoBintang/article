export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  // Try Resend first
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "noreply@ekatalog.local";

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Resend error:", response.status, errorText);
        throw new Error(`Resend API error: ${response.status}`);
      }

      return { success: true, provider: "resend" };
    } catch (err) {
      console.error("Resend send failed:", err);
    }
  }

  // Fallback: log to console in development
  console.log(`[EMAIL FALLBACK] To: ${to}\nSubject: ${subject}\nText: ${text || ""}`);
  return { success: true, provider: "fallback" };
}

export function requestConfirmationEmail({
  customerName,
  requestNumber,
  items,
  total,
}: {
  customerName: string;
  requestNumber: string;
  items: Array<{ product?: string | null; package?: string | null; talent?: string | null; quantity: number }>;
  total: number;
}) {
  const itemList = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.package || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.talent || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      </tr>
    `
    )
    .join("");

  return {
    subject: `Konfirmasi Permintaan Pemotretan #${requestNumber} - Article`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">Article</h1>
          <p>Halo <strong>${customerName}</strong>,</p>
          <p>Terima kasih telah mengirim permintaan pemotretan fashion melalui Article. Permintaan Anda telah kami terima.</p>
          <p><strong>Nomor Permintaan:</strong> ${requestNumber}</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px; text-align: left;">Produk</th>
                <th style="padding: 8px; text-align: left;">Paket</th>
                <th style="padding: 8px; text-align: left;">Model</th>
                <th style="padding: 8px; text-align: center;">Jumlah</th>
              </tr>
            </thead>
            <tbody>${itemList}</tbody>
          </table>
          <p><strong>Total estimasi:</strong> Rp ${total.toLocaleString("id-ID")}</p>
          <p>Tim kami akan meninjau permintaan Anda dan akan segera menghubungi Anda melalui email atau WhatsApp.</p>
          <p>Anda dapat memantau status permintaan kapan saja.</p>
          <br />
          <p style="color: #6b7280; font-size: 14px;">Salam,<br />Tim Article</p>
        </div>
      </body>
      </html>
    `,
    text: `Halo ${customerName}, Terima kasih telah mengirim permintaan pemotretan fashion melalui Article. Nomor Permintaan: ${requestNumber}. Total estimasi: Rp ${total.toLocaleString("id-ID")}. Tim kami akan segera menghubungi Anda.`,
  };
}

export function adminNewRequestEmail({
  adminEmail,
  requestNumber,
  customerName,
  items,
  total,
  dashboardUrl,
}: {
  adminEmail: string;
  requestNumber: string;
  customerName: string;
  items: Array<{ product?: string | null; package?: string | null; talent?: string | null; quantity: number }>;
  total: number;
  dashboardUrl: string;
}) {
  const itemList = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.package || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.talent || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      </tr>
    `
    )
    .join("");

  return {
    subject: `Permintaan Pemotretan Baru #${requestNumber} - Article`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">Article - Admin Notifikasi</h1>
          <p>Permintaan pemotretan baru telah masuk.</p>
          <p><strong>Nomor Permintaan:</strong> ${requestNumber}</p>
          <p><strong>Pelanggan:</strong> ${customerName}</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px; text-align: left;">Produk</th>
                <th style="padding: 8px; text-align: left;">Paket</th>
                <th style="padding: 8px; text-align: left;">Model</th>
                <th style="padding: 8px; text-align: center;">Jumlah</th>
              </tr>
            </thead>
            <tbody>${itemList}</tbody>
          </table>
          <p><strong>Total estimasi:</strong> Rp ${total.toLocaleString("id-ID")}</p>
          <a href="${dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Lihat Detail di Dashboard</a>
          <br />
          <p style="color: #6b7280; font-size: 14px;">Tim Article</p>
        </div>
      </body>
      </html>
    `,
    text: `Permintaan pemotretan baru #${requestNumber} dari ${customerName}. Total estimasi: Rp ${total.toLocaleString("id-ID")}. Lihat detail di ${dashboardUrl}`,
  };
}

export function paymentConfirmationEmail({
  customerName,
  invoiceId,
  total,
  paymentUrl,
}: {
  customerName: string;
  invoiceId: string;
  total: number;
  paymentUrl: string;
}) {
  return {
    subject: `Tautan Pembayaran Invoice #${invoiceId} - Article`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">Article</h1>
          <p>Halo <strong>${customerName}</strong>,</p>
          <p>Tagihan pemotretan Anda telah siap untuk dibayar.</p>
          <p><strong>Nomor Invoice:</strong> ${invoiceId}</p>
          <p><strong>Total:</strong> Rp ${total.toLocaleString("id-ID")}</p>
          <a href="${paymentUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Bayar Sekarang</a>
          <p style="color: #6b7280; font-size: 14px;">Tautan ini berlaku untuk 24 jam. Jika Anda memiliki pertanyaan, silakan hubungi kami lewat WhatsApp.</p>
          <br />
          <p style="color: #6b7280; font-size: 14px;">Salam,<br />Tim Article</p>
        </div>
      </body>
      </html>
    `,
    text: `Halo ${customerName}, Tagihan #${invoiceId} sebesar Rp ${total.toLocaleString("id-ID")} siap dibayar. Silakan kunjungi ${paymentUrl}`,
  };
}

export function paymentSuccessEmail({
  customerName,
  invoiceId,
  total,
}: {
  customerName: string;
  invoiceId: string;
  total: number;
}) {
  return {
    subject: `Pembayaran Berhasil - Invoice #${invoiceId} - Article`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">Article</h1>
          <p>Halo <strong>${customerName}</strong>,</p>
          <p>Pembayaran untuk invoice <strong>#${invoiceId}</strong> sebesar Rp ${total.toLocaleString("id-ID")} telah kami terima.</p>
          <p>Tim kami akan segera mengonfirmasi jadwal pemotretan Anda.</p>
          <br />
          <p style="color: #6b7280; font-size: 14px;">Salam,<br />Tim Article</p>
        </div>
      </body>
      </html>
    `,
    text: `Halo ${customerName}, Pembayaran invoice #${invoiceId} sebesar Rp ${total.toLocaleString("id-ID")} telah diterima.`,
  };
}
