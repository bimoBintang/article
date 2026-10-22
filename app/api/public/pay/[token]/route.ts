import { NextResponse } from "next/server";
import { findInvoiceByToken, getEnabledMethods, TOKEN_PATTERN, toPublicInvoice } from "@/lib/payments";
import { getClientIp } from "@/lib/visitor";
import { rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** Ringkasan tagihan untuk halaman bayar (tanpa data pribadi berlebih). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const ip = getClientIp(req.headers) ?? "unknown";
    if (rateLimited(`pay-get:${ip}`, 120, 10 * 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
    }

    const invoice = TOKEN_PATTERN.test(token) ? await findInvoiceByToken(token) : null;
    if (!invoice) {
      return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(
      { invoice: toPublicInvoice(invoice), methods: await getEnabledMethods() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Public invoice error:", err);
    return NextResponse.json({ error: "Gagal memuat tagihan" }, { status: 500 });
  }
}
