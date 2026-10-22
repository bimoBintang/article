import { ImagePlaceholder } from "@/components/ui/image-placeholder";

/**
 * Tampilan saat katalog belum punya produk terbit. Dipakai bersama oleh
 * semua template: visual tanpa foto hanya akan berisi tulisan "Tanpa foto".
 */
export function EmptyHero() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="aspect-3/4 overflow-hidden">
        <ImagePlaceholder />
      </div>
      <div className="mt-16 aspect-4/5 overflow-hidden">
        <ImagePlaceholder />
      </div>
    </div>
  );
}
