import type { Metadata } from "next";
import Link from "next/link";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { HeroVisual, type HomeProduct } from "@/components/home/hero-visual";
import { HomeProductCard } from "@/components/home/product-card";
import { EmptyCollection } from "@/components/home/empty-collection";
import { Reveal } from "@/components/home/reveal";
import {
  HowItWorks,
  Features,
  CtaBand,
  Kicker,
} from "@/components/home/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema } from "@/lib/seo-schema";
import {
  absoluteUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "Booking Foto Produk Fashion UMKM dengan Preview 3D 360°";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    url: absoluteUrl("/"),
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
};

type Stats = {
  products: number;
  models: number;
  packages: number;
};

/** Ambil produk terbit untuk ditampilkan di beranda. */
async function getFeaturedProducts(): Promise<HomeProduct[]> {
  try {
    return await query<HomeProduct>(
      `SELECT id, name, slug, category, thumbnail_url, base_price
       FROM products
       WHERE is_published = true
       ORDER BY created_at DESC
       LIMIT 8`
    );
  } catch {
    return [];
  }
}

/** Hitung statistik ringkas untuk bagian hero. */
async function getStats(): Promise<Stats> {
  try {
    const rows = await query<Stats>(
      `SELECT
         (SELECT COUNT(*) FROM products WHERE is_published = true) AS products,
         (SELECT COUNT(*) FROM talents) AS models,
         (SELECT COUNT(*) FROM packages WHERE is_active = true) AS packages`
    );
    return rows[0] ?? { products: 0, models: 0, packages: 0 };
  } catch {
    return { products: 0, models: 0, packages: 0 };
  }
}

/** Produk yang memiliki model 3D (untuk label "3D"). */
async function getProductsWith3d(): Promise<string[]> {
  try {
    const rows = await query<{ product_id: string }>(
      `SELECT DISTINCT product_id FROM model_assets`
    );
    return rows.map((r) => r.product_id);
  } catch {
    return [];
  }
}

export default async function Home() {
  const [products, stats, ids3d, settings] = await Promise.all([
    getFeaturedProducts(),
    getStats(),
    getProductsWith3d(),
    getSettings(),
  ]);

  // Hero memakai 4 produk terbaru; daftar koleksi memakai 4 berikutnya
  // agar tidak berulang. Bila katalog masih sedikit, pakai yang ada.
  const heroProducts = products.slice(0, 4);
  const rest = products.slice(4);
  const featured = rest.length >= 2 ? rest.slice(0, 4) : products.slice(0, 4);
  const with3d = new Set(ids3d);

  // COUNT(*) dari Postgres tiba sebagai string; tampilkan yang bernilai saja
  const statItems = [
    { value: Number(stats.products), label: "Produk di katalog" },
    { value: Number(stats.models), label: "Model tersedia" },
    { value: Number(stats.packages), label: "Paket pemotretan" },
  ].filter((s) => s.value > 0);

  return (
    <>
      {/* Structured data: Organization + WebSite + LocalBusiness */}
      <JsonLd data={organizationSchema()} />

      {/* ===================== HERO ===================== */}
      <section>
        <div className="mx-auto grid max-w-7xl gap-16 px-4 pb-24 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pb-32 lg:pt-20">
          <div className="flex flex-col lg:col-span-6 lg:pt-8">
            <div className="animate-rise">
              <Kicker>Studio foto produk · Fashion UMKM</Kicker>
            </div>

            <h1
              className="animate-rise mt-6 font-display font-extrabold text-[2.75rem] leading-[0.98] tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "60ms" }}
            >
              Foto produk yang membuat brand Anda terlihat{" "}
              <span className="text-muted">serius.</span>
            </h1>

            <p
              className="animate-rise mt-8 max-w-md text-base leading-relaxed text-muted sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              Lihat koleksi dengan preview 3D, pilih model dan paket
              pemotretan, lalu kirim permintaan lewat satu formulir. Jadwal
              dan biaya kami konfirmasi lewat email.
            </p>

            <div
              className="animate-rise mt-10 flex flex-wrap items-center gap-x-8 gap-y-4"
              style={{ animationDelay: "180ms" }}
            >
              <Link
                href="/katalog"
                className="inline-flex items-center justify-center bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-zinc-800"
              >
                Lihat katalog
              </Link>
              <Link
                href="/request"
                className="text-sm font-medium text-ink underline decoration-ink/30 underline-offset-[6px] transition-colors hover:decoration-ink"
              >
                Ajukan pemotretan
              </Link>
            </div>

            {statItems.length > 0 && (
              <dl
                className="animate-rise mt-16 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6"
                style={{ animationDelay: "240ms" }}
              >
                {statItems.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="font-display font-extrabold text-3xl leading-none text-ink sm:text-4xl">
                      {s.value.toLocaleString("id-ID")}
                    </dd>
                    <dd className="mt-2 text-xs text-muted">{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div
            className="animate-rise lg:col-span-6"
            style={{ animationDelay: "120ms" }}
          >
            <HeroVisual products={heroProducts} />
          </div>
        </div>
      </section>

      {/* ===================== KOLEKSI TERBARU ===================== */}
      <section
        id="produk-unggulan"
        className="scroll-mt-24 border-t border-line py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {featured.length > 0 ? (
            <>
              <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <Kicker>Koleksi terbaru</Kicker>
                  <h2 className="mt-4 font-display font-extrabold text-4xl leading-[1] tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-5xl">
                    Baru masuk katalog
                  </h2>
                </div>
                <Link
                  href="/katalog"
                  className="text-sm font-medium text-ink underline decoration-ink/30 underline-offset-[6px] transition-colors hover:decoration-ink"
                >
                  Lihat semua produk
                </Link>
              </Reveal>

              <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4">
                {featured.map((product, i) => (
                  <Reveal key={product.id} delay={i * 0.06}>
                    <HomeProductCard
                      product={product}
                      has3d={with3d.has(product.id)}
                      showPrice={settings.show_product_price}
                    />
                  </Reveal>
                ))}
              </div>
            </>
          ) : (
            // Katalog kosong: judul section digantikan oleh empty state
            <Reveal>
              <EmptyCollection />
            </Reveal>
          )}
        </div>
      </section>

      <HowItWorks />
      <Features />
      <CtaBand />
    </>
  );
}
