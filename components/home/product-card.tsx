import Image from "next/image";
import Link from "next/link";
import type { HomeProduct } from "./hero-visual";
import { displayPrice } from "@/lib/price";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

/**
 * Kartu produk untuk daftar koleksi terbaru di beranda.
 * Foto menjadi fokus; informasi cukup dua baris teks di bawahnya.
 */
export function HomeProductCard({
  product,
  has3d = false,
  showPrice = true,
}: {
  product: HomeProduct;
  has3d?: boolean;
  showPrice?: boolean;
}) {
  return (
    <Link href={`/produk/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100">
        {product.thumbnail_url ? (
          <Image
            src={product.thumbnail_url}
            alt={product.name}
            fill
            loading="lazy"
            quality={85}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <ImagePlaceholder label={product.name} />
        )}

        {has3d && (
          <span className="absolute left-1.5 top-1.5 bg-paper px-1 py-0.5 font-mono text-[9px] sm:left-3 sm:top-3 sm:px-1.5 sm:text-[10px] font-medium tracking-wider text-ink">
            3D
          </span>
        )}
      </div>

      <div className="mt-2 sm:mt-3">
        <h3 className="line-clamp-1 text-xs font-medium text-ink sm:text-sm underline-offset-4 group-hover:underline">
          {product.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted sm:text-sm">
          {product.category || "Fashion"}
          <span aria-hidden> · </span>
          {displayPrice(product.base_price, showPrice)}
        </p>
      </div>
    </Link>
  );
}
