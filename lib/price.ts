/**
 * Format tampilan harga sesuai pengaturan admin.
 *
 * Saat harga dimatikan di Pengaturan, nominal disembunyikan dan diganti
 * ajakan untuk menghubungi admin.
 */

export const HIDDEN_PRICE_LABEL = "Hubungi Kami";

/** Teks harga untuk ditampilkan (atau "—" saat disembunyikan). */
export function displayPrice(
  amount: number | null | undefined,
  show: boolean
): string {
  if (!show) return HIDDEN_PRICE_LABEL;
  if (!amount) return HIDDEN_PRICE_LABEL;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/** Teks harga ringkas untuk tabel admin (kosong saat disembunyikan). */
export function displayAdminPrice(
  amount: number | null | undefined,
  show: boolean
): string {
  if (!show) return "—";
  if (!amount) return "-";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
