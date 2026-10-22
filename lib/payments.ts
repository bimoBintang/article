import { randomBytes } from "node:crypto";
import { query, queryOne } from "./db";
import {
  cancelTransaction,
  chargeCoreApi,
  getTransactionStatus,
  mapMidtransStatusToInvoiceStatus,
} from "./midtrans";
import { getMidtransConfig } from "./midtrans-settings";
import { getPaymentMethod, PAYMENT_METHODS, type PaymentMethod, type PaymentMethodId } from "./payment-methods";
import { sendEmail } from "./email";
import { getEmailBrand } from "./email-settings";
import { paymentConfirmationEmail, paymentSuccessEmail } from "./email-templates";
import { MAX_INVOICE_TOTAL, MIN_INVOICE_TOTAL } from "./invoice-status";
import { decryptFields } from "./pii";
import { getSiteUrl } from "./seo";
import type { Invoice, InvoiceStatus, PaymentInstructions } from "@/types";

/**
 * Logika pembayaran invoice: membuat invoice, charge ke Midtrans Core API,
 * dan menerapkan status dari Midtrans. Satu jalur `applyMidtransStatus`
 * dipakai webhook, polling pelanggan, dan sinkron admin supaya hasilnya
 * identik dan efek samping (status permintaan, email) hanya berjalan sekali.
 */

export type InvoiceRow = Invoice & {
  request_number: string;
  request_status: string;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
};

export const INVOICE_SELECT = `
  SELECT i.*, r.number AS request_number, r.status AS request_status,
         r.customer_name, r.customer_email, r.customer_whatsapp
  FROM invoices i
  JOIN requests r ON r.id = i.request_id`;

/** Dilempar untuk kondisi yang layak dijelaskan ke pemanggil (status HTTP disertakan). */
export class PaymentError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export { MIN_INVOICE_TOTAL, MAX_INVOICE_TOTAL };

/** Token tautan bayar: 32 byte heksadesimal. Format lain tidak perlu menyentuh database. */
export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function appUrl(): string {
  return getSiteUrl();
}

export function payUrl(token: string): string {
  return `${appUrl()}/bayar/${token}`;
}

/** Data pelanggan tersimpan terenkripsi; semua pemanggil menerima nilai yang sudah didekripsi. */
const PERSON_FIELDS = ["customer_name", "customer_email", "customer_whatsapp"] as const;
const withPerson = (row: InvoiceRow | null) => (row ? decryptFields(row, PERSON_FIELDS) : null);

export async function findInvoiceByToken(token: string) {
  return withPerson(await queryOne<InvoiceRow>(`${INVOICE_SELECT} WHERE i.pay_token = $1`, [token]));
}

export async function findInvoiceById(id: string) {
  return withPerson(await queryOne<InvoiceRow>(`${INVOICE_SELECT} WHERE i.id = $1`, [id]));
}

/**
 * Cari invoice dari order_id Midtrans "<invoice_number>-<attempt>". Percobaan
 * lama ikut dikenali lewat nomor invoice-nya, supaya pembayaran yang masuk ke
 * percobaan yang sudah diganti tetap tercatat.
 */
export async function findInvoiceByOrderId(orderId: string) {
  const match = /^(.+)-(\d+)$/.exec(orderId);
  if (!match) return null;
  return withPerson(await queryOne<InvoiceRow>(`${INVOICE_SELECT} WHERE i.invoice_number = $1`, [match[1]]));
}

/** Invoice yang masih boleh dibayar. */
export function isPayable(status: InvoiceStatus): boolean {
  return status !== "PAID" && status !== "CANCELLED" && status !== "REFUNDED";
}

// ---------------------------------------------------------------- membuat invoice

const OPEN_REQUEST_STATUSES = ["SUBMITTED", "IN_REVIEW", "NEGOTIATION", "AGREED", "INVOICED"];

