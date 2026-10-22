import { query, queryOne } from "./db";
import {
  DEFAULT_HERO_TEMPLATE,
  isHeroTemplateId,
  type HeroTemplateId,
} from "./hero-templates";

/**
 * Pengaturan tampilan aplikasi.
 *
 * Disimpan sebagai key-value di tabel `settings` supaya admin bisa
 * menyalakan/mematikan tampilan harga lewat halaman Pengaturan.
 */
export type PublicSettings = {
  /** Tampilkan harga dasar produk (products.base_price) */
  show_product_price: boolean;
  /** Tampilkan harga paket pemotretan (packages.base_price) */
  show_package_price: boolean;
  /** Tampilkan tarif tambahan model/talent (talents.additional_fee) */
  show_additional_fee: boolean;
};

export const SETTING_KEYS: (keyof PublicSettings)[] = [
  "show_product_price",
  "show_package_price",
  "show_additional_fee",
];

export const DEFAULT_SETTINGS: PublicSettings = {
  show_product_price: true,
  show_package_price: true,
  show_additional_fee: true,
};

/** Ubah nilai string dari database menjadi boolean. */
function toBool(value: string | null | undefined, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return fallback;
}

/**
 * Ambil semua pengaturan tampilan.
 * Nilai yang hilang di database akan memakai default.
 */
export async function getSettings(): Promise<PublicSettings> {
  try {
    const rows = await query<{ key: string; value: string | null }>(
      `SELECT key, value FROM settings`
    );

    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      show_product_price: toBool(
        map.get("show_product_price"),
        DEFAULT_SETTINGS.show_product_price
      ),
      show_package_price: toBool(
        map.get("show_package_price"),
        DEFAULT_SETTINGS.show_package_price
      ),
      show_additional_fee: toBool(
        map.get("show_additional_fee"),
        DEFAULT_SETTINGS.show_additional_fee
      ),
    };
  } catch {
    // Tabel belum ada / database belum siap -> pakai default
    return { ...DEFAULT_SETTINGS };
  }
}

/** Simpan (upsert) satu nilai pengaturan. */
export async function setSetting(
  key: string,
  value: boolean
): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value ? "true" : "false"]
  );
}

/** Ambil satu nilai pengaturan dengan fallback ke default. */
export async function getSetting(
  key: keyof PublicSettings
): Promise<boolean> {
  const row = await queryOne<{ value: string | null }>(
    `SELECT value FROM settings WHERE key = $1`,
    [key]
  );
  return toBool(row?.value, DEFAULT_SETTINGS[key]);
}

/** Kunci pengaturan template hero (disimpan sebagai teks id template). */
const HERO_TEMPLATE_KEY = "hero_visual_template";

/**
 * Template hero yang aktif. Jatuh ke bawaan bila belum pernah dipilih,
 * nilainya tidak dikenal (mis. template sudah dihapus dari kode), atau
 * database belum siap, supaya beranda tidak pernah rusak karena ini.
 */
export async function getHeroTemplate(): Promise<HeroTemplateId> {
  try {
    const row = await queryOne<{ value: string | null }>(
      `SELECT value FROM settings WHERE key = $1`,
      [HERO_TEMPLATE_KEY]
    );
    return isHeroTemplateId(row?.value) ? row.value : DEFAULT_HERO_TEMPLATE;
  } catch {
    return DEFAULT_HERO_TEMPLATE;
  }
}

/** Simpan (upsert) template hero yang dipilih admin. */
export async function setHeroTemplate(id: HeroTemplateId): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [HERO_TEMPLATE_KEY, id]
  );
}
