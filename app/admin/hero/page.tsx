import { query } from "@/lib/db";
import { getHeroTemplate } from "@/lib/settings";
import { Alert } from "@/components/ui/alert";
import type { HomeProduct } from "@/components/home/hero-visual";
import { HeroTemplatePicker } from "./hero-template-picker";

export const dynamic = "force-dynamic";

/** Dipakai bila katalog kosong, supaya pratinjau tiap template tetap bermakna. */
const SAMPLE_PRODUCTS: HomeProduct[] = [
  "Kemeja Linen",
  "Jaket Denim",
  "Rok Plisket",
  "Tas Kanvas",
  "Hoodie Abu",
  "Celana Kargo",
  "Topi Rajut",
].map((name, i) => ({
  id: `sample-${i}`,
  name,
  slug: `sample-${i}`,
  category: "Contoh",
  thumbnail_url: null,
  base_price: null,
}));

/** Produk terbit terbaru, sama dengan yang dipakai hero di beranda (maks. 7). */
async function getPreviewProducts(): Promise<HomeProduct[]> {
  try {
    return await query<HomeProduct>(
      `SELECT id, name, slug, category, thumbnail_url, base_price
       FROM products
       WHERE is_published = true
       ORDER BY created_at DESC
       LIMIT 7`
    );
  } catch {
    return [];
  }
}

export default async function AdminHeroPage() {
  const [current, products] = await Promise.all([
    getHeroTemplate(),
    getPreviewProducts(),
  ]);
  const usingSamples = products.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Tampilan Hero
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pilih tampilan visual di bagian atas beranda. Perubahan langsung
          berlaku setelah template dipilih, dan bisa diganti kapan saja.
        </p>
      </div>

      {usingSamples && (
        <Alert variant="info" title="Pratinjau memakai contoh produk">
          Belum ada produk yang terbit, jadi pratinjau di bawah memakai produk
          contoh tanpa foto. Beranda tetap akan memakai produk asli Anda.
        </Alert>
      )}

      <HeroTemplatePicker
        current={current}
        products={usingSamples ? SAMPLE_PRODUCTS : products}
      />
    </div>
  );
}
