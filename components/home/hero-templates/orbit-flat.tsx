import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { EmptyHero } from "./shared";
import type { HeroTemplateProps, HomeProduct } from "./types";

/**
 * Jumlah kartu di cincin orbit. Dengan radius 34cqw, kartu 18cqw, dan piring 36cqw, enam
 * kartu tidak saling menimpa di sudut putaran mana pun.
 */
const ORBIT_SLOTS = 6;

/** Satu putaran penuh cincin, dalam detik. */
const ORBIT_SECONDS = 60;

/**
 * Visual hero: satu produk di "piring" tengah, produk lain mengelilinginya
 * pada cincin yang berputar searah jarum jam. Tiap kartu berputar balik
 * (animate-orbit-counter) sehingga foto selalu tegak.
 *
 * Semua ukuran memakai cqw (lebar wadah) agar skalanya mengikuti kolom hero
 * tanpa breakpoint. Murni CSS dan server component, jadi foto tetap tampil
 * walau JavaScript gagal dimuat. Animasi berhenti saat di-hover.
 */
export function HeroOrbitFlat({ products, priority = true }: HeroTemplateProps) {
  // Katalog kosong: orbit tanpa foto hanya akan berisi tulisan "Tanpa foto"
  if (products.length === 0) return <EmptyHero />;

  const [center, ...others] = products;

  // Hanya satu produk: cincin diisi produk itu sendiri
  const pool = others.length > 0 ? others : [center];

  // Slot yang mengulang produk yang sudah tampil disembunyikan dari pembaca
  // layar dan keyboard supaya tautan yang sama tidak ditemui berkali-kali.
  const exposed = new Set<string>([center.id]);
  const slots = Array.from({ length: ORBIT_SLOTS }, (_, i) => {
    const product = pool[i % pool.length];
    const repeated = exposed.has(product.id);
    exposed.add(product.id);
    return { product, repeated, angle: (360 / ORBIT_SLOTS) * i };
  });

  return (
    <div
      role="group"
      aria-label="Produk terbaru"
      className="@container group relative mx-auto aspect-square w-full max-w-140 overflow-clip"
    >
      {/* Jalur orbit */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[68cqw] w-[68cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ink/15"
      />

      {/*
        Cincin yang berputar. Sengaja berukuran 0x0 (hanya titik pusat putaran):
        kotak penuh yang diputar akan melebar sampai ~70% di kedua sisi dan
        membuat halaman bisa digulir ke samping di layar sempit. Kartu tetap
        di dalam wadah karena posisinya hanya relatif terhadap titik ini.
      */}
      <div
        className="animate-orbit absolute left-1/2 top-1/2 h-0 w-0 group-hover:[animation-play-state:paused]"
        style={{ "--orbit-duration": `${ORBIT_SECONDS}s` } as CSSProperties}
      >
        {slots.map(({ product, repeated, angle }, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-[18cqw] -translate-x-1/2 -translate-y-1/2"
            style={{
              transform: `rotate(${angle}deg) translateY(-34cqw) rotate(${-angle}deg)`,
            }}
          >
            <div className="animate-orbit-counter group-hover:[animation-play-state:paused]">
              <OrbitCard product={product} hidden={repeated} />
            </div>
          </div>
        ))}
      </div>

      {/* Piring tengah (tidak ikut berputar) */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-[36cqw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)] ring-1 ring-ink/10">
        <Link
          href={`/produk/${center.slug}`}
          aria-label={center.name}
          className="absolute inset-[3cqw] block overflow-hidden rounded-full bg-zinc-100"
        >
          {center.thumbnail_url ? (
            <Image
              src={center.thumbnail_url}
              alt={center.name}
              fill
              priority={priority}
              className="object-cover"
              sizes="(max-width: 1024px) 32vw, 190px"
            />
          ) : (
            <ImagePlaceholder label={center.name} />
          )}
        </Link>
      </div>
    </div>
  );
}

function OrbitCard({
  product,
  hidden,
}: {
  product: HomeProduct;
  hidden: boolean;
}) {
  return (
    <Link
      href={`/produk/${product.slug}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className="relative block aspect-3/4 overflow-hidden bg-zinc-100 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.4)]"
    >
      {product.thumbnail_url ? (
        <Image
          src={product.thumbnail_url}
          alt={hidden ? "" : product.name}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 20vw, 110px"
        />
      ) : (
        <ImagePlaceholder label={product.name} />
      )}
    </Link>
  );
}
