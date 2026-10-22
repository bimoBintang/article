import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Enkripsi sederhana untuk rahasia yang disimpan di database (mis. API key Resend).
 *
 * AES-256-GCM dengan kunci turunan dari SESSION_PASSWORD, jadi isi tabel
 * `settings` saja tidak cukup untuk membaca rahasianya. Format simpanan:
 * "v1:<iv>:<tag>:<data>" (base64). Bila SESSION_PASSWORD diganti, nilai lama
 * tidak bisa dibuka lagi dan `decryptSecret` mengembalikan null.
 */
function getKey(): Buffer {
  const password = process.env.SESSION_PASSWORD;
  if (!password) throw new Error("SESSION_PASSWORD belum diatur");
  return createHash("sha256").update(`ekatalog-secret-box:${password}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(boxed: string | null | undefined): string | null {
  if (!boxed) return null;
  try {
    const [version, iv, tag, data] = boxed.split(":");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Bentuk tersamar untuk ditampilkan di UI, mis. "re_••••3f9a". */
export function maskSecret(secret: string): string {
  const head = secret.startsWith("re_") ? "re_" : "";
  return `${head}••••${secret.slice(-4)}`;
}
