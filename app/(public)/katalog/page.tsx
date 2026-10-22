import type { Metadata } from "next";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Product } from "@/types";
import KatalogClient from "./katalog-client";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, collectionSchema } from "@/lib/seo-schema";
import {
  absoluteUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/seo";

// ISR: di-cache 60 detik; perubahan admin memanggil revalidatePublic() (lib/revalidate.ts) agar langsung terlihat
export const revalidate = 60;

const PAGE_TITLE = "Katalog Produk Fashion UMKM — Preview 3D 360°";

const PAGE_DESCRIPTION =
  "Daftar lengkap produk fashion UMKM dengan preview 3D 360° interaktif dan " +
  "galeri multi sudut. Pilih produk yang Anda suka, lalu ajukan permintaan " +
  "pemotretan secara online tanpa perlu bolak-balik chat.";

const PAGE_KEYWORDS = [
  "katalog fashion UMKM",
  "katalog produk fashion online",
  "jasa foto katalog fashion",
  "preview produk 360 derajat",
  "katalog fashion 3D",
  "belanja fashion UMKM",
  "daftar produk fashion Indonesia",
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: PAGE_KEYWORDS,
  alternates: { canonical: "/katalog" },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    url: absoluteUrl("/katalog"),
    siteName: SITE_NAME,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: PAGE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

async function getProducts(): Promise<Product[]> {
  try {
    return await query<Product>(
      `SELECT id, name, slug, category, description, thumbnail_url, base_price, is_published, created_at, updated_at
       FROM products
       WHERE is_published = true
       ORDER BY created_at DESC`
    );
  } catch {
    return [];
  }
}

export default async function KatalogPage() {
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);

  return (
    <>
      {/* Structured data: CollectionPage + ItemList + BreadcrumbList */}
      <JsonLd
        data={collectionSchema(
          products.map((p) => ({
            name: p.name,
            slug: p.slug,
            thumbnail_url: p.thumbnail_url,
            base_price: p.base_price,
            showPrice: settings.show_product_price,
          }))
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Beranda", path: "/" },
          { name: "Katalog", path: "/katalog" },
        ])}
      />

      <KatalogClient products={products} settings={settings} />
    </>
  );
}
