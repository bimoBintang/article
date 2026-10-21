import Image from "next/image";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

export type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  thumbnail_url: string | null;
  base_price: number | null;
};

/** Rasio foto per posisi: kolom kiri tinggi-lebar, kolom kanan sebaliknya. */
const FRAMES = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-[4/3]",
  "aspect-square",
] as const;

/**
 * Visual hero — susunan foto produk asimetris dua kolom ala halaman
 * majalah, masing-masing dengan keterangan bernomor.
 *
 * Murni server component (tanpa JS) supaya LCP ringan dan foto tetap
 * tampil meskipun JavaScript gagal dimuat.
 */
export function HeroVisual({ products }: { products: HomeProduct[] }) {
  const items = products.slice(0, 4);

  // Katalog kosong: tetap tampilkan bingkai agar komposisi hero utuh
  if (items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className={`${FRAMES[0]} overflow-hidden`}>
          <ImagePlaceholder />
        </div>
        <div className={`${FRAMES[1]} mt-16 overflow-hidden`}>
          <ImagePlaceholder />
        </div>
      </div>
    );
  }

  // Satu produk saja: satu foto besar, jangan biarkan kolom kanan kosong
  if (items.length === 1) {
    return (
      <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
        <HeroFigure product={items[0]} index={0} frame="aspect-[4/5]" />
      </div>
    );
  }

  // Kolom kiri: item genap; kolom kanan (turun sedikit): item ganjil
  const columns = [
    items.filter((_, i) => i % 2 === 0),
    items.filter((_, i) => i % 2 === 1),
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5">
      {columns.map((column, c) => (
        <div
          key={c}
          className={`flex flex-col gap-4 sm:gap-5 ${c === 1 ? "mt-16 sm:mt-24" : ""}`}
        >
          {column.map((product) => {
            const index = items.indexOf(product);
            return (
              <HeroFigure
                key={product.id}
                product={product}
                index={index}
                frame={FRAMES[index]}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HeroFigure({
  product,
  index,
  frame,
}: {
  product: HomeProduct;
  index: number;
  frame: string;
}) {
  return (
    <Link href={`/produk/${product.slug}`} className="group block">
      <figure>
        <div className={`relative ${frame} overflow-hidden bg-zinc-100`}>
          {product.thumbnail_url ? (
            <Image
              src={product.thumbnail_url}
              alt={product.name}
              fill
              priority={index === 0}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 45vw, 22vw"
            />
          ) : (
            <ImagePlaceholder label={product.name} />
          )}
        </div>
        <figcaption className="mt-2.5 flex items-baseline gap-2.5 text-xs">
          <span className="font-mono text-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 truncate text-ink">
            {product.name}
            {product.category && (
              <span className="text-muted"> / {product.category}</span>
            )}
          </span>
        </figcaption>
      </figure>
    </Link>
  );
}
