import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import type { Testimonial } from "@/types";
import { revalidatePublic } from "@/lib/revalidate";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  quote: z
    .string()
    .trim()
    .min(1, "Kutipan wajib diisi")
    .max(400, "Kutipan maksimal 400 karakter")
    .optional(),
  name: z.string().trim().min(1, "Nama wajib diisi").max(255).optional(),
  title: z.string().trim().max(255).nullable().optional(),
  sort_order: z.coerce.number().int().nonnegative().optional(),
  is_published: z.boolean().optional(),
});

/** Kolom yang boleh diubah lewat PUT; nama kolom tidak pernah berasal dari input. */
const UPDATABLE = ["quote", "name", "title", "sort_order", "is_published"] as const;

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Testimoni tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

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

    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const key of UPDATABLE) {
      const value = parsed.data[key];
      if (value === undefined) continue;
      values.push(key === "title" && value === "" ? null : value);
      setClauses.push(`${key} = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Tidak ada field yang diupdate" }, { status: 400 });
    }

    values.push(id);
    const row = await queryOne<Testimonial>(
      `UPDATE testimonials
       SET ${setClauses.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (!row) {
      return NextResponse.json({ error: "Testimoni tidak ditemukan" }, { status: 404 });
    }

    revalidatePublic();

    return NextResponse.json({ testimonial: row });
  } catch (err) {
    console.error("Update testimonial error:", err);
    return NextResponse.json({ error: "Gagal memperbarui testimoni" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Testimoni tidak ditemukan" }, { status: 404 });
    }

    await query(`DELETE FROM testimonials WHERE id = $1`, [id]);

    revalidatePublic();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete testimonial error:", err);
    return NextResponse.json({ error: "Gagal menghapus testimoni" }, { status: 500 });
  }
}
