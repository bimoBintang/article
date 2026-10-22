import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { EmptyHero } from "./shared";
import type { HeroTemplateProps, HomeProduct } from "./types";

/** Segi-enam beraturan: 6 sisi foto, tiap sisi memakai sudut 60 derajat. */
const FACES = 6;

/** Satu putaran penuh kolom, dalam detik. */
const SPIN_SECONDS = 40;

/** Semua ukuran dalam cqw (persen lebar wadah) agar skalanya mengikuti kolom hero. */
const FACE_W = 34;
const FACE_H = (FACE_W * 4) / 3;
/** Jarak pusat kolom ke tengah sisi: s / (2 tan(180/n)) untuk segi-n beraturan. */
const APOTHEM = FACE_W / (2 * Math.tan(Math.PI / FACES));
const PLATE_R = 36;

/** Negatif = kamera sedikit di atas kolom (CSS: bidang atas condong ke arah penonton). */
const TILT_DEG = -12;
const PERSPECTIVE = 170;
/** Posisi titik pusat adegan dari atas wadah; kolom + piring tidak simetris karena perspektif. */
const ORIGIN_Y_PCT = 43;

/** Setiap elemen dalam rantai 3D harus meneruskan ruang 3D ke anaknya. */
const P3D = "[transform-style:preserve-3d]";

/**
 * Visual hero: kolom segi-enam berisi foto produk yang berputar 360 derajat
 * di atas piring tipis, dengan keterangan kecil bergaya mono di tiap sisi
 * (nomor, nama, kategori). Mengikuti bahasa visual situs: hitam-putih, garis
 * tipis, huruf mono, dan "Preview 3D 360 derajat".
 *
 * Susunan: perspektif > adegan (kamera sedikit dari atas) > pemutar >
 * 6 sisi + tutup atas + piring. Tutup atas menjaga bagian dalam kolom tidak
 * terlihat dari atas; sisi belakang tertutup sisi depan (backface hidden).
 *
 * ATURAN: jangan beri overflow, opacity < 1, filter, mask, atau will-change
 * pada elemen mana pun di antara perspektif dan sisi-sisinya; itu meratakan
 * ruang 3D. Hanya sisi (daun) yang boleh overflow-hidden.
 *
 * Murni CSS dan server component. Berhenti saat di-hover.
 */
export function HeroColumn360({ products, priority = true }: HeroTemplateProps) {
  if (products.length === 0) return <EmptyHero />;

  // Slot yang mengulang produk disembunyikan dari pembaca layar dan keyboard
  const exposed = new Set<string>();
  const faces = Array.from({ length: FACES }, (_, i) => {
    const product = products[i % products.length];
    const repeated = exposed.has(product.id);
    exposed.add(product.id);
    return { product, repeated, index: i };
  });

  return (
    <div
      role="group"
      aria-label="Produk terbaru"
      className="@container group relative mx-auto aspect-5/4 w-full max-w-140 overflow-clip"
    >
      {/* perspective tidak boleh di elemen @container: cqw dihitung terhadap leluhurnya */}
      <div className="absolute inset-0" style={{ perspective: `${PERSPECTIVE}cqw` }}>
        <div
          className={`absolute left-1/2 h-0 w-0 ${P3D}`}
          style={{
            top: `${ORIGIN_Y_PCT}%`,
            transform: `rotateX(${TILT_DEG}deg)`,
          }}
        >
          <div
            className={`animate-spin-y absolute left-0 top-0 h-0 w-0 ${P3D} group-hover:[animation-play-state:paused]`}
            style={{ "--spin-duration": `${SPIN_SECONDS}s` } as CSSProperties}
          >
            {faces.map(({ product, repeated, index }) => (
              <Face
                key={index}
                product={product}
                index={index}
                hidden={repeated}
                priority={priority && index === 0}
              />
            ))}

            {/* Tutup atas segi-enam, rata di bidang atas kolom */}
            <div
              aria-hidden
              className="absolute bg-white"
              style={{
                width: `${FACE_W * 2}cqw`,
                height: `${APOTHEM * 2}cqw`,
                left: `${-FACE_W}cqw`,
                top: `${-APOTHEM}cqw`,
                transform: `translateY(${-FACE_H / 2}cqw) rotateX(90deg)`,
                clipPath:
                  "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
              }}
            />

            {/*
              Piring: cakram hitam rata di bawah kolom, supaya dasar kolom
              yang putih terpisah dari alasnya. Penanda derajat tipis di
              tepinya ikut berputar sehingga putarannya terlihat jelas.
            */}
            <div
              aria-hidden
              className="absolute rounded-full bg-ink shadow-[0_0_36px_rgba(0,0,0,0.3)]"
              style={{
                width: `${PLATE_R * 2}cqw`,
                height: `${PLATE_R * 2}cqw`,
                left: `${-PLATE_R}cqw`,
                top: `${-PLATE_R}cqw`,
                transform: `translateY(${FACE_H / 2 + 0.6}cqw) rotateX(90deg)`,
                backgroundImage:
                  "repeating-conic-gradient(rgba(255,255,255,0.55) 0deg 0.5deg, transparent 0.5deg 6deg)",
              }}
            >
              <div className="absolute inset-[3.5cqw] rounded-full bg-ink" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Face({
  product,
  index,
  hidden,
  priority,
}: {
  product: HomeProduct;
  index: number;
  hidden: boolean;
  priority: boolean;
}) {
  return (
    <Link
      href={`/produk/${product.slug}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className="absolute block overflow-hidden bg-zinc-100 [backface-visibility:hidden]"
      style={{
        width: `${FACE_W}cqw`,
        height: `${FACE_H}cqw`,
        // pusat sisi di titik asal, lalu diputar mengelilingi sumbu dan didorong keluar
        left: `${-FACE_W / 2}cqw`,
        top: `${-FACE_H / 2}cqw`,
        transform: `rotateY(${(360 / FACES) * index}deg) translateZ(${APOTHEM}cqw)`,
      }}
    >
      {product.thumbnail_url ? (
        <Image
          src={product.thumbnail_url}
          alt={hidden ? "" : product.name}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 1024px) 34vw, 200px"
        />
      ) : (
        <ImagePlaceholder label={product.name} />
      )}

      {/* Keterangan bergaya mono: nomor, nama, kategori */}
      <span className="absolute inset-x-0 bottom-0 flex items-baseline gap-[1.6cqw] bg-white/90 px-[2cqw] py-[1.5cqw] font-mono text-[2.2cqw] leading-none text-ink">
        <span className="text-muted">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1 truncate">{product.name}</span>
        {product.category && (
          <span className="max-w-[40%] shrink-0 truncate text-muted">
            {product.category}
          </span>
        )}
      </span>
    </Link>
  );
}
