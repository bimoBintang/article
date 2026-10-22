import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { testMidtransConnection } from "@/lib/midtrans";
import { rateLimited } from "@/lib/rate-limit";
import { SERVER_KEY_PATTERN } from "@/lib/midtrans-settings";

// Isian formulir yang belum disimpan; dipakai sekali untuk uji dan tidak disimpan
const bodySchema = z.object({
  serverKey: z
    .union([
      z.literal(""),
      z.string().trim().max(200).regex(SERVER_KEY_PATTERN, {
        error: "Server Key harus berawalan SB-Mid-server- (sandbox) atau Mid-server- (produksi)",
      }),
    ])
    .optional(),
  isProduction: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

/**
 * Uji Server Key terhadap Midtrans (tidak membuat transaksi). Memakai key dan mode
 * dari body bila dikirim (belum disimpan), selain itu yang tersimpan.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (rateLimited("midtrans-test", 10, 60_000)) {
      return NextResponse.json({ error: "Terlalu sering. Coba lagi sebentar lagi." }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      await testMidtransConnection({
        serverKey: parsed.data.serverKey || undefined,
        isProduction: parsed.data.isProduction,
      })
    );
  } catch (err) {
    console.error("Midtrans test error:", err);
    return NextResponse.json({ error: "Gagal menguji koneksi Midtrans" }, { status: 500 });
  }
}