export async function createInvoice({
  requestId,
  total,
  description,
}: {
  requestId: string;
  total: number;
  description?: string | null;
}): Promise<InvoiceRow> {
  const request = await queryOne<{ id: string; number: string; status: string }>(
    `SELECT id, number, status FROM requests WHERE id = $1`,
    [requestId]
  );
  if (!request) throw new PaymentError("Permintaan tidak ditemukan", 404);
  if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
    throw new PaymentError(`Invoice tidak bisa dibuat untuk permintaan berstatus ${request.status}`, 409);
  }

  const existing = await query<{ status: string }>(
    `SELECT status FROM invoices WHERE request_id = $1`,
    [requestId]
  );
  if (existing.some((i) => i.status === "PENDING")) {
    throw new PaymentError("Permintaan ini masih punya invoice yang belum selesai", 409);
  }
  if (existing.some((i) => i.status === "PAID")) {
    throw new PaymentError("Permintaan ini sudah dibayar", 409);
  }

  const invoiceNumber = `INV-${request.number.replace(/^REQ-/, "")}-${existing.length + 1}`;
  const rows = await query<{ id: string }>(
    `INSERT INTO invoices (request_id, invoice_number, order_id, total, status, pay_token, description, attempt)
     VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, 0)
     RETURNING id`,
    [
      requestId,
      invoiceNumber,
      `${invoiceNumber}-0`,
      total,
      randomBytes(32).toString("hex"),
      description?.trim() || null,
    ]
  ).catch((err) => {
    // order_id/invoice_number unik: dua admin membuat invoice bersamaan
    if (String(err?.message ?? err).includes("duplicate key")) {
      throw new PaymentError("Invoice untuk permintaan ini baru saja dibuat. Muat ulang halaman.", 409);
    }
    throw err;
  });

  await query(`UPDATE requests SET status = 'INVOICED', updated_at = NOW() WHERE id = $1`, [requestId]);
  await query(
    `INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
     VALUES ($1, $2, 'INVOICED', 'admin', $3)`,
    [requestId, request.status, `Invoice ${invoiceNumber} dibuat`]
  );

  return (await findInvoiceById(rows[0].id))!;
}

export async function sendPaymentLinkEmail(invoice: InvoiceRow) {
  const mail = paymentConfirmationEmail({
    customerName: invoice.customer_name,
    invoiceId: invoice.invoice_number ?? invoice.order_id,
    total: invoice.total,
    paymentUrl: payUrl(invoice.pay_token!),
    brand: await getEmailBrand(),
  });
  return sendEmail({ to: invoice.customer_email, subject: mail.subject, html: mail.html, text: mail.text });
}

/** Metode yang ditampilkan ke pelanggan: yang diaktifkan admin. */
export async function getEnabledMethods(): Promise<PaymentMethod[]> {
  const { enabledMethods } = await getMidtransConfig();
  return PAYMENT_METHODS.filter((m) => enabledMethods.includes(m.id));
}

// ---------------------------------------------------------------- charge

export type ChargeOutcome = { invoice: InvoiceRow; reused: boolean };

