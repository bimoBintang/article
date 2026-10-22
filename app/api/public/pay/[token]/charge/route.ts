import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/visitor";
import { rateLimitedShared } from "@/lib/rate-limit";
import { PAYMENT_METHOD_IDS } from "@/lib/payment-methods";
import { MidtransChargeError, MidtransNotConfiguredError } from "@/lib/midtrans";
import {
  chargeInvoice,
  findInvoiceByToken,
  PaymentError,
  TOKEN_PATTERN,
  toPublicInvoice,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

// Hanya metode yang dikirim; nominal selalu dari database
const bodySchema = z.object({
  method: z.enum(PAYMENT_METHOD_IDS, { error: "Pilih metode pembayaran yang tersedia" }),
});

/** Buat percobaan pembayaran dengan metode terpilih lalu kembalikan instruksinya. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const ip = getClientIp(req.headers) ?? "unknown";
    if (await rateLimitedShared(`pay-charge:${ip}:${token.slice(0, 12)}`, 10, 10 * 60_000)) {
      return NextResponse.json(
        { error: "Terlalu sering memilih metode. Coba lagi beberapa menit lagi." },
        { status: 429 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const invoice = TOKEN_PATTERN.test(token) ? await findInvoiceByToken(token) : null;
    if (!invoice) {
      return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
    }

    const outcome = await chargeInvoice(invoice, parsed.data.method);
    return NextResponse.json({ invoice: toPublicInvoice(outcome.invoice), reused: outcome.reused });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof MidtransNotConfiguredError) {
      console.error(err.message);
      return NextResponse.json(
        { error: "Pembayaran online belum tersedia. Silakan hubungi admin." },
        { status: 503 }
      );
    }
    if (err instanceof MidtransChargeError) {
      return NextResponse.json(
        { error: "Metode ini sedang tidak bisa dipakai. Coba metode lain." },
        { status: 502 }
      );
    }
    console.error("Public charge error:", err);
    return NextResponse.json({ error: "Gagal membuat pembayaran" }, { status: 500 });
  }
}
