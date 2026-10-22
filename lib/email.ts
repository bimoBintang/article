import { getEmailConfig } from "./email-settings";

// Template email dipindah ke email-templates.ts (murni, dipakai juga untuk
// pratinjau di admin). Nama lama tetap diekspor dari sini.
export {
  requestConfirmationEmail,
  adminNewRequestEmail,
  paymentConfirmationEmail,
  paymentSuccessEmail,
} from "./email-templates";
export { getEmailBrand } from "./email-settings";

/** Alamat API Resend; bisa ditimpa lewat env untuk uji lokal dengan server tiruan. */
export function resendBase(): string {
  return (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/+$/, "");
}

/**
 * Log cadangan saat email tidak terkirim. Di production alamat disamarkan dan isi
 * email tidak dicetak, supaya log server tidak menyimpan data pribadi pelanggan.
 */
function logFallback(recipients: string[], subject: string, text?: string) {
  if (process.env.NODE_ENV === "production") {
    const masked = recipients.map((r) => r.replace(/^(.).*(@.*)$/, "$1***$2")).join(", ");
    console.log(`[EMAIL FALLBACK] To: ${masked} | Subject: ${subject}`);
    return;
  }
  console.log(`[EMAIL FALLBACK] To: ${recipients.join(", ")}\nSubject: ${subject}\nText: ${text || ""}`);
}

export type DeliverResult =
  | { ok: true; provider: "resend" | "fallback" }
  | { ok: false; provider: "resend"; error: string };

/**
 * Kirim lewat Resend dan laporkan hasilnya apa adanya (dipakai email uji di
 * halaman admin). Tanpa API key, email hanya dicatat di log server.
 */
export async function deliverEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<DeliverResult> {
  const config = await getEmailConfig();
  const recipients = Array.isArray(to) ? to : [to];

  if (!config.apiKey) {
    logFallback(recipients, subject, text);
    return { ok: true, provider: "fallback" };
  }

  const from = config.fromName
    ? `${config.fromName} <${config.fromAddress}>`
    : config.fromAddress;

  try {
    const response = await fetch(`${resendBase()}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Resend error:", response.status, body);
      let message = `Resend menolak (${response.status})`;
      try {
        const detail = JSON.parse(body)?.message;
        if (typeof detail === "string") message += `: ${detail}`;
      } catch {
        // isi bukan JSON
      }
      return { ok: false, provider: "resend", error: message };
    }
    return { ok: true, provider: "resend" };
  } catch (err) {
    console.error("Resend send failed:", err);
    return { ok: false, provider: "resend", error: "Tidak dapat menghubungi Resend" };
  }
}

/**
 * Kirim email transaksional. Kegagalan hanya dicatat; alur utama (mis.
 * pengiriman permintaan) tidak boleh gagal hanya karena email tidak terkirim.
 */
export async function sendEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const result = await deliverEmail(args);
  if (!result.ok) {
    logFallback(Array.isArray(args.to) ? args.to : [args.to], args.subject, args.text);
    return { success: true, provider: "fallback" };
  }
  return { success: true, provider: result.provider };
}
