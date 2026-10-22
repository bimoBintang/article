import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { revalidatePublic } from "@/lib/revalidate";

const packageSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").optional(),
  description: z.string().nullable().optional(),
  base_price: z.coerce.number().int().nonnegative().optional(),
  look_count: z.coerce.number().int().positive().nullable().optional(),
  photo_count: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = packageSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues?.[0];
      const field = firstIssue?.path?.length ? firstIssue.path.join(".") : undefined;
      return NextResponse.json(
        {
          error: firstIssue?.message || "Input tidak valid",
          ...(field ? { field } : {}),
        },
        { status: 400 }
      );
    }

    const current = await queryOne<any>(
      `SELECT * FROM packages WHERE id = $1`,
      [id]
    );

    if (!current) {
      return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    }

    const updates = parsed.data;
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIdx}`);
        values.push(value === "" ? null : value);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Tidak ada field yang diupdate" }, { status: 400 });
    }

    values.push(id);
    const sql = `
      UPDATE packages
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIdx}
      RETURNING *
    `;

    const rows = await queryOne<any>(sql, values);

    revalidatePublic();

    return NextResponse.json({ package: rows });
  } catch (err) {
    console.error("Update package error:", err);
    return NextResponse.json({ error: "Gagal memperbarui paket" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await query(`DELETE FROM packages WHERE id = $1`, [id]);

    revalidatePublic();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete package error:", err);
    return NextResponse.json({ error: "Gagal menghapus paket" }, { status: 500 });
  }
}
