import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import type { Testimonial } from "@/types";
import { revalidatePublic } from "@/lib/revalidate";

const testimonialSchema = z.object({
  quote: z
    .string()
    .trim()
    .min(1, "Kutipan wajib diisi")
    .max(400, "Kutipan maksimal 400 karakter"),
  name: z.string().trim().min(1, "Nama wajib diisi").max(255),
  title: z.string().trim().max(255).nullable().optional(),
  sort_order: z.coerce.number().int().nonnegative().optional(),
  is_published: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await query<Testimonial>(
      `SELECT * FROM testimonials ORDER BY sort_order ASC, created_at ASC`
    );

    return NextResponse.json({ testimonials: rows });
  } catch (err) {
    console.error("Fetch testimonials error:", err);
    return NextResponse.json({ error: "Gagal memuat testimoni" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = testimonialSchema.safeParse(body);

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

    const { quote, name, title, sort_order, is_published } = parsed.data;

    // Tanpa urutan eksplisit, taruh di paling akhir
    let order = sort_order;
    if (order === undefined) {
      const maxRow = await queryOne<{ max: number | null }>(
        `SELECT MAX(sort_order) AS max FROM testimonials`
      );
      order = (maxRow?.max ?? 0) + 1;
    }

    const row = await queryOne<Testimonial>(
      `INSERT INTO testimonials (quote, name, title, sort_order, is_published)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [quote, name, title || null, order, is_published]
    );

    revalidatePublic();

    return NextResponse.json({ testimonial: row }, { status: 201 });
  } catch (err) {
    console.error("Create testimonial error:", err);
    return NextResponse.json({ error: "Gagal menambah testimoni" }, { status: 500 });
  }
}
