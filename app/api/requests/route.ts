import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne, getSql } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { REQUEST_STATUSES } from "@/lib/request-status";
import { decryptFields } from "@/lib/pii";

const updateStatusSchema = z.object({
  requestId: z.string().uuid("ID permintaan tidak valid"),
  status: z.enum(REQUEST_STATUSES),
  notes: z.string().optional(),
});

/**
 * Daftar permintaan (khusus admin).
 * Query opsional: `status` (salah satu REQUEST_STATUSES) dan `search`
 * (cocokkan nomor, nama, atau email pelanggan).
 */
export async function GET(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search")?.trim();

    const params: unknown[] = [];
    const where: string[] = [];

    if (status && status !== "ALL") {
      if (!(REQUEST_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
      }
      params.push(status);
      where.push(`r.status = $${params.length}`);
    }

    const all = await query<any>(
      `SELECT r.id, r.number, r.status, r.customer_name, r.customer_email, r.customer_whatsapp,
              r.brand_name, r.preferred_date, r.notes, r.personal_data_consent, r.total_estimated,
              r.request_type, r.custom_title, r.custom_description, r.created_at, r.updated_at,
              COUNT(ri.id) as item_count
       FROM requests r
       LEFT JOIN request_items ri ON ri.request_id = r.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );

    // Nama dan email tersimpan terenkripsi, jadi pencarian dilakukan setelah didekripsi
    let rows = all.map((r) => decryptFields(r));
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.number, r.customer_name, r.customer_email].some((v) => String(v ?? "").toLowerCase().includes(needle))
      );
    }

    return NextResponse.json({ requests: rows });
  } catch (err) {
    console.error("Fetch requests error:", err);
    return NextResponse.json({ error: "Gagal memuat permintaan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: firstIssue?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const { requestId, status, notes } = parsed.data;

    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getSql();

    const current = await queryOne<any>(
      `SELECT status FROM requests WHERE id = $1`,
      [requestId]
    );

    if (!current) {
      return NextResponse.json({ error: "Permintaan tidak ditemukan" }, { status: 404 });
    }

    await sql`
      UPDATE requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${requestId}
    `;

    await sql`
      INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
      VALUES (${requestId}, ${current.status}, ${status}, 'admin', ${notes || null})
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update request error:", err);
    return NextResponse.json({ error: "Gagal memperbarui permintaan" }, { status: 500 });
  }
}
