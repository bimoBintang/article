import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import {
  endpointFor,
  getMidtransConfig,
  isPlaceholderKey,
  type MidtransConfig,
} from "./midtrans-settings";
import { getPaymentMethod, type PaymentMethod } from "./payment-methods";
import type { InvoiceStatus, PaymentInstructions } from "@/types";

export type { InvoiceStatus };

/**
 * Midtrans Core API (https://docs.midtrans.com). Semua panggilan dari server
 * dengan Server Key; Client Key tidak dipakai untuk metode yang ditawarkan.
 * Key, mode, metode aktif, dan masa berlaku dibaca dari konfigurasi admin
 * (lib/midtrans-settings.ts) dengan fallback ke variabel lingkungan.
 */

/** Dilempar bila Server Key belum diisi; pemanggil menampilkan pesan ramah tanpa detail. */
export class MidtransNotConfiguredError extends Error {
  constructor() {
    super("Server Key Midtrans belum dikonfigurasi");
    this.name = "MidtransNotConfiguredError";
  }
}

/** Dilempar bila Midtrans menolak charge (status_code bukan 200/201). */
export class MidtransChargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MidtransChargeError";
  }
}

/** Konfigurasi aktif beserta key yang sudah dipastikan terisi. */
async function activeConfig(): Promise<MidtransConfig & { serverKey: string }> {
  const config = await getMidtransConfig();
  if (!config.serverKey || isPlaceholderKey(config.serverKey)) throw new MidtransNotConfiguredError();
  return config as MidtransConfig & { serverKey: string };
}

async function midtransFetch(config: MidtransConfig & { serverKey: string }, path: string, init?: RequestInit) {
  const token = Buffer.from(`${config.serverKey}:`).toString("base64");
  return fetch(`${endpointFor(config.isProduction)}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
}

/** Waktu Midtrans ("2026-10-22 14:30:00") berzona WIB. */
export function parseMidtransTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value.trim().replace(" ", "T") + "+07:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

/** URL hasil Midtrans hanya diterima bila skemanya aman untuk <img>/tautan. */
function safeUrl(value: unknown, allowed: RegExp = /^https?:/i): string | null {
  return typeof value === "string" && allowed.test(value) ? value : null;
}

export type ChargeInput = {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  itemName: string;
  itemId: string;
  customer: { name: string; email: string; phone: string };
  /** Halaman bayar; dipakai GoPay saat kembali dari aplikasi */
  returnUrl: string;
  expiryHours?: number;
};

export type ChargeResult = {
  transactionId: string | null;
  transactionStatus: string;
  expireAt: Date;
  instructions: PaymentInstructions;
};

/** Isi permintaan /v2/charge menurut jenis metode. */
export function buildChargeBody(input: ChargeInput): Record<string, unknown> {
  const { method } = input;
  const common = {
    transaction_details: { order_id: input.orderId, gross_amount: input.amount },
    item_details: [
      {
        id: input.itemId.slice(0, 50),
        price: input.amount,
        quantity: 1,
        name: input.itemName.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: input.customer.name.slice(0, 100),
      email: input.customer.email,
      phone: input.customer.phone,
    },
    custom_expiry: { expiry_duration: input.expiryHours ?? 24, unit: "hour" },
  };

  switch (method.kind) {
    case "va":
      return {
        payment_type: "bank_transfer",
        ...common,
        bank_transfer: { bank: method.bank },
      };
    case "qris":
      return { payment_type: "qris", ...common, qris: { acquirer: "gopay" } };
    case "gopay":
      return {
        payment_type: "gopay",
        ...common,
        gopay: { enable_callback: true, callback_url: input.returnUrl },
      };
  }
}

type Action = { name?: string; url?: string };

function findAction(data: { actions?: Action[] }, prefix: string): string | null {
  return data.actions?.find((a) => a.name?.startsWith(prefix))?.url ?? null;
}

/** Ubah respons /v2/charge menjadi instruksi bayar yang seragam. */
export function parseChargeResponse(
  method: PaymentMethod,
  data: Record<string, any>
): PaymentInstructions {
  if (method.kind === "va") {
    const fromList = Array.isArray(data.va_numbers) ? data.va_numbers[0] : null;
    const vaNumber = fromList?.va_number ?? data.permata_va_number;
    if (!vaNumber) throw new MidtransChargeError("Nomor Virtual Account tidak ditemukan di respons");
    return { type: "va", bank: String(fromList?.bank ?? method.bank), vaNumber: String(vaNumber) };
  }
  if (method.kind === "qris") {
    return {
      type: "qris",
      qrUrl: safeUrl(findAction(data, "generate-qr-code")),
      qrString: typeof data.qr_string === "string" ? data.qr_string : null,
    };
  }
  return {
    type: "gopay",
    deeplinkUrl: safeUrl(findAction(data, "deeplink-redirect"), /^(https?|gojek):/i),
    qrUrl: safeUrl(findAction(data, "generate-qr-code")),
  };
}

/** Buat transaksi di Midtrans Core API. */
export async function chargeCoreApi(input: ChargeInput): Promise<ChargeResult> {
  const config = await activeConfig();
  const expiryHours = input.expiryHours ?? config.expiryHours;
  const response = await midtransFetch(config, "/v2/charge", {
    method: "POST",
    body: JSON.stringify(buildChargeBody({ ...input, expiryHours })),
  });

  const data = await response.json().catch(() => ({}));
  const code = String(data?.status_code ?? response.status);
  if (!response.ok || (code !== "200" && code !== "201")) {
    console.error("Midtrans charge error:", response.status, JSON.stringify(data).slice(0, 500));
    throw new MidtransChargeError(
      typeof data?.status_message === "string" ? data.status_message : `Midtrans menolak (${code})`
    );
  }

  const expireAt =
    parseMidtransTime(data.expiry_time ?? data.expire_time) ??
    new Date(Date.now() + expiryHours * 3600_000);

  return {
    transactionId: typeof data.transaction_id === "string" ? data.transaction_id : null,
    transactionStatus: String(data.transaction_status ?? "pending"),
    expireAt,
    instructions: parseChargeResponse(input.method, data),
  };
}

/**
 * Status transaksi dari Midtrans. Midtrans membalas HTTP 200 dengan
 * status_code "404" bila order belum ada; itu dikembalikan sebagai null.
 */
export async function getTransactionStatus(
  orderId: string
): Promise<Record<string, any> | null> {
  const response = await midtransFetch(await activeConfig(), `/v2/${encodeURIComponent(orderId)}/status`);
  const data = await response.json().catch(() => null);
  if (!data || String(data.status_code) === "404") return null;
  if (!response.ok && !data.transaction_status) {
    throw new Error(`Midtrans status error: ${response.status}`);
  }
  return data;
}

/** Batalkan transaksi yang masih pending. Kegagalan tidak menghentikan alur pemanggil. */
export async function cancelTransaction(orderId: string): Promise<boolean> {
  try {
    const response = await midtransFetch(await activeConfig(), `/v2/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    return response.ok && ["200", "412"].includes(String(data?.status_code ?? "200"));
  } catch (err) {
    console.error("Midtrans cancel error:", err);
    return false;
  }
}

