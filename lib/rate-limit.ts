import { query } from "./db";

/**
 * Dua pembatas laju:
 * - `rateLimited`: di memori proses. Cepat dan tanpa database, cocok untuk jalur
 *   berfrekuensi tinggi (polling); sifatnya per instance dan hilang saat restart.
 * - `rateLimitedShared`: tersimpan di database. Berlaku lintas instance dan restart,
 *   dipakai untuk jalur yang rawan disalahgunakan (login, formulir, unggah, charge).
 */
const buckets = new Map<string, number[]>();

/** true bila kunci sudah melewati `max` pemanggilan dalam `windowMs` terakhir. */
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return recent.length > max;
}

/**
 * Pembatas laju bersama lewat tabel `rate_limits` (jendela tetap). Satu pernyataan
 * atomik menaikkan hitungan atau memulai jendela baru bila yang lama sudah lewat,
 * sehingga permintaan paralel tidak bisa melewati batas. Bila database bermasalah,
 * jatuh ke pembatas memori (gagal-buka) agar pengguna sah tidak ikut terblokir.
 */
export async function rateLimitedShared(key: string, max: number, windowMs: number): Promise<boolean> {
  const safeKey = key.slice(0, 200);
  try {
    const rows = await query<{ count: number }>(
      `INSERT INTO rate_limits (key, count, window_start)
       VALUES ($1, 1, NOW())
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start <= NOW() - INTERVAL '1 millisecond' * $2::int
                      THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start <= NOW() - INTERVAL '1 millisecond' * $2::int
                             THEN NOW() ELSE rate_limits.window_start END
       RETURNING count`,
      [safeKey, windowMs]
    );

    // Bersihkan jendela lama sesekali agar tabel tidak membesar
    if (Math.random() < 0.01) {
      query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'`).catch(() => {});
    }
    return Number(rows[0]?.count ?? 0) > max;
  } catch (err) {
    console.error("Rate limit store error, memakai pembatas memori:", err);
    return rateLimited(safeKey, max, windowMs);
  }
}
