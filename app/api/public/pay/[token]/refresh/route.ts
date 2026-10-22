import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/visitor";
import { rateLimited } from "@/lib/rate-limit";
import { MidtransNotConfiguredError } from "@/lib/midtrans";
import { findInvoiceByToken, syncInvoice, TOKEN_PATTERN, toPublicInvoice } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Periksa status ke Midtrans lalu kembalikan tagihan terbaru. Dipakai polling
 * halaman bayar (webhook tidak selalu bisa menjangkau server, mis. saat lokal).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const ip = getClientIp(req.headers) ?? "unknown";
    if (rateLimited(`pay-refresh:${ip}:${token.slice(0, 12)}`, 60, 10 * 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak pengecekan" }, { status: 429 });
    }

    let invoice = TOKEN_PATTERN.test(token) ? await findInvoiceByToken(token) : null;
    if (!invoice) {
      return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
    }

    if (invoice.status === "PENDING") {
      try {
        invoice = (await syncInvoice(invoice)).invoice;
      } catch (err) {
        // Midtrans sesaat tidak terjangkau: tampilkan status yang tersimpan
        if (!(err instanceof MidtransNotConfiguredError)) console.error("Refresh sync error:", err);
      }
    }

    return NextResponse.json(
      { invoice: toPublicInvoice(invoice) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Public refresh error:", err);
    return NextResponse.json({ error: "Gagal memeriksa status" }, { status: 500 });
  }
}
