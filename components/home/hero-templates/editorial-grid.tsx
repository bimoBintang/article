import Image from "next/image";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { EmptyHero } from "./shared";
import type { HeroTemplateProps, HomeProduct } from "./types";

/** Rasio foto per posisi: kolom kiri tinggi-lebar, kolom kanan sebaliknya. */
const FRAMES = [
  "aspect-3/4",
  "aspect-4/5",
  "aspect-4/3",
  "aspect-square",
] as const;

/**
 * Visual hero: susunan foto produk asimetris dua kolom ala halaman majalah.
 * Statis, tanpa animasi, dan murni server component, jadi foto tetap tampil
 * walau JavaScript gagal dimuat.
 */
export function HeroEditorialGrid({
  products,
  priority = true,
}: HeroTemplateProps) {
  const items = products.slice(0, 4);

  // Katalog kosong: tetap tampilkan bingkai agar komposisi hero utuh
  if (items.length === 0) return <EmptyHero />;

  // Satu produk saja: satu foto besar, jangan biarkan kolom kanan kosong
  if (items.length === 1) {
    return (
      <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
        <Figure
          product={items[0]}
          priority={priority}
          frame="aspect-4/5"
        />
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
              <Figure
                key={product.id}
                product={product}
                priority={priority && index === 0}
                frame={FRAMES[index]}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Figure({
  product,
  priority,
  frame,
}: {
  product: HomeProduct;
  priority: boolean;
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
              priority={priority}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 45vw, 22vw"
            />
          ) : (
            <ImagePlaceholder label={product.name} />
          )}
        </div>
      </figure>
    </Link>
  );
}
