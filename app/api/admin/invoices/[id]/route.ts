import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { findInvoiceById, payUrl } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Detail satu invoice: data tagihan, instruksi bayar, tautan, dan riwayat kejadian Midtrans. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    }

    const invoice = await findInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    }

    // Isi mentah notifikasi tidak dikirim; cukup status dan keabsahan tanda tangan
    const events = await query(
      `SELECT id, status, signature_valid, created_at
       FROM payment_events WHERE invoice_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    const { pay_token, ...rest } = invoice;
    return NextResponse.json({
      invoice: { ...rest, pay_url: pay_token ? payUrl(pay_token) : null },
      events,
    });
  } catch (err) {
    console.error("Fetch invoice detail error:", err);
    return NextResponse.json({ error: "Gagal memuat invoice" }, { status: 500 });
  }
}
