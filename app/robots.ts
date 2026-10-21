import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

/**
 * robots.txt — otomatis dibuat oleh Next.js.
 *
 * Hanya halaman publik yang boleh di-crawl:
 *  - /            beranda
 *  - /katalog     daftar produk
 *  - /produk/*    halaman detail produk
 *
 * Yang tidak boleh: area admin, login, keranjang, form permintaan,
 * dan seluruh endpoint API.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/katalog", "/produk/"],
        disallow: [
          "/admin",
          "/api/",
          "/login",
          "/keranjang",
          "/request",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
