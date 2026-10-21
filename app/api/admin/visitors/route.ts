import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";

export async function GET(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const search = url.searchParams.get("search")?.trim();

    const params: any[] = [limit];
    let where = "";

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE v.visitor_key ILIKE $2 OR v.ip_address ILIKE $2 OR v.landing_page ILIKE $2`;
    }

    const [visitors, totals] = await Promise.all([
      query<any>(
        `SELECT v.*,
                (SELECT COUNT(*) FROM page_views pv WHERE pv.visitor_key = v.visitor_key) AS page_view_count
         FROM visitors v
         ${where}
         ORDER BY v.last_seen_at DESC
         LIMIT $1`,
        params
      ),
      query<any>(
        `SELECT
           (SELECT COUNT(*) FROM visitors) AS total_visitors,
           (SELECT COUNT(*) FROM page_views) AS total_page_views,
           (SELECT COUNT(*) FROM visitors WHERE last_seen_at > NOW() - INTERVAL '24 hours') AS active_24h,
           (SELECT COUNT(*) FROM visitors WHERE device = 'mobile') AS mobile_visitors,
           (SELECT COUNT(*) FROM visitors WHERE device = 'desktop') AS desktop_visitors,
           (SELECT COUNT(*) FROM visitors WHERE device = 'tablet') AS tablet_visitors,
           (SELECT COUNT(*) FROM visitors WHERE device = 'bot') AS bot_visitors`
      ),
    ]);

    return NextResponse.json({ visitors, totals: totals[0] });
  } catch (err) {
    console.error("Fetch visitors error:", err);
    return NextResponse.json(
      { error: "Gagal memuat data visitor" },
      { status: 500 }
    );
  }
}
