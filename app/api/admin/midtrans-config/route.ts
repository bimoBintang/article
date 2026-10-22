import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import {
  getMidtransConfigPublic,
  MAX_EXPIRY_HOURS,
  MIN_EXPIRY_HOURS,
  saveMidtransConfig,
  SERVER_KEY_PATTERN,
} from "@/lib/midtrans-settings";
import { PAYMENT_METHOD_IDS, PAYMENT_METHODS } from "@/lib/payment-methods";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Kosong = pertahankan key tersimpan
  serverKey: z
    .union([
      z.literal(""),
      z.string().trim().max(200).regex(SERVER_KEY_PATTERN, {
        error: "Server Key harus berawalan SB-Mid-server- (sandbox) atau Mid-server- (produksi)",
      }),
    ])
    .optional(),
  clearServerKey: z.boolean().optional(),
  isProduction: z.boolean({ error: "Mode wajib dipilih" }),
  enabledMethods: z
    .array(z.enum(PAYMENT_METHOD_IDS, { error: "Metode pembayaran tidak dikenal" }))
    .min(1, { error: "Aktifkan minimal satu metode pembayaran" }),
  expiryHours: z
    .number({ error: "Masa berlaku wajib diisi" })
    .int({ error: "Masa berlaku harus bilangan bulat" })
    .min(MIN_EXPIRY_HOURS, { error: `Masa berlaku minimal ${MIN_EXPIRY_HOURS} jam` })
    .max(MAX_EXPIRY_HOURS, { error: `Masa berlaku maksimal ${MAX_EXPIRY_HOURS} jam` }),
});

/** Konfigurasi Midtrans untuk admin. Server Key tidak pernah ikut terkirim, hanya versi tersamar. */
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { config: await getMidtransConfigPublic(), methods: PAYMENT_METHODS },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Fetch midtrans config error:", err);
    return NextResponse.json({ error: "Gagal memuat konfigurasi Midtrans" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    await saveMidtransConfig({
      ...parsed.data,
      serverKey: parsed.data.serverKey || undefined,
      enabledMethods: [...new Set(parsed.data.enabledMethods)],
    });
    return NextResponse.json({ config: await getMidtransConfigPublic(), methods: PAYMENT_METHODS });
  } catch (err) {
    console.error("Update midtrans config error:", err);
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi Midtrans" }, { status: 500 });
  }
}
