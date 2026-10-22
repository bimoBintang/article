/**
 * Template email HTML. Murni (tanpa env/DB) supaya bisa dipakai di server
 * untuk pengiriman dan di browser untuk pratinjau di halaman admin Email.
 *
 * Tata letaknya berbasis tabel dengan CSS inline karena klien email
 * (Gmail, Outlook) tidak mengandalkan flex/grid atau <style>. Gayanya
 * mengikuti situs: monokrom, judul tebal, kicker huruf kapital kecil.
 */

export type EmailBrand = {
  name: string;
  /** Warna tombol, format #rrggbb */
  accent: string;
  /** Catatan kecil di footer (jam layanan, dsb.) */
  footerNote: string;
};

export const DEFAULT_EMAIL_BRAND: EmailBrand = {
  name: "Article",
  accent: "#0a0a0a",
  footerNote: "Senin–Jumat, jam kerja. Invoice dikirim lewat email.",
};

const INSTAGRAM_URL = "https://www.instagram.com/article.ppercent_/";
const INSTAGRAM_LABEL = "@article.ppercent_";

export type EmailItem = {
  product?: string | null;
  package?: string | null;
  model?: string | null;
  quantity: number;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Escape HTML untuk teks dari pengguna (nama, catatan model, dsb.) yang disisipkan
 * ke badan email HTML, supaya tidak bisa menyuntikkan tag atau tautan.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Terima hanya #rrggbb; selain itu jatuh ke warna bawaan. */
export function sanitizeAccent(value: string | null | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : DEFAULT_EMAIL_BRAND.accent;
}

/** Teks tombol hitam atau putih, mana yang lebih terbaca di atas warna aksen. */
function onAccent(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#0a0a0a" : "#ffffff";
}

function rupiah(total: number): string {
  return total > 0 ? `Rp ${total.toLocaleString("id-ID")}` : "Dikonfirmasi admin";
}

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function normalizeBrand(brand?: Partial<EmailBrand>): EmailBrand {
  return {
    name: brand?.name?.trim() || DEFAULT_EMAIL_BRAND.name,
    accent: sanitizeAccent(brand?.accent),
    footerNote: brand?.footerNote?.trim() ?? DEFAULT_EMAIL_BRAND.footerNote,
  };
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#404040;">${html}</p>`;
}

/** Baris ringkasan "label ... nilai" dengan garis tipis di antaranya. */
function summary(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding:12px 0;${i > 0 ? "border-top:1px solid #e5e5e5;" : ""}font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#737373;">${label}</td>
          <td align="right" style="padding:12px 0;${i > 0 ? "border-top:1px solid #e5e5e5;" : ""}font-size:15px;font-weight:700;color:#0a0a0a;">${value}</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:2px solid #0a0a0a;border-bottom:1px solid #e5e5e5;">${cells}</table>`;
}

function itemsTable(items: EmailItem[]): string {
  const th = (text: string, align = "left") =>
    `<th align="${align}" style="padding:10px 8px 10px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#737373;border-bottom:1px solid #0a0a0a;">${text}</th>`;
  const td = (html: string, align = "left") =>
    `<td align="${align}" valign="top" style="padding:12px 8px 12px 0;font-size:14px;line-height:1.5;color:#0a0a0a;border-bottom:1px solid #e5e5e5;">${html}</td>`;
  const rows = items
    .map(
      (item) =>
        `<tr>${td(`<strong>${escapeHtml(item.product || "-")}</strong>`)}${td(
          escapeHtml(item.package || "-")
        )}${td(escapeHtml(item.model || "-"))}${td(String(item.quantity), "center")}</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;border-collapse:collapse;">
    <thead><tr>${th("Produk")}${th("Paket")}${th("Model")}${th("Jml", "center")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function button(brand: EmailBrand, href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td bgcolor="${brand.accent}" style="background:${brand.accent};">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:14px;font-weight:700;color:${onAccent(brand.accent)};text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
}

/** Kerangka semua email: header wordmark, judul, isi, footer. */
function layout({
  brand,
  preheader,
  kicker,
  title,
  body,
}: {
  brand: EmailBrand;
  preheader: string;
  kicker: string;
  title: string;
  body: string;
}): string {
  const name = escapeHtml(brand.name);
  const note = brand.footerNote
    ? `<p style="margin:0 0 6px;">${escapeHtml(brand.footerNote)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e2e2;">
      <tr><td style="padding:28px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#0a0a0a;">${name}</td>
          <td align="right" style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#737373;">${escapeHtml(kicker)}</td>
        </tr></table>
        <div style="margin-top:20px;border-top:2px solid #0a0a0a;font-size:0;line-height:0;">&nbsp;</div>
      </td></tr>
      <tr><td style="padding:12px 32px 32px;">
        <h1 style="margin:16px 0 20px;font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-0.03em;color:#0a0a0a;">${escapeHtml(title)}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:20px 32px 28px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.6;color:#737373;">
        ${note}
        <p style="margin:0 0 6px;">Instagram <a href="${INSTAGRAM_URL}" style="color:#0a0a0a;">${INSTAGRAM_LABEL}</a></p>
        <p style="margin:0;">&copy; ${new Date().getFullYear()} ${name}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function requestConfirmationEmail({
  customerName,
  requestNumber,
  items,
  total,
  brief,
  brand,
}: {
  customerName: string;
  requestNumber: string;
  items: EmailItem[];
  total: number;
  /** Ringkasan brief untuk permintaan Customize */
  brief?: { title: string; description?: string | null } | null;
  brand?: Partial<EmailBrand>;
}): RenderedEmail {
  const b = normalizeBrand(brand);
  const briefBlock = brief
    ? `<div style="margin:8px 0 16px;padding:14px 16px;background:#f5f5f5;font-size:14px;line-height:1.6;color:#404040;"><strong style="color:#0a0a0a;">Brief: ${escapeHtml(
        brief.title
      )}</strong>${brief.description ? `<br>${escapeHtml(brief.description)}` : ""}</div>`
    : "";
  return {
    subject: `Konfirmasi Permintaan Pemotretan #${requestNumber} - ${b.name}`,
    html: layout({
      brand: b,
      preheader: `Permintaan #${requestNumber} sudah kami terima.`,
      kicker: "Konfirmasi",
      title: "Permintaan Anda sudah kami terima.",
      body:
        paragraph(`Halo <strong>${escapeHtml(customerName)}</strong>, terima kasih sudah mengirim permintaan pemotretan lewat ${escapeHtml(b.name)}.`) +
        summary([
          ["Nomor permintaan", escapeHtml(requestNumber)],
          ["Total estimasi", rupiah(total)],
        ]) +
        briefBlock +
        itemsTable(items) +
        paragraph(
          "Tim kami akan meninjau permintaan Anda, lalu menghubungi lewat email atau WhatsApp untuk jadwal dan rincian biaya."
        ) +
        `<p style="margin:0;font-size:14px;color:#737373;">Salam,<br>Tim ${escapeHtml(b.name)}</p>`,
    }),
    text: `Halo ${customerName}, terima kasih telah mengirim permintaan pemotretan fashion melalui ${b.name}. Nomor Permintaan: ${requestNumber}. Total estimasi: ${rupiah(total)}. Tim kami akan segera menghubungi Anda.`,
  };
}

export function adminNewRequestEmail({
  requestNumber,
  customerName,
  items,
  total,
  dashboardUrl,
  brand,
}: {
  /** Tidak dipakai di isi email; dipertahankan agar pemanggil lama tetap valid */
  adminEmail?: string;
  requestNumber: string;
  customerName: string;
  items: EmailItem[];
  total: number;
  dashboardUrl: string;
  brand?: Partial<EmailBrand>;
}): RenderedEmail {
  const b = normalizeBrand(brand);
  return {
    subject: `Permintaan Pemotretan Baru #${requestNumber} - ${b.name}`,
    html: layout({
      brand: b,
      preheader: `${customerName} mengirim permintaan #${requestNumber}.`,
      kicker: "Notifikasi admin",
      title: "Permintaan pemotretan baru masuk.",
      body:
        summary([
          ["Nomor permintaan", escapeHtml(requestNumber)],
          ["Pelanggan", escapeHtml(customerName)],
          ["Total estimasi", rupiah(total)],
        ]) +
        itemsTable(items) +
        button(b, dashboardUrl, "Buka di dashboard"),
    }),
    text: `Permintaan pemotretan baru #${requestNumber} dari ${customerName}. Total estimasi: ${rupiah(total)}. Lihat detail di ${dashboardUrl}`,
  };
}

export function paymentConfirmationEmail({
  customerName,
  invoiceId,
  total,
  paymentUrl,
  brand,
}: {
  customerName: string;
  invoiceId: string;
  total: number;
  paymentUrl: string;
  brand?: Partial<EmailBrand>;
}): RenderedEmail {
  const b = normalizeBrand(brand);
  return {
    subject: `Tautan Pembayaran Invoice #${invoiceId} - ${b.name}`,
    html: layout({
      brand: b,
      preheader: `Invoice #${invoiceId} siap dibayar.`,
      kicker: "Invoice",
      title: "Tagihan pemotretan Anda siap dibayar.",
      body:
        paragraph(`Halo <strong>${escapeHtml(customerName)}</strong>, invoice untuk pemotretan Anda sudah terbit. Buka tautan di bawah untuk memilih metode pembayaran (Virtual Account bank, QRIS, atau GoPay).`) +
        summary([
          ["Nomor invoice", escapeHtml(invoiceId)],
          ["Total", `Rp ${total.toLocaleString("id-ID")}`],
        ]) +
        button(b, paymentUrl, "Bayar sekarang") +
        `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#737373;">Tautan ini khusus untuk Anda, jangan dibagikan. Ada pertanyaan? Hubungi kami lewat WhatsApp.</p>`,
    }),
    text: `Halo ${customerName}, Tagihan #${invoiceId} sebesar Rp ${total.toLocaleString("id-ID")} siap dibayar. Silakan kunjungi ${paymentUrl}`,
  };
}

export function paymentSuccessEmail({
  customerName,
  invoiceId,
  total,
  brand,
}: {
  customerName: string;
  invoiceId: string;
  total: number;
  brand?: Partial<EmailBrand>;
}): RenderedEmail {
  const b = normalizeBrand(brand);
  return {
    subject: `Pembayaran Berhasil - Invoice #${invoiceId} - ${b.name}`,
    html: layout({
      brand: b,
      preheader: `Pembayaran invoice #${invoiceId} sudah kami terima.`,
      kicker: "Pembayaran",
      title: "Pembayaran Anda sudah kami terima.",
      body:
        paragraph(`Halo <strong>${escapeHtml(customerName)}</strong>, terima kasih. Pembayaran Anda sudah masuk.`) +
        summary([
          ["Nomor invoice", escapeHtml(invoiceId)],
          ["Total dibayar", `Rp ${total.toLocaleString("id-ID")}`],
        ]) +
        paragraph("Tim kami akan segera mengonfirmasi jadwal pemotretan Anda.") +
        `<p style="margin:0;font-size:14px;color:#737373;">Salam,<br>Tim ${escapeHtml(b.name)}</p>`,
    }),
    text: `Halo ${customerName}, Pembayaran invoice #${invoiceId} sebesar Rp ${total.toLocaleString("id-ID")} telah diterima.`,
  };
}

export const EMAIL_TEMPLATE_KEYS = [
  "confirmation",
  "admin",
  "payment-link",
  "payment-success",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  confirmation: "Konfirmasi permintaan",
  admin: "Notifikasi admin",
  "payment-link": "Tautan bayar",
  "payment-success": "Pembayaran berhasil",
};

/** Contoh email lengkap dengan data tiruan, untuk pratinjau dan email uji. */
export function sampleEmail(
  key: EmailTemplateKey,
  brand?: Partial<EmailBrand>
): RenderedEmail {
  const items: EmailItem[] = [
    { product: "Kemeja Linen Oversize", package: "Standard", model: "Perempuan", quantity: 1 },
    { product: "Tote Bag Kanvas", package: "Sesuai kebutuhan (2 look, 20 foto)", model: "Laki-laki · Catatan: tampilan kasual", quantity: 2 },
  ];
  switch (key) {
    case "confirmation":
      return requestConfirmationEmail({
        customerName: "Contoh Pelanggan",
        requestNumber: "REQ-000000",
        items,
        total: 1700000,
        brand,
      });
    case "admin":
      return adminNewRequestEmail({
        requestNumber: "REQ-000000",
        customerName: "Contoh Pelanggan",
        items,
        total: 1700000,
        dashboardUrl: "https://contoh.id/admin/requests",
        brand,
      });
    case "payment-link":
      return paymentConfirmationEmail({
        customerName: "Contoh Pelanggan",
        invoiceId: "INV-000000",
        total: 1700000,
        paymentUrl: "https://contoh.id/bayar/INV-000000",
        brand,
      });
    case "payment-success":
      return paymentSuccessEmail({
        customerName: "Contoh Pelanggan",
        invoiceId: "INV-000000",
        total: 1700000,
        brand,
      });
  }
}
