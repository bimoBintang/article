import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Paket pemotretan aktif untuk form permintaan (publik). */
export async function GET() {
  try {
    const packages = await query(
      `SELECT id, name, description, base_price, look_count, photo_count, is_active, created_at
       FROM packages WHERE is_active = true ORDER BY base_price ASC`
    );
    return NextResponse.json({ packages });
  } catch (err) {
    console.error("Public packages error:", err);
    return NextResponse.json({ error: "Gagal memuat paket" }, { status: 500 });
  }
}
