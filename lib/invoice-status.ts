import type { InvoiceStatus } from "@/types";

/** Label dan warna badge status invoice (admin dan halaman bayar). */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "Menunggu pembayaran",
  PAID: "Lunas",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
  REFUNDED: "Dikembalikan",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  FAILED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  CANCELLED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  EXPIRED: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  REFUNDED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
};

/** Batas nominal invoice (dipakai formulir admin dan validasi server). */
export const MIN_INVOICE_TOTAL = 1_000;
export const MAX_INVOICE_TOTAL = 2_000_000_000;

export function rupiah(n: number | string | null | undefined): string {
  return `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
}
