import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne, getSql } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";

const updateStatusSchema = z.object({
  requestId: z.string().uuid("ID permintaan tidak valid"),
  status: z.enum([
    "DRAFT", "SUBMITTED", "IN_REVIEW", "NEGOTIATION", "AGREED",
    "INVOICED", "PAID", "SCHEDULED", "COMPLETED", "CANCELLED", "EXPIRED",
  ]),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await query<any>(
      `SELECT r.*, COUNT(ri.id) as item_count
       FROM requests r
       LEFT JOIN request_items ri ON ri.request_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    );

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