/** Buat (atau pakai ulang) percobaan pembayaran dengan metode terpilih. */
export async function chargeInvoice(
  invoice: InvoiceRow,
  methodId: PaymentMethodId
): Promise<ChargeOutcome> {
  const method = getPaymentMethod(methodId);
  if (!method) throw new PaymentError("Metode pembayaran tidak dikenal", 400);
  if (!isPayable(invoice.status)) throw new PaymentError("Invoice ini tidak bisa dibayar lagi", 409);

  // Klik ganda: percobaan yang sama dan belum kedaluwarsa dipakai lagi
  if (
    invoice.status === "PENDING" &&
    invoice.payment_method === method.id &&
    invoice.payment_details &&
    invoice.expire_at &&
    new Date(invoice.expire_at).getTime() > Date.now()
  ) {
    return { invoice, reused: true };
  }

  // Metode yang dimatikan admin tidak bisa dipilih lagi (percobaan yang sedang berjalan tetap dipakai ulang di atas)
  if (!(await getMidtransConfig()).enabledMethods.includes(method.id)) {
    throw new PaymentError("Metode pembayaran ini sedang tidak tersedia. Pilih metode lain.", 400);
  }

  const previousOrderId = invoice.order_id;
  const hadLivePayment = invoice.status === "PENDING" && Boolean(invoice.payment_details);
  const nextAttempt = invoice.attempt + 1;
  const orderId = `${invoice.invoice_number}-${nextAttempt}`;

  // Klaim nomor percobaan; dua permintaan serentak tidak bisa sama-sama menang
  const claimed = await query<{ id: string }>(
    `UPDATE invoices
     SET attempt = $2, order_id = $3, status = 'PENDING', payment_method = NULL,
         payment_details = NULL, transaction_id = NULL, expire_at = NULL, updated_at = NOW()
     WHERE id = $1 AND attempt = $4 AND status NOT IN ('PAID', 'CANCELLED', 'REFUNDED')
     RETURNING id`,
    [invoice.id, nextAttempt, orderId, invoice.attempt]
  );
  if (claimed.length === 0) {
    throw new PaymentError("Pembayaran sedang diproses. Coba lagi sebentar.", 409);
  }

  if (hadLivePayment) await cancelTransaction(previousOrderId);

  const result = await chargeCoreApi({
    orderId,
    amount: invoice.total,
    method,
    itemId: invoice.invoice_number ?? invoice.id,
    itemName: invoice.description || `Pemotretan ${invoice.request_number}`,
    customer: {
      name: invoice.customer_name,
      email: invoice.customer_email,
      phone: invoice.customer_whatsapp,
    },
    returnUrl: payUrl(invoice.pay_token!),
  });

  await query(
    `UPDATE invoices
     SET payment_method = $2, payment_details = $3, transaction_id = $4, expire_at = $5, updated_at = NOW()
     WHERE id = $1 AND order_id = $6`,
    [invoice.id, method.id, JSON.stringify(result.instructions), result.transactionId, result.expireAt.toISOString(), orderId]
  );

  return { invoice: (await findInvoiceById(invoice.id))!, reused: false };
}

// ---------------------------------------------------------------- status dari Midtrans

export type ApplyResult = {
  invoice: InvoiceRow;
  /** Alasan data tidak diterapkan (selain kondisi normal) */
  ignored?: "amount_mismatch" | "stale_attempt";
  /** true hanya untuk pemanggil yang benar-benar memicu transisi ke PAID */
  becamePaid: boolean;
};

const REQUEST_PAYABLE = ["SUBMITTED", "IN_REVIEW", "NEGOTIATION", "AGREED", "INVOICED"];

/**
 * Terapkan status transaksi Midtrans ke invoice. Aman dipanggil berulang dan
 * bersamaan: peralihan ke PAID dijaga `WHERE status <> 'PAID'` sehingga hanya
 * satu pemanggil yang menjalankan efek samping.
 */
