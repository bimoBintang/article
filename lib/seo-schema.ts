import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Helper untuk membuat data terstruktur (JSON-LD) yang konsisten
 * di seluruh halaman publik.
 */

/** Data organisasi + website untuk beranda. */
export function organizationSchema() {
  const base = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: SITE_NAME,
        url: base,
        logo: {
          "@type": "ImageObject",
          url: `${base}/icon.svg`,
          width: 512,
          height: 512,
        },
        description: SITE_DESCRIPTION,
        sameAs: ["https://www.instagram.com/article.ppercent_/"],
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "id-ID",
        publisher: { "@id": `${base}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${base}/katalog?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${base}/#localbusiness`,
        name: SITE_NAME,
        url: base,
        description: `${SITE_NAME} — ${SITE_TAGLINE}`,
        image: `${base}/og-image.jpg`,
        logo: `${base}/icon.svg`,
        priceRange: "Rp",
        areaServed: {
          "@type": "Country",
          name: "Indonesia",
        },
        knowsLanguage: "id-ID",
        serviceType: [
          "Jasa Foto Produk",
          "Pemotretan Produk UMKM",
          "Pembuatan Katalog Fashion",
          "Preview Produk 3D",
        ],
      },
    ],
  };
}

/** Breadcrumb (navigasi remah roti) untuk rich result. */
export function breadcrumbSchema(
  items: { name: string; path: string }[]
) {
  const base = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  };
}

/**
 * Data terstruktur produk (Product + AggregateOffer).
 * `price` & `availability` sengaja dibuat opsional karena nominal
 * bisa disembunyikan lewat Pengaturan admin.
 */
export function productSchema(product: {
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  thumbnail_url?: string | null;
  base_price?: number | null;
  showPrice?: boolean;
}) {
  const base = getSiteUrl();

  const url = `${base}/produk/${product.slug}`;
  const showPrice = product.showPrice !== false;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    sku: product.slug,
    description:
      product.description?.slice(0, 500) ||
      `${product.name} — ${SITE_TAGLINE}. Lihat detail produk dan ajukan permintaan pemotretan secara online.`,
    category: product.category,
    brand: { "@type": "Brand", name: SITE_NAME },
  };

  if (product.thumbnail_url) {
    schema.image = [product.thumbnail_url];
  }

  if (showPrice && product.base_price) {
    schema.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "IDR",
      lowPrice: product.base_price,
      highPrice: product.base_price,
      offerCount: 1,
      availability: "https://schema.org/InStock",
      url,
      seller: { "@type": "Organization", name: SITE_NAME },
    };
  } else {
    schema.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "IDR",
      offerCount: 1,
      availability: "https://schema.org/InStock",
      url,
      seller: { "@type": "Organization", name: SITE_NAME },
    };
  }

  return schema;
}

/** Halaman koleksi (katalog) beserta daftar produknya. */
export function collectionSchema(products: {
  name: string;
  slug: string;
  thumbnail_url?: string | null;
  base_price?: number | null;
  showPrice?: boolean;
}[]) {
  const base = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Katalog Produk Fashion UMKM",
    description: SITE_DESCRIPTION,
    url: `${base}/katalog`,
    inLanguage: "id-ID",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${base}/produk/${p.slug}`,
        name: p.name,
        ...(p.thumbnail_url ? { image: p.thumbnail_url } : {}),
      })),
    },
  };
}

export type { MetadataRoute };
