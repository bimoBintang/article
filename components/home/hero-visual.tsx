import { DEFAULT_HERO_TEMPLATE, type HeroTemplateId } from "@/lib/hero-templates";
import { HERO_TEMPLATE_COMPONENTS } from "./hero-templates";
import type { HomeProduct } from "./hero-templates/types";

// Tetap diekspor dari sini agar impor yang sudah ada (mis. product-card) tidak berubah
export type { HomeProduct };

/**
 * Visual hero beranda. Tampilannya ditentukan template yang dipilih admin
 * di Admin > Tampilan Hero; lihat components/home/hero-templates/.
 *
 * `priority` (bawaan true) hanya boleh true di beranda; pratinjau admin
 * mengirim false.
 */
export function HeroVisual({
  products,
  template = DEFAULT_HERO_TEMPLATE,
  priority = true,
}: {
  products: HomeProduct[];
  template?: HeroTemplateId;
  priority?: boolean;
}) {
  const Template = HERO_TEMPLATE_COMPONENTS[template];
  return <Template products={products} priority={priority} />;
}
