export type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  thumbnail_url: string | null;
  base_price: number | null;
};

/** Props yang diterima setiap template hero. */
export type HeroTemplateProps = {
  products: HomeProduct[];
  /**
   * Preload gambar utama. Hanya beranda yang boleh true (bawaan); pratinjau
   * di admin mengirim false agar tidak ikut memicu preload.
   */
  priority?: boolean;
};