export async function applyMidtransStatus(
  invoice: InvoiceRow,
  data: Record<string, any>,
  note = "Pembayaran diterima via Midtrans"
): Promise<ApplyResult> {
  const mapped = mapMidtransStatusToInvoiceStatus(
    String(data.transaction_status ?? ""),
    data.fraud_status
  );

  // Nominal harus sama dengan tagihan; selisih tidak pernah dianggap lunas
  if (Math.round(Number(data.gross_amount)) !== invoice.total) {
    console.error(`Midtrans amount mismatch for ${data.order_id}: ${data.gross_amount} vs ${invoice.total}`);
    return { invoice, ignored: "amount_mismatch", becamePaid: false };
  }

  // Kabar tentang percobaan lama (mis. batal/kedaluwarsa setelah ganti metode) diabaikan,
  // tetapi pembayaran masuk ke percobaan lama tetap dihitung: uangnya nyata
  if (mapped !== "PAID" && data.order_id !== invoice.order_id) {
    return { invoice, ignored: "stale_attempt", becamePaid: false };
  }

  if (mapped === "PAID") {
    const won = await query<{ id: string }>(
      `UPDATE invoices
       SET status = 'PAID', paid_at = NOW(), transaction_id = COALESCE($2, transaction_id), updated_at = NOW()
       WHERE id = $1 AND status <> 'PAID'
       RETURNING id`,
      [invoice.id, data.transaction_id ?? null]
    );
    if (won.length === 0) return { invoice: (await findInvoiceById(invoice.id))!, becamePaid: false };

    const request = await queryOne<{ status: string }>(`SELECT status FROM requests WHERE id = $1`, [invoice.request_id]);
    if (request && REQUEST_PAYABLE.includes(request.status)) {
      await query(`UPDATE requests SET status = 'PAID', updated_at = NOW() WHERE id = $1`, [invoice.request_id]);
      await query(
        `INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, 'PAID', 'sistem', $3)`,
        [invoice.request_id, request.status, `${note} (${invoice.invoice_number})`]
      );
    }

    try {
      const mail = paymentSuccessEmail({
        customerName: invoice.customer_name,
        invoiceId: invoice.invoice_number ?? invoice.order_id,
        total: invoice.total,
        brand: await getEmailBrand(),
      });
      await sendEmail({ to: invoice.customer_email, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (err) {
      console.error("Payment success email error:", err);
    }
    return { invoice: (await findInvoiceById(invoice.id))!, becamePaid: true };
  }

  if (mapped === "REFUNDED") {
    await query(`UPDATE invoices SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1 AND status = 'PAID'`, [invoice.id]);
  } else if (mapped !== "PENDING") {
    // Invoice yang sudah lunas atau dibatalkan admin tidak ditimpa
    await query(
      `UPDATE invoices SET status = $2, updated_at = NOW() WHERE id = $1 AND status NOT IN ('PAID', 'CANCELLED', 'REFUNDED')`,
      [invoice.id, mapped]
    );
  }
  return { invoice: (await findInvoiceById(invoice.id))!, becamePaid: false };
}

/** Tanyakan status percobaan terkini ke Midtrans lalu terapkan. */
export async function syncInvoice(invoice: InvoiceRow): Promise<ApplyResult> {
  if (invoice.attempt === 0 || !invoice.payment_details) return { invoice, becamePaid: false };
  const data = await getTransactionStatus(invoice.order_id);
  if (!data) return { invoice, becamePaid: false };
  return applyMidtransStatus(invoice, data, "Pembayaran terkonfirmasi lewat pengecekan status");
}

/** Batalkan invoice (admin). Ditolak untuk invoice yang sudah lunas. */
export async function cancelInvoice(invoice: InvoiceRow): Promise<InvoiceRow> {
  if (invoice.status === "PAID") throw new PaymentError("Invoice yang sudah dibayar tidak bisa dibatalkan", 409);
  if (invoice.status === "CANCELLED") return invoice;

  if (invoice.status === "PENDING" && invoice.payment_details) await cancelTransaction(invoice.order_id);

  const done = await query<{ id: string }>(
    `UPDATE invoices SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 AND status <> 'PAID' RETURNING id`,
    [invoice.id]
  );
  if (done.length === 0) throw new PaymentError("Invoice baru saja dibayar dan tidak bisa dibatalkan", 409);
  return (await findInvoiceById(invoice.id))!;
}

// ---------------------------------------------------------------- bentuk untuk pelanggan

export type PublicInvoice = {
  invoiceNumber: string | null;
  requestNumber: string;
  customerName: string;
  description: string | null;
  total: number;
  status: InvoiceStatus;
  paymentMethod: string | null;
  instructions: PaymentInstructions | null;
  expireAt: string | null;
  paidAt: string | null;
};

/** Hanya data yang perlu pelanggan; tanpa email, WhatsApp, atau pengenal internal. */
export function toPublicInvoice(inv: InvoiceRow): PublicInvoice {
  const live = inv.status === "PENDING" && inv.payment_details;
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    invoiceNumber: inv.invoice_number,
    requestNumber: inv.request_number,
    customerName: inv.customer_name,
    description: inv.description,
    total: inv.total,
    status: inv.status,
    paymentMethod: live ? inv.payment_method : null,
    instructions: live ? inv.payment_details : null,
    expireAt: live ? iso(inv.expire_at) : null,
    paidAt: iso(inv.paid_at),
  };
}
