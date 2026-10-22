import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { cancelInvoice, findInvoiceById, PaymentError } from "@/lib/payments";

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

    const result = await cancelInvoice(invoice);
    return NextResponse.json({ status: result.status });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Invoice cancel error:", err);
    return NextResponse.json({ error: "Gagal membatalkan invoice" }, { status: 500 });
  }
}
