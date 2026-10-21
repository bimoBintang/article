import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth-server";
import { getSettings, setSetting, SETTING_KEYS } from "@/lib/settings";

/** Ambil semua pengaturan (khusus admin). */
export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Fetch settings error:", err);
    return NextResponse.json(
      { error: "Gagal memuat pengaturan" },
      { status: 500 }
    );
  }
}

/**
 * Ubah pengaturan.
 * Body: { settings: { show_product_price: boolean, ... } }
 */
export async function PUT(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const incoming = body?.settings ?? body;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { error: "Format pengaturan tidak valid" },
        { status: 400 }
      );
    }

    const allowed = new Set<string>(SETTING_KEYS);
    const updates: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(incoming)) {
      if (!allowed.has(key)) continue;
      if (typeof value !== "boolean") {
        return NextResponse.json(
          { error: `Nilai "${key}" harus true atau false` },
          { status: 400 }
        );
      }
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Tidak ada pengaturan yang valid untuk diubah" },
        { status: 400 }
      );
    }

    for (const [key, value] of Object.entries(updates)) {
      await setSetting(key, value);
    }

    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Update settings error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan" },
      { status: 500 }
    );
  }
}
