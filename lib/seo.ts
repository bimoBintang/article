import type { Metadata } from "next";

/**
 * Konfigurasi SEO global situs.
 *
 * Semua metadata (title, description, Open Graph, JSON-LD, sitemap,
 * robots) mengambil nilai dari file ini agar konsisten.
 */

export const SITE_NAME = "Article";
export const SITE_TAGLINE = "Katalog Fashion UMKM dengan Preview 3D 360°";
export const SITE_LOCALE = "id_ID";
export const SITE_LANG = "id";

export const SITE_DESCRIPTION =
  "Article adalah platform booking foto produk untuk brand fashion UMKM. " +
  "Jelajahi koleksi dengan preview produk 3D 360° interaktif, pilih model, " +
  "lalu ajukan permintaan pemotretan dalam satu alur yang jelas.";

export const SITE_KEYWORDS = [
  "jasa foto produk",
  "booking foto produk online",
  "pemotretan produk UMKM",
  "katalog fashion 3D",
  "preview produk 360 derajat",
  "foto katalog fashion",
  "studio foto produk online",
  "jasa pemotretan katalog",
  "layanan foto produk UMKM",
  "katalog produk fashion online",
  "foto produk siap jualan",
  "preview 3D fashion",
  "UMKM fashion Indonesia",
  "foto produk untuk e-commerce",
  "shoot produk online",
];

/**
 * Base URL situs.
 *
 * Prioritas:
 *  1. `VERCEL_PROJECT_PRODUCTION_URL` — domain produksi project Vercel.
 *     Selalu tersedia (bahkan di preview) dan tidak menyertakan protokol.
 *     Dipakai supaya canonical & sitemap selalu menunjuk domain produksi.
 *  2. `NEXT_PUBLIC_APP_URL` — override manual (diabaikan bila localhost).
 *  3. `VERCEL_URL` — fallback ke URL deployment preview.
 *  4. localhost untuk pengembangan.
 */
export function getSiteUrl(): string {
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProduction) {
    return `https://${vercelProduction.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  const custom = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (custom && !custom.includes("localhost")) {
    return custom.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

/** URL absolut untuk path tertentu (dipakai canonical, OG, JSON-LD). */
export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? base : `${base}${clean}`;
}

/** Path gambar Open Graph default (statis, 1200×630). */
export const OG_IMAGE_PATH = "/og-image.jpg";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Kode verifikasi search engine — isi setelah registering di Search Console. */
export const SITE_VERIFICATION = {
  google: process.env.GOOGLE_SITE_VERIFICATION || "",
  bing: process.env.BING_SITE_VERIFICATION || "",
};

/**
 * Metadata dasar situs. Dipakai di root layout dan sebagai fallback
 * halaman yang tidak punya metadata sendiri.
 */
export function buildMetadata(
  overrides: Partial<Metadata> = {}
): Metadata {
  const url = getSiteUrl();

  return {
    metadataBase: new URL(url),
    title: {
      default: `${SITE_NAME} — ${SITE_TAGLINE}`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "shopping",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      url,
      siteName: SITE_NAME,
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: OG_IMAGE_PATH,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [OG_IMAGE_PATH],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    formatDetection: { telephone: false, address: false, email: false },
    ...overrides,
  };
}

/**
 * Metadata halaman yang tidak boleh terindeks (keranjang, request, login, admin).
 * `path` dipakai agar canonical menunjuk halaman itu sendiri, bukan beranda.
 */
export function noIndexMetadata(title: string, path?: string): Metadata {
  return {
    title,
    ...(path ? { alternates: { canonical: path } } : {}),
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}
