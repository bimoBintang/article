/**
 * Metode pembayaran Midtrans Core API yang ditawarkan di halaman bayar.
 * Data murni (tanpa env/DB) supaya dipakai server dan klien. Menambah metode
 * baru (mis. Mandiri Bill) cukup menambah satu entri di sini dan satu cabang
 * di `buildChargeBody` (lib/midtrans.ts).
 */
export type PaymentMethodId =
  | "bca"
  | "bni"
  | "bri"
  | "permata"
  | "cimb"
  | "qris"
  | "gopay";

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  group: "va" | "ewallet";
  kind: "va" | "qris" | "gopay";
  /** Kode bank untuk Virtual Account */
  bank?: string;
};

export const PAYMENT_GROUPS = [
  { id: "va", label: "Virtual Account" },
  { id: "ewallet", label: "QRIS dan dompet digital" },
] as const;

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { id: "bca", label: "BCA", group: "va", kind: "va", bank: "bca" },
  { id: "bni", label: "BNI", group: "va", kind: "va", bank: "bni" },
  { id: "bri", label: "BRI", group: "va", kind: "va", bank: "bri" },
  { id: "permata", label: "Permata", group: "va", kind: "va", bank: "permata" },
  { id: "cimb", label: "CIMB Niaga", group: "va", kind: "va", bank: "cimb" },
  { id: "qris", label: "QRIS", group: "ewallet", kind: "qris" },
  { id: "gopay", label: "GoPay", group: "ewallet", kind: "gopay" },
];

export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id) as [
  PaymentMethodId,
  ...PaymentMethodId[],
];

export function getPaymentMethod(id: string | null | undefined): PaymentMethod | null {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? null;
}

export function paymentMethodLabel(id: string | null | undefined): string {
  const method = getPaymentMethod(id);
  if (!method) return id || "-";
  return method.kind === "va" ? `${method.label} Virtual Account` : method.label;
}
