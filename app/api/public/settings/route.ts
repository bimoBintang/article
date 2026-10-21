import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Pengaturan tampilan untuk halaman publik.
 * Tidak butuh autentikasi — hanya berisi flag tampil/sembunyi harga.
 */
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Public settings error:", err);
    return NextResponse.json(
      { error: "Gagal memuat pengaturan" },
      { status: 500 }
    );
  }
}
