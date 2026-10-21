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
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <ImagePlaceholder label={product.name} />
        )}

        {has3d && (
          <span className="absolute left-3 top-3 bg-paper px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-ink">
            3D
          </span>
        )}
      </div>

      <div className="mt-3">
        <h3 className="line-clamp-1 text-sm font-medium text-ink underline-offset-4 group-hover:underline">
          {product.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted">
          {product.category || "Fashion"}
          <span aria-hidden> · </span>
          {displayPrice(product.base_price, showPrice)}
        </p>
      </div>
    </Link>
  );
}
