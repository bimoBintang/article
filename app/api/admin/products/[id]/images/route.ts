import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";

const imageSchema = z.object({
  image_url: z.string().min(1, "URL foto wajib diisi"),
  alt_text: z.string().max(255).nullable().optional(),
  sort_order: z.coerce.number().int().nonnegative().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const rows = await query<any>(
      `SELECT id, product_id, image_url, alt_text, sort_order, created_at, updated_at
       FROM product_images
       WHERE product_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    return NextResponse.json({ images: rows });
  } catch (err) {
    console.error("Fetch product images error:", err);
    return NextResponse.json({ error: "Gagal memuat galeri" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = imageSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: issue?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const product = await queryOne<{ id: string }>(
      `SELECT id FROM products WHERE id = $1`,
      [id]
    );
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    const { image_url, alt_text, sort_order } = parsed.data;

    // Tentukan urutan otomatis jika tidak diberikan
    let order = sort_order;
    if (order === undefined) {
      const maxRow = await queryOne<{ max: number | null }>(
        `SELECT MAX(sort_order) as max FROM product_images WHERE product_id = $1`,
        [id]
      );
      order = (maxRow?.max ?? -1) + 1;
    }

    const image = await queryOne<any>(
      `INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, product_id, image_url, alt_text, sort_order, created_at, updated_at`,
      [id, image_url, alt_text || null, order]
    );

    return NextResponse.json({ image }, { status: 201 });
  } catch (err) {
    console.error("Create product image error:", err);
    return NextResponse.json({ error: "Gagal menyimpan foto" }, { status: 500 });
  }
}

/**
 * Ubah urutan tampil (drag & drop / tombol panah).
 * Body: { imageIds: string[] } urutan baru
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const parsed = z
      .object({ imageIds: z.array(z.string().uuid()).min(1).max(100) })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Daftar id foto tidak valid" },
        { status: 400 }
      );
    }

    const { imageIds } = parsed.data;

    for (let i = 0; i < imageIds.length; i++) {
      await query(
        `UPDATE product_images SET sort_order = $1, updated_at = NOW()
         WHERE id = $2 AND product_id = $3`,
        [i, imageIds[i], id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reorder product images error:", err);
    return NextResponse.json({ error: "Gagal mengubah urutan" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const imageId = url.searchParams.get("imageId");

    if (imageId) {
      await query(
        `DELETE FROM product_images WHERE id = $1 AND product_id = $2`,
        [imageId, id]
      );
    } else {
      await query(`DELETE FROM product_images WHERE product_id = $1`, [id]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete product image error:", err);
    return NextResponse.json({ error: "Gagal menghapus foto" }, { status: 500 });
  }
}
