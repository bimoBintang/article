import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";

const packageSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  description: z.string().nullable().optional(),
  base_price: z.coerce.number().int().nonnegative().optional().default(0),
  look_count: z.coerce.number().int().positive().nullable().optional(),
  duration_minutes: z.coerce.number().int().positive().nullable().optional(),
  photo_count: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await query<any>(
      `SELECT * FROM packages ORDER BY base_price ASC`
    );

    return NextResponse.json({ packages: rows });
  } catch (err) {
    console.error("Fetch packages error:", err);
    return NextResponse.json({ error: "Gagal memuat paket" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { name, description, base_price, look_count, duration_minutes, photo_count, is_active } = parsed.data;

    const rows = await queryOne<any>(
      `INSERT INTO packages (name, description, base_price, look_count, duration_minutes, photo_count, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        description || null,
        base_price || 0,
        look_count || null,
        duration_minutes || null,
        photo_count || null,
        is_active ?? true,
      ]
    );

    return NextResponse.json({ package: rows }, { status: 201 });
  } catch (err) {
    console.error("Create package error:", err);
    return NextResponse.json({ error: "Gagal menambah paket" }, { status: 500 });
  }
}
