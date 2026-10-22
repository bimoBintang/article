import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth-server";
import { currentMonth, getScheduleMonth, MONTH_PATTERN } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** Jadwal pemotretan satu bulan. Query: ?month=YYYY-MM (bawaan: bulan ini). */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const month = new URL(req.url).searchParams.get("month") || currentMonth();
    if (!MONTH_PATTERN.test(month)) {
      return NextResponse.json({ error: "Format bulan harus YYYY-MM" }, { status: 400 });
    }

    return NextResponse.json(await getScheduleMonth(month), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Schedule error:", err);
    return NextResponse.json({ error: "Gagal memuat jadwal" }, { status: 500 });
  }
}
