import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Enkripsi kolom data pribadi (nama, email, WhatsApp, catatan pelanggan) di
 * tabel `requests`. AES-256-GCM dengan kunci dari PII_ENCRYPTION_KEY yang
 * terpisah dari SESSION_PASSWORD, jadi mengganti sandi sesi tidak membuat
 * data tak terbaca. Nama kolom dipakai sebagai AAD: ciphertext yang dipindah
 * ke kolom lain gagal didekripsi.
 *
 * Format simpanan: "pii:v1:<iv>:<tag>:<data>" (base64url). Nilai tanpa
 * awalan dianggap data lama berupa teks biasa dan dikembalikan apa adanya,
 * sehingga baris lama dan baru bisa hidup berdampingan.
 */
const PREFIX = "pii:v1:";

/** Pengganti saat data terenkripsi tidak bisa dibuka (kunci salah/hilang atau data rusak). */
export const UNREADABLE = "[tidak dapat didekripsi]";

function getKey(): Buffer {
  const secret = process.env.PII_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("PII_ENCRYPTION_KEY belum diatur (minimal 16 karakter)");
  }
  return createHash("sha256").update(`ekatalog-pii:${secret}`).digest();
}

/** Enkripsi satu nilai. null/kosong tetap null supaya kolom opsional tidak berubah arti. */
export function encryptPii(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(field));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url"));
  return PREFIX + parts.join(":");
}

export function isEncryptedPii(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Buka satu nilai; teks biasa (data lama) dikembalikan apa adanya. */
export function decryptPii(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncryptedPii(value)) return value;
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(":");
    if (!iv || !tag || !data) return UNREADABLE;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(field));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return UNREADABLE;
  }
}

/** Kolom `requests` yang disimpan terenkripsi. */
export const REQUEST_PII_FIELDS = [
  "customer_name",
  "customer_email",
  "customer_whatsapp",
  "notes",
] as const;

/**
 * Salinan baris dengan kolom-kolom tertentu didekripsi. Kolom yang tidak ada
 * di baris dilewati, jadi aman dipakai untuk SELECT yang hanya mengambil sebagian.
 */
export function decryptFields<T extends object>(
  row: T,
  fields: readonly string[] = REQUEST_PII_FIELDS
): T {
  const out = { ...row } as Record<string, unknown>;
  for (const f of fields) {
    const value = out[f];
    if (typeof value === "string" || value === null) out[f] = decryptPii(value, f);
  }
  return out as T;
}
