import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { revalidatePublic } from "@/lib/revalidate";

const productSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  slug: z.string().min(1, "Slug wajib diisi"),
  category: z.string().min(1, "Kategori wajib diisi"),
  description: z.string().max(2000, "Deskripsi maksimal 2000 karakter").nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  base_price: z.coerce.number().int().nonnegative().nullable().optional(),
  is_published: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await query<any>(
      `SELECT p.*,
              COALESCE(
                json_agg(pi.image_url ORDER BY pi.sort_order ASC, pi.created_at ASC)
                  FILTER (WHERE pi.image_url IS NOT NULL),
                '[]'::json
              ) AS gallery,
              EXISTS(
                SELECT 1 FROM model_assets ma WHERE ma.product_id = p.id
              ) AS has_3d
       FROM products p
       LEFT JOIN product_images pi ON pi.product_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );

    return NextResponse.json({ products: rows });
  } catch (err) {
    console.error("Fetch products error:", err);
    return NextResponse.json({ error: "Gagal memuat produk" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Disimpan di luar try agar dapat diakses di blok catch
  let usedSlug = "";

  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { name, slug, category, description, thumbnail_url, base_price, is_published } =
      parsed.data;
    usedSlug = slug;

    const rows = await queryOne<any>(
      `INSERT INTO products (name, slug, category, description, thumbnail_url, base_price, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        slug,
        category,
        description || null,
        thumbnail_url || null,
        base_price || null,
        is_published ?? false,
      ]
    );

    revalidatePublic();

    return NextResponse.json({ product: rows }, { status: 201 });
  } catch (err) {
    console.error("Create product error:", err);
    const message =
      err instanceof Error ? err.message : "Gagal menambah produk";

    // Slug sudah dipakai produk lain
    if (message.includes("products_slug_key")) {
      return NextResponse.json(
        { error: `Slug "${usedSlug}" sudah dipakai produk lain. Gunakan slug berbeda.` },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Gagal menambah produk" }, { status: 500 });
  }
}
