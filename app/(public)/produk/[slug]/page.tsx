import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import type { Product, Talent, Package, ProductImage } from "@/types";
import { getSettings } from "@/lib/settings";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, productSchema } from "@/lib/seo-schema";
import {
  absoluteUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/seo";
import ProductDetailClient from "./product-detail-client";

export const dynamic = "force-dynamic";

type ModelAsset = {
  id: string;
  product_id: string;
  file_url: string | null;
  poster_url: string | null;
  size_bytes: number | null;
  optimization_status: string | null;
};

async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const rows = await query<Product>(
      `SELECT id, name, slug, category, description, thumbnail_url, base_price, is_published, created_at, updated_at
       FROM products
       WHERE slug = $1 AND is_published = true
       LIMIT 1`,
      [slug]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

async function getModelAsset(productId: string): Promise<ModelAsset | null> {
  try {
    const rows = await query<ModelAsset>(
      `SELECT id, product_id, file_url, poster_url, size_bytes, optimization_status
       FROM model_assets
       WHERE product_id = $1
       LIMIT 1`,
      [productId]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

async function getTalents(): Promise<Talent[]> {
  try {
    return await query<Talent>(
      `SELECT id, name, photo_url, height_cm, size, style, additional_fee, consent_ref, is_available, created_at
       FROM talents
       WHERE is_available = true
       ORDER BY name ASC`
    );
  } catch {
    return [];
  }
}

async function getPackages(): Promise<Package[]> {
  try {
    return await query<Package>(
      `SELECT id, name, description, base_price, look_count, duration_minutes, photo_count, is_active, created_at
       FROM packages
       WHERE is_active = true
       ORDER BY base_price ASC`
    );
  } catch {
    return [];
  }
}

async function getProductImages(productId: string): Promise<ProductImage[]> {
  try {
    return await query<ProductImage>(
      `SELECT id, product_id, image_url, alt_text, sort_order, created_at, updated_at
       FROM product_images
       WHERE product_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [productId]
    );
  } catch {
    return [];
  }
}

/**
 * Metadata per produk — judul, deskripsi, canonical, dan Open Graph
 * memakai foto produk agar tampilan saat di-share lebih menarik.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Produk tidak ditemukan", robots: { index: false, follow: false } };
  }

  const description =
    product.description?.trim().slice(0, 300) ||
    `${product.name} — ${product.category}. Lihat detail produk dan preview 3D 360°, lalu ajukan permintaan pemotretan secara online.`;

  const title = `${product.name} — Preview 3D 360°`;
  const url = absoluteUrl(`/produk/${product.slug}`);
  const image = product.thumbnail_url
    ? [{ url: product.thumbnail_url, alt: product.name }]
    : [
        {
          url: OG_IMAGE_PATH,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: title,
        },
      ];

  return {
    title,
    description,
    keywords: [
      product.name,
      product.category,
      `foto ${product.category.toLowerCase()}`,
      "preview 3D 360 derajat",
      "jasa foto produk UMKM",
    ],
    alternates: { canonical: `/produk/${product.slug}` },
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: image,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image.map((i) => i.url),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Fetch data relasional secara paralel
  const [modelAsset, talents, packages, images, settings] = await Promise.all([
    getModelAsset(product.id),
    getTalents(),
    getPackages(),
    getProductImages(product.id),
    getSettings(),
  ]);

  return (
    <>
      {/* Structured data: Product + BreadcrumbList */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Beranda", path: "/" },
          { name: "Katalog", path: "/katalog" },
          { name: product.name, path: `/produk/${product.slug}` },
        ])}
      />
      <JsonLd
        data={productSchema({
          name: product.name,
          slug: product.slug,
          category: product.category,
          description: product.description,
          thumbnail_url: product.thumbnail_url,
          base_price: product.base_price,
          showPrice: settings.show_product_price,
        })}
      />
      <ProductDetailClient
        product={product}
        modelAsset={modelAsset}
        talents={talents}
        packages={packages}
        images={images}
        settings={settings}
      />
    </>
  );
}
