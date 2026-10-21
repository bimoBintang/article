import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";

const catalogSchema = z.object({
  productIds: z.array(z.string().uuid()).max(50).optional().default([]),
  packageIds: z.array(z.string().uuid()).max(50).optional().default([]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = catalogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Input tidak valid" },
        { status: 400 }
      );
    }

    const { productIds, packageIds } = parsed.data;

    const [products, packages] = await Promise.all([
      productIds.length > 0
        ? query<any>(
            `SELECT id, name, slug, thumbnail_url, base_price
             FROM products WHERE id = ANY($1)`,
            [productIds]
          )
        : Promise.resolve([]),
      packageIds.length > 0
        ? query<any>(
            `SELECT id, name, base_price
             FROM packages WHERE id = ANY($1)`,
            [packageIds]
          )
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ products, packages });
  } catch (err) {
    console.error("Catalog API error:", err);
    return NextResponse.json(
      { error: "Gagal memuat data katalog" },
      { status: 500 }
    );
  }
}
