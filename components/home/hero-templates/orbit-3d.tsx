import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { EmptyHero } from "./shared";
import type { HeroTemplateProps, HomeProduct } from "./types";

/** Jumlah kartu yang mengorbit. */
const ORBIT_SLOTS = 6;

/** Satu putaran penuh cincin (searah jarum jam) dan piring (berlawanan), dalam detik. */
const ORBIT_SECONDS = 60;
const PLATE_SECONDS = 120;

/** Kemiringan bidang orbit ke belakang; 0 = datar menghadap layar, 90 = tegak lurus. */
const TILT_DEG = 55;

/** Ukuran dalam cqw (persen lebar wadah) agar skalanya mengikuti kolom hero. */
const ORBIT_R = 38;
const CARD_W = 17;
const CARD_H = (CARD_W * 4) / 3;
const PLATE_D = 40;

/** Jarak "kamera" ke bidang; makin kecil makin kuat beda ukuran depan-belakang. */
const PERSPECTIVE = 130;

/** Posisi titik pusat adegan dari tepi atas wadah (elips orbit tidak simetris karena perspektif). */
const ORIGIN_Y_PCT = 40;

/** Setiap elemen dalam rantai 3D harus meneruskan ruang 3D ke anaknya. */
const P3D = "[transform-style:preserve-3d]";

/**
 * Visual hero: orbit 3D seperti planet. Satu produk di "piring" tengah,
 * produk lain mengelilinginya pada bidang yang dimiringkan dengan
 * perspektif: kartu yang lewat di depan tampak lebih besar dan menutupi
 * piring, yang lewat di belakang lebih kecil dan tertutup piring.
 *
 * Susunan: perspektif > adegan (dimiringkan) > cincin (berputar) > slot
 * (posisi di cincin) > penetral (membatalkan putaran cincin) > hadap
 * (membatalkan kemiringan) > kartu. Dua lapisan terakhir membuat kartu
 * selalu menghadap layar, tegak, dan terbaca.
 *
 * ATURAN: jangan beri overflow, opacity < 1, filter, mask, atau will-change
 * pada elemen mana pun di antara perspektif dan kartu. Semuanya meratakan
 * (flatten) ruang 3D sehingga kedalaman hilang. Hanya pembungkus terluar
 * yang boleh overflow-clip.
 *
 * Murni CSS dan server component, jadi foto tetap tampil walau JavaScript
 * gagal dimuat. Semua animasi berhenti saat di-hover.
 */
export function HeroOrbit3D({ products, priority = true }: HeroTemplateProps) {
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

  const paused = "group-hover:[animation-play-state:paused]";

  return (
    // Pembungkus: menyediakan satuan cqw dan memotong isi (mencegah halaman
    // bisa digulir ke samping di layar sempit).
    <div
      role="group"
      aria-label="Produk terbaru"
      className="@container group relative mx-auto aspect-4/3 w-full max-w-140 overflow-clip"
    >
      {/* perspective tidak boleh di elemen @container: cqw dihitung terhadap leluhurnya */}
      <div className="absolute inset-0" style={{ perspective: `${PERSPECTIVE}cqw` }}>
        {/* Adegan: titik pusat 0x0, bidangnya dimiringkan ke belakang */}
        <div
          className={`absolute left-1/2 h-0 w-0 ${P3D}`}
          style={{
            top: `${ORIGIN_Y_PCT}%`,
            transform: `rotateX(${TILT_DEG}deg)`,
          }}
        >
          {/* Jalur orbit (lingkaran di bidang, tampil sebagai elips) */}
          <div
            aria-hidden
            className="absolute rounded-full border border-dashed border-ink/15"
            style={{
              width: `${ORBIT_R * 2}cqw`,
              height: `${ORBIT_R * 2}cqw`,
              left: `${-ORBIT_R}cqw`,
              top: `${-ORBIT_R}cqw`,
            }}
          />

          {/* Piring tengah: berputar pelan berlawanan arah dengan cincin */}
          <div
            className={`animate-orbit absolute rounded-full bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)] ring-1 ring-ink/10 [animation-direction:reverse] ${paused}`}
            style={
              {
                width: `${PLATE_D}cqw`,
                height: `${PLATE_D}cqw`,
                left: `${-PLATE_D / 2}cqw`,
                top: `${-PLATE_D / 2}cqw`,
                "--orbit-duration": `${PLATE_SECONDS}s`,
              } as CSSProperties
            }
          >
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

          {/* Cincin berputar; 0x0 agar tidak menambah area gulir halaman */}
          <div
            className={`animate-orbit absolute left-0 top-0 h-0 w-0 ${P3D} ${paused}`}
            style={{ "--orbit-duration": `${ORBIT_SECONDS}s` } as CSSProperties}
          >
            {slots.map(({ product, repeated, angle }, i) => (
              <div
                key={i}
                className={`absolute left-0 top-0 h-0 w-0 ${P3D}`}
                style={{
                  transform: `rotate(${angle}deg) translateY(${-ORBIT_R}cqw) rotate(${-angle}deg)`,
                }}
              >
                {/* Penetral: membatalkan putaran cincin */}
                <div
                  className={`animate-orbit-counter absolute left-0 top-0 h-0 w-0 ${P3D} ${paused}`}
                >
                  {/* Hadap: membatalkan kemiringan adegan agar kartu menghadap layar */}
                  <div
                    className={`absolute left-0 top-0 h-0 w-0 ${P3D}`}
                    style={{ transform: `rotateX(${-TILT_DEG}deg)` }}
                  >
                    <OrbitCard product={product} hidden={repeated} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
      className="absolute block overflow-hidden bg-zinc-100 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.4)]"
      style={{
        // pusat kartu tepat di titik asal rantai transform
        left: `${-CARD_W / 2}cqw`,
        top: `${-CARD_H / 2}cqw`,
        width: `${CARD_W}cqw`,
        height: `${CARD_H}cqw`,
      }}
    >
      {product.thumbnail_url ? (
        <Image
          src={product.thumbnail_url}
          alt={hidden ? "" : product.name}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 18vw, 100px"
        />
      ) : (
        <ImagePlaceholder label={product.name} />
      )}
    </Link>
  );
}