export type ConnectionTest = {
  ok: boolean;
  mode: "sandbox" | "production";
  endpoint: string;
  message: string;
};

/**
 * Uji Server Key dengan menanyakan status order yang pasti tidak ada: key
 * valid dijawab 404 "transaction doesn't exist", key salah dijawab 401.
 * Tidak membuat atau mengubah transaksi apa pun. `override` menguji isian
 * formulir yang belum disimpan (key dan mode), tanpa menyimpannya.
 */
export async function testMidtransConnection(override?: {
  serverKey?: string;
  isProduction?: boolean;
}): Promise<ConnectionTest> {
  const saved = await getMidtransConfig();
  const config: MidtransConfig = {
    ...saved,
    serverKey: override?.serverKey || saved.serverKey,
    isProduction: override?.isProduction ?? saved.isProduction,
  };
  const mode = config.isProduction ? "production" : "sandbox";
  const endpoint = endpointFor(config.isProduction);
  if (!config.serverKey) {
    return { ok: false, mode, endpoint, message: "Server Key belum diisi." };
  }
  if (isPlaceholderKey(config.serverKey)) {
    return {
      ok: false,
      mode,
      endpoint,
      message: "Server Key masih berisi nilai contoh. Ketik Server Key asli dari dashboard Midtrans di kolom di atas.",
    };
  }

  try {
    const response = await midtransFetch(
      config as MidtransConfig & { serverKey: string },
      `/v2/uji-koneksi-${Date.now()}/status`
    );
    const data = await response.json().catch(() => ({}));
    const code = String(data?.status_code ?? response.status);
    if (code === "404") {
      return { ok: true, mode, endpoint, message: `Terhubung ke Midtrans (${mode}). Server Key diterima.` };
    }
    if (code === "401" || response.status === 401) {
      return {
        ok: false,
        mode,
        endpoint,
        message: `Server Key ditolak Midtrans. Pastikan key dan mode (${mode}) sesuai akun Midtrans Anda.`,
      };
    }
    return { ok: false, mode, endpoint, message: `Midtrans membalas status ${code}.` };
  } catch {
    return { ok: false, mode, endpoint, message: "Tidak dapat menghubungi Midtrans." };
  }
}

/** SHA512(order_id + status_code + gross_amount + ServerKey), dibandingkan tanpa kebocoran waktu. */
export async function verifyMidtransSignature(
  signatureKey: unknown,
  orderId: unknown,
  statusCode: unknown,
  grossAmount: unknown
): Promise<boolean> {
  if (![signatureKey, orderId, statusCode, grossAmount].every((v) => typeof v === "string")) {
    return false;
  }
  const expected = createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${(await activeConfig()).serverKey}`)
    .digest("hex");
  const given = Buffer.from(String(signatureKey), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function recordPaymentEvent({
  invoiceId,
  rawPayload,
  status,
  signatureValid,
}: {
  invoiceId: string;
  rawPayload: string;
  status: string;
  signatureValid: boolean;
}) {
  await query(
    `INSERT INTO payment_events (invoice_id, raw_payload, status, signature_valid)
     VALUES ($1, $2, $3, $4)`,
    [invoiceId, rawPayload, status, signatureValid]
  );
}

export function mapMidtransStatusToInvoiceStatus(
  midtransStatus: string,
  fraudStatus?: string
): InvoiceStatus {
  switch (midtransStatus) {
    case "settlement":
      return "PAID";
    case "capture":
      // Kartu: lunas hanya bila lolos pemeriksaan fraud
      return fraudStatus === "accept" ? "PAID" : "PENDING";
    case "deny":
    case "failure":
      return "FAILED";
    case "cancel":
      return "CANCELLED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
    case "chargeback":
    case "partial_chargeback":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

export { getPaymentMethod };
