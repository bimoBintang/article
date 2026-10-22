import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { revalidatePublic } from "@/lib/revalidate";

const talentSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  photo_url: z.string().nullable().optional(),
  height_cm: z.coerce.number().int().positive().nullable().optional(),
  size: z.string().nullable().optional(),
  style: z.string().nullable().optional(),
  additional_fee: z.coerce.number().int().nonnegative().optional().default(0),
  consent_ref: z.string().nullable().optional(),
  is_available: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await query<any>(
      `SELECT * FROM talents ORDER BY name ASC`
    );

    return NextResponse.json({ talents: rows });
  } catch (err) {
    console.error("Fetch talents error:", err);
    return NextResponse.json({ error: "Gagal memuat model" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = talentSchema.safeParse(body);

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

    const {
      name,
      photo_url,
      height_cm,
      size,
      style,
      additional_fee,
      consent_ref,
      is_available,
    } = parsed.data;

    const rows = await queryOne<any>(
      `INSERT INTO talents (name, photo_url, height_cm, size, style, additional_fee, consent_ref, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        photo_url || null,
        height_cm || null,
        size || null,
        style || null,
        additional_fee || 0,
        consent_ref || null,
        is_available ?? true,
      ]
    );

    revalidatePublic();

    return NextResponse.json({ talent: rows }, { status: 201 });
  } catch (err) {
    console.error("Create talent error:", err);
    return NextResponse.json({ error: "Gagal menambah model" }, { status: 500 });
  }
}
