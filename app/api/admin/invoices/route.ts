import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { decryptFields } from "@/lib/pii";
import {
  createInvoice,
  MAX_INVOICE_TOTAL,
  MIN_INVOICE_TOTAL,
  PaymentError,
  sendPaymentLinkEmail,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  requestId: z.string().uuid("ID permintaan tidak valid"),
  total: z
    .number({ error: "Nominal wajib diisi" })
    .int("Nominal harus bilangan bulat")
    .min(MIN_INVOICE_TOTAL, `Nominal minimal Rp ${MIN_INVOICE_TOTAL.toLocaleString("id-ID")}`)
    .max(MAX_INVOICE_TOTAL, "Nominal terlalu besar"),
  description: z.string().trim().max(200, "Keterangan maksimal 200 karakter").optional(),
});

/** Daftar invoice beserta permintaan dan pelanggannya (khusus admin). */
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await query<Record<string, unknown>>(
      `SELECT i.id, i.invoice_number, i.order_id, i.total, i.status, i.payment_method,
              i.attempt, i.expire_at, i.paid_at, i.created_at,
              r.id AS request_id, r.number AS request_number, r.customer_name, r.customer_email
       FROM invoices i
       JOIN requests r ON r.id = i.request_id
       ORDER BY i.created_at DESC`
    );
    const invoices = rows.map((r) => decryptFields(r, ["customer_name", "customer_email"]));
    return NextResponse.json({ invoices }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Fetch invoices error:", err);
    return NextResponse.json({ error: "Gagal memuat invoice" }, { status: 500 });
  }
}

/** Buat invoice untuk sebuah permintaan lalu kirim tautan bayar ke pelanggan. */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const invoice = await createInvoice(parsed.data);

    let emailSent = true;
    try {
      await sendPaymentLinkEmail(invoice);
    } catch (err) {
      // Invoice sudah dibuat; admin bisa kirim ulang dari halaman detail
      console.error("Payment link email error:", err);
      emailSent = false;
    }

    return NextResponse.json({ invoice: { id: invoice.id, invoice_number: invoice.invoice_number }, emailSent }, { status: 201 });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Create invoice error:", err);
    return NextResponse.json({ error: "Gagal membuat invoice" }, { status: 500 });
  }
}
