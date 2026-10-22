import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { findInvoiceById, syncInvoice, PaymentError } from "@/lib/payments";
import { MidtransNotConfiguredError } from "@/lib/midtrans";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
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

    const result = await syncInvoice(invoice);
    return NextResponse.json({ status: result.invoice.status, becamePaid: result.becamePaid, ignored: result.ignored ?? null });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof MidtransNotConfiguredError) {
      return NextResponse.json({ error: "MIDTRANS_SERVER_KEY belum dikonfigurasi" }, { status: 503 });
    }
    console.error("Invoice sync error:", err);
    return NextResponse.json({ error: "Gagal menyinkronkan status" }, { status: 500 });
  }
}
