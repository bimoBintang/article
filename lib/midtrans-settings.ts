import { query } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-box";
import { PAYMENT_METHODS, type PaymentMethodId } from "./payment-methods";

/**
 * Konfigurasi Midtrans yang diatur admin lewat halaman Midtrans.
 *
 * Disimpan di tabel `settings` (key-value); Server Key disimpan terenkripsi
 * (lihat secret-box.ts). Nilai yang kosong di database jatuh ke variabel
 * lingkungan lama (MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION) supaya
 * instalasi yang sudah berjalan tetap bekerja.
 */
const KEY_SERVER = "midtrans_server_key_enc";
const KEY_PRODUCTION = "midtrans_is_production";
const KEY_METHODS = "midtrans_enabled_methods";
const KEY_EXPIRY = "midtrans_expiry_hours";

export const DEFAULT_EXPIRY_HOURS = 24;
export const MIN_EXPIRY_HOURS = 1;
export const MAX_EXPIRY_HOURS = 72;

export const ALL_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id);

/** Server Key sandbox berawalan "SB-Mid-server-", produksi "Mid-server-". */
export const SERVER_KEY_PATTERN = /^(SB-)?Mid-server-\S+$/;

/** Nilai contoh dari .env.example dianggap belum diisi. */
export function isPlaceholderKey(key: string | null | undefined): boolean {
  return !key || /your-(sandbox-|production-)?server-key/i.test(key);
}

export type MidtransConfig = {
  serverKey: string | null;
  serverKeySource: "database" | "env" | "none";
  isProduction: boolean;
  enabledMethods: PaymentMethodId[];
  expiryHours: number;
};

/** Bentuk yang aman dikirim ke browser: tanpa Server Key utuh. */
export type MidtransConfigPublic = Omit<MidtransConfig, "serverKey"> & {
  hasKey: boolean;
  maskedKey: string | null;
  /** Mode yang ditunjukkan awalan key; null bila tidak dikenali */
  keyMode: "sandbox" | "production" | null;
  placeholderKey: boolean;
  /** Alamat API yang dipakai untuk mode saat ini */
  endpoint: string;
};

/** Alamat API; MIDTRANS_API_BASE menimpa untuk uji lokal dengan server tiruan. */
export function endpointFor(isProduction: boolean): string {
  const custom = process.env.MIDTRANS_API_BASE?.trim();
  if (custom) return custom.replace(/\/+$/, "");
  return isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

export function keyModeOf(key: string | null | undefined): "sandbox" | "production" | null {
  if (!key) return null;
  if (key.startsWith("SB-Mid-server-")) return "sandbox";
  if (key.startsWith("Mid-server-")) return "production";
  return null;
}

async function readRows(): Promise<Map<string, string | null>> {
  try {
    const rows = await query<{ key: string; value: string | null }>(
      `SELECT key, value FROM settings WHERE key LIKE 'midtrans\\_%'`
    );
    return new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    // Database belum siap: pakai variabel lingkungan saja
    return new Map();
  }
}

export async function getMidtransConfig(): Promise<MidtransConfig> {
  const map = await readRows();

  const dbKey = decryptSecret(map.get(KEY_SERVER));
  const envKey = process.env.MIDTRANS_SERVER_KEY?.trim() || null;

  const prod = map.get(KEY_PRODUCTION);
  const isProduction =
    prod === "true" || prod === "false" ? prod === "true" : process.env.MIDTRANS_IS_PRODUCTION === "true";

  const listed = (map.get(KEY_METHODS) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PaymentMethodId => (ALL_METHOD_IDS as string[]).includes(s));

  const hours = Number(map.get(KEY_EXPIRY));
  const expiryHours =
    Number.isInteger(hours) && hours >= MIN_EXPIRY_HOURS && hours <= MAX_EXPIRY_HOURS
      ? hours
      : DEFAULT_EXPIRY_HOURS;

  return {
    serverKey: dbKey ?? envKey,
    serverKeySource: dbKey ? "database" : envKey ? "env" : "none",
    isProduction,
    // Belum pernah diatur (atau isinya rusak) berarti semua metode aktif
    enabledMethods: listed.length > 0 ? listed : [...ALL_METHOD_IDS],
    expiryHours,
  };
}

export async function getMidtransConfigPublic(): Promise<MidtransConfigPublic> {
  const { serverKey, ...rest } = await getMidtransConfig();
  return {
    ...rest,
    hasKey: serverKey !== null,
    maskedKey: serverKey ? maskSecret(serverKey) : null,
    keyMode: keyModeOf(serverKey),
    placeholderKey: serverKey !== null && isPlaceholderKey(serverKey),
    endpoint: endpointFor(rest.isProduction),
  };
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

export type MidtransConfigInput = {
  /** Kosong/undefined = jangan ubah key yang tersimpan */
  serverKey?: string;
  clearServerKey?: boolean;
  isProduction: boolean;
  enabledMethods: PaymentMethodId[];
  expiryHours: number;
};

export async function saveMidtransConfig(input: MidtransConfigInput): Promise<void> {
  if (input.clearServerKey) {
    await query(`DELETE FROM settings WHERE key = $1`, [KEY_SERVER]);
  } else if (input.serverKey && input.serverKey.trim()) {
    await upsert(KEY_SERVER, encryptSecret(input.serverKey.trim()));
  }

  await Promise.all([
    upsert(KEY_PRODUCTION, input.isProduction ? "true" : "false"),
    upsert(KEY_METHODS, input.enabledMethods.join(",")),
    upsert(KEY_EXPIRY, String(input.expiryHours)),
  ]);
}
