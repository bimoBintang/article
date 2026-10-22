import { query } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-box";
import {
  DEFAULT_EMAIL_BRAND,
  sanitizeAccent,
  type EmailBrand,
} from "./email-templates";

/**
 * Konfigurasi email (Resend) yang diatur admin lewat halaman Email.
 *
 * Disimpan di tabel `settings` (key-value). API key disimpan terenkripsi
 * (lihat secret-box.ts). Nilai yang kosong di database jatuh ke variabel
 * lingkungan lama (RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL) supaya
 * instalasi yang sudah berjalan tetap bekerja.
 */
const KEY_API = "resend_api_key_enc";
const TEXT_KEYS = [
  "email_from_name",
  "email_from_address",
  "email_reply_to",
  "email_admin_recipients",
  "email_brand_name",
  "email_accent",
  "email_footer_note",
] as const;
type TextKey = (typeof TEXT_KEYS)[number];

export type EmailConfig = {
  apiKey: string | null;
  apiKeySource: "database" | "env" | "none";
  fromName: string;
  fromAddress: string;
  replyTo: string;
  adminRecipients: string[];
  brand: EmailBrand;
};

/** Bentuk yang aman dikirim ke browser: tanpa API key utuh. */
export type EmailConfigPublic = Omit<EmailConfig, "apiKey"> & {
  hasKey: boolean;
  maskedKey: string | null;
};

const FALLBACK_FROM = "noreply@ekatalog.local";
const FALLBACK_ADMIN = "admin@ekatalog.local";

async function readRows(): Promise<Map<string, string | null>> {
  try {
    const rows = await query<{ key: string; value: string | null }>(
      `SELECT key, value FROM settings WHERE key = $1 OR key LIKE 'email\\_%'`,
      [KEY_API]
    );
    return new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    // Database belum siap: pakai variabel lingkungan saja
    return new Map();
  }
}

/** Pisahkan daftar email (koma/titik koma/spasi/baris baru) dan buang yang tidak valid. */
export function parseRecipients(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter((v) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v));
}

/** Nama pengirim tidak boleh memuat karakter yang merusak header From. */
function cleanName(value: string): string {
  return value.replace(/[<>"\r\n,;]/g, "").trim();
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const map = await readRows();
  const text = (key: TextKey) => (map.get(key) ?? "").trim();

  const dbKey = decryptSecret(map.get(KEY_API));
  const envKey = process.env.RESEND_API_KEY?.trim() || null;

  const recipients = parseRecipients(text("email_admin_recipients"));
  const envAdmin = parseRecipients(process.env.ADMIN_EMAIL);

  return {
    apiKey: dbKey ?? envKey,
    apiKeySource: dbKey ? "database" : envKey ? "env" : "none",
    fromName: cleanName(text("email_from_name")),
    fromAddress: text("email_from_address") || process.env.FROM_EMAIL?.trim() || FALLBACK_FROM,
    replyTo: text("email_reply_to"),
    adminRecipients:
      recipients.length > 0 ? recipients : envAdmin.length > 0 ? envAdmin : [FALLBACK_ADMIN],
    brand: {
      name: text("email_brand_name") || DEFAULT_EMAIL_BRAND.name,
      accent: sanitizeAccent(text("email_accent")),
      // string kosong yang disimpan sengaja berarti "tanpa catatan footer"
      footerNote: map.has("email_footer_note")
        ? text("email_footer_note")
        : DEFAULT_EMAIL_BRAND.footerNote,
    },
  };
}

/** Hanya tampilan/branding; dipakai pemanggil template. */
export async function getEmailBrand(): Promise<EmailBrand> {
  return (await getEmailConfig()).brand;
}

export async function getEmailConfigPublic(): Promise<EmailConfigPublic> {
  const { apiKey, ...rest } = await getEmailConfig();
  return { ...rest, hasKey: apiKey !== null, maskedKey: apiKey ? maskSecret(apiKey) : null };
}

async function upsert(key: string, value: string) {
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

export type EmailConfigInput = {
  /** Kosong/undefined = jangan ubah key yang tersimpan */
  apiKey?: string;
  clearApiKey?: boolean;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  adminRecipients: string;
  brandName: string;
  accent: string;
  footerNote: string;
};

export async function saveEmailConfig(input: EmailConfigInput): Promise<void> {
  if (input.clearApiKey) {
    await query(`DELETE FROM settings WHERE key = $1`, [KEY_API]);
  } else if (input.apiKey && input.apiKey.trim()) {
    await upsert(KEY_API, encryptSecret(input.apiKey.trim()));
  }

  await Promise.all([
    upsert("email_from_name", cleanName(input.fromName)),
    upsert("email_from_address", input.fromAddress.trim()),
    upsert("email_reply_to", input.replyTo.trim()),
    upsert("email_admin_recipients", parseRecipients(input.adminRecipients).join(", ")),
    upsert("email_brand_name", input.brandName.trim()),
    upsert("email_accent", sanitizeAccent(input.accent)),
    upsert("email_footer_note", input.footerNote.trim()),
  ]);
}
