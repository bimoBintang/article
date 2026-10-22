import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { EmptyHero } from "./shared";
import type { HeroTemplateProps, HomeProduct } from "./types";

/** Rasio foto per posisi, sama dengan Grid editorial. */
const FRAMES = [
  "aspect-3/4",
  "aspect-4/5",
  "aspect-4/3",
  "aspect-square",
] as const;

/** Satu putaran penuh tiap kartu, dalam detik. */
const SPIN_SECONDS = 24;

/** Jarak "kamera" ke tiap kartu dalam cqw; makin kecil makin kuat efek 3D-nya. */
const PERSPECTIVE = 160;

/** Setiap elemen dalam rantai 3D harus meneruskan ruang 3D ke anaknya. */
const P3D = "[transform-style:preserve-3d]";

/** Muka kartu: daun di ruang 3D, hanya tampak dari sisi depannya. */
const FACE =
  "absolute inset-0 block overflow-hidden bg-zinc-100 [backface-visibility:hidden]";

/**
 * Visual hero: Grid editorial versi 3D. Susunan dua kolom asimetris sama
 * seperti aslinya, tetapi tiap foto adalah kartu dua sisi yang berputar
 * pada porosnya sendiri. Fase awal tiap kartu berbeda sehingga tidak
 * berputar serempak, dan sisi belakang menampilkan produk berikutnya
 * sehingga setiap putaran memunculkan foto lain.
 *
 * ATURAN: jangan beri overflow, opacity < 1, filter, mask, atau will-change
 * pada pemutar maupun pembungkus perspektifnya; itu meratakan ruang 3D.
 * Hanya muka kartu (daun) yang boleh overflow-hidden.
 *
 * Murni CSS dan server component. Semua putaran berhenti saat di-hover.
 */
export function HeroEditorialGrid3D({
  products,
  priority = true,
}: HeroTemplateProps) {
  const items = products.slice(0, 4);

  // Katalog kosong: tetap tampilkan bingkai agar komposisi hero utuh
  if (items.length === 0) return <EmptyHero />;

  // Muka belakang = produk berikutnya (berputar kembali ke yang pertama)
  const cards = items.map((front, i) => ({
    front,
    back: items[(i + 1) % items.length],
    // tersebar merata supaya kartu tidak berputar serempak
    delay: -(i * SPIN_SECONDS) / items.length,
  }));

  return (
    // @container: menyediakan satuan cqw. overflow-clip: tepi kartu yang
    // berputar tidak boleh menambah area gulir halaman di layar sempit.
    <div className="@container group overflow-clip">
      {items.length === 1 ? (
        <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
          <SpinCard {...cards[0]} frame="aspect-4/5" priority={priority} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {[0, 1].map((col) => (
            <div
              key={col}
              className={`flex flex-col gap-4 sm:gap-5 ${col === 1 ? "mt-16 sm:mt-24" : ""}`}
            >
              {/* kolom kiri: indeks genap; kolom kanan (turun): indeks ganjil */}
              {cards
                .map((card, i) => ({ card, i }))
                .filter(({ i }) => i % 2 === col)
                .map(({ card, i }) => (
                  <SpinCard
                    key={card.front.id}
                    {...card}
                    frame={FRAMES[i]}
                    priority={priority && i === 0}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpinCard({
  front,
  back,
  delay,
  frame,
  priority,
}: {
  front: HomeProduct;
  back: HomeProduct;
  delay: number;
  frame: string;
  priority: boolean;
}) {
  return (
    // perspective di elemen turunan @container, bukan di akarnya: cqw pada
    // elemen yang sama dengan container dihitung terhadap leluhurnya.
    <div
      className={`relative ${frame}`}
      style={{ perspective: `${PERSPECTIVE}cqw` }}
    >
      <div
        className={`animate-spin-y absolute inset-0 ${P3D} group-hover:[animation-play-state:paused]`}
        style={
          {
            "--spin-duration": `${SPIN_SECONDS}s`,
            animationDelay: `${delay}s`,
          } as CSSProperties
        }
      >
        <Face product={front} priority={priority} />
        <Face product={back} back />
      </div>
    </div>
  );
}

function Face({
  product,
  back = false,
  priority = false,
}: {
  product: HomeProduct;
  /** Muka belakang: diputar 180 derajat agar fotonya tidak terbalik, dan
   *  disembunyikan dari pembaca layar karena tiap produk sudah punya
   *  tautan di muka depannya. */
  back?: boolean;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/produk/${product.slug}`}
      aria-hidden={back || undefined}
      tabIndex={back ? -1 : undefined}
      className={FACE}
      style={back ? { transform: "rotateY(180deg)" } : undefined}
    >
      {product.thumbnail_url ? (
        <Image
          src={product.thumbnail_url}
          alt={back ? "" : product.name}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 1024px) 45vw, 22vw"
        />
      ) : (
        <ImagePlaceholder label={product.name} />
      )}
    </Link>
  );
}
