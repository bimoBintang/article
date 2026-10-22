import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import { revalidatePublic } from "@/lib/revalidate";

const modelAssetSchema = z.object({
  file_url: z.string().min(1, "URL file 3D wajib diisi"),
  poster_url: z.string().nullable().optional(),
  size_bytes: z.coerce.number().int().nonnegative().nullable().optional(),
  optimization_status: z
    .enum(["pending", "processing", "optimized", "failed"])
    .optional()
    .default("optimized"),
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
      `SELECT id, product_id, file_url, poster_url, size_bytes, optimization_status, created_at
       FROM model_assets
       WHERE product_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({ assets: rows });
  } catch (err) {
    console.error("Fetch model assets error:", err);
    return NextResponse.json({ error: "Gagal memuat aset 3D" }, { status: 500 });
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
    const parsed = modelAssetSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: issue?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    // Pastikan produk ada
    const product = await queryOne<{ id: string }>(
      `SELECT id FROM products WHERE id = $1`,
      [id]
    );

    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    const { file_url, poster_url, size_bytes, optimization_status } = parsed.data;

    // Hanya satu aset 3D aktif per produk: hapus yang lama
    await query(`DELETE FROM model_assets WHERE product_id = $1`, [id]);

    const asset = await queryOne<any>(
      `INSERT INTO model_assets (product_id, file_url, poster_url, size_bytes, optimization_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id, file_url, poster_url, size_bytes, optimization_status, created_at`,
      [id, file_url, poster_url || null, size_bytes || null, optimization_status]
    );

    revalidatePublic();

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err) {
    console.error("Create model asset error:", err);
    return NextResponse.json({ error: "Gagal menyimpan aset 3D" }, { status: 500 });
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
    const assetId = url.searchParams.get("assetId");

    if (assetId) {
      await query(`DELETE FROM model_assets WHERE id = $1 AND product_id = $2`, [
        assetId,
        id,
      ]);
    } else {
      await query(`DELETE FROM model_assets WHERE product_id = $1`, [id]);
    }

    revalidatePublic();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete model asset error:", err);
    return NextResponse.json({ error: "Gagal menghapus aset 3D" }, { status: 500 });
  }
}
