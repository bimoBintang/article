import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { revalidatePublic } from "@/lib/revalidate";

const productSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").optional(),
  slug: z.string().min(1, "Slug wajib diisi").optional(),
  category: z.string().min(1, "Kategori wajib diisi").optional(),
  description: z.string().max(2000, "Deskripsi maksimal 2000 karakter").nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  base_price: z.coerce.number().int().nonnegative().nullable().optional(),
  is_published: z.boolean().optional(),
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
    const parsed = productSchema.safeParse(body);

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
      `SELECT * FROM products WHERE id = $1`,
      [id]
    );

    if (!current) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
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
      UPDATE products
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIdx}
      RETURNING *
    `;

    const rows = await queryOne<any>(sql, values);

    revalidatePublic();

    return NextResponse.json({ product: rows });
  } catch (err) {
    console.error("Update product error:", err);
    return NextResponse.json({ error: "Gagal memperbarui produk" }, { status: 500 });
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

    await query(`DELETE FROM products WHERE id = $1`, [id]);

    revalidatePublic();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete product error:", err);
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}
