import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * sitemap.xml — otomatis dibuat oleh Next.js.
 *
 * Berisi beranda, katalog, dan seluruh produk yang sudah dipublikasikan.
 * Produk baru otomatis masuk begitu `is_published` diaktifkan.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/katalog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];

  try {
    const products = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at
       FROM products
       WHERE is_published = true
       ORDER BY updated_at DESC`
    );

    productRoutes = products.map((p) => ({
      url: `${base}/produk/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Database belum siap — sitemap tetap valid dengan halaman statis
  }

  return [...staticRoutes, ...productRoutes];
}
