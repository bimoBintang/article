"use client";

import { useEffect, useRef, useState } from "react";
import { HoverCardStack } from "@/components/ui/hover-card-stack";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

export type PreviewProduct = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  gallery?: string[] | null;
};

/**
 * Thumbnail produk yang ketika di-hover menampilkan pratinjau galeri
 * sebagai card stack fan-out (gaya Aceternity CardStack).
 *
 * Posisi preview memakai `position: fixed` agar tidak terpotong oleh
 * wrapper tabel yang memakai `overflow-x-auto`.
 */
export function ProductPreview({
  product,
  className,
  onPreview,
}: {
  product: PreviewProduct;
  className?: string;
  /** Dipanggil saat pengguna double-click thumbnail. */
  onPreview?: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gabungkan galeri + thumbnail utama (tanpa duplikat)
  const images = [
    ...(product.gallery || []),
    ...(product.thumbnail_url &&
    !(product.gallery || []).includes(product.thumbnail_url)
      ? [product.thumbnail_url]
      : []),
  ];

  const open = (el: HTMLElement) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setRect(el.getBoundingClientRect());
  };

  const close = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Beri jeda supaya mouse bisa pindah dari thumbnail ke preview
    closeTimer.current = setTimeout(() => setRect(null), 140);
  };

  // Tutup preview saat halaman di-scroll
  useEffect(() => {
    if (!rect) return;
    const onScroll = () => setRect(null);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [rect]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (images.length === 0) {
    return (
      <div
        className={`h-10 w-10 shrink-0 overflow-hidden rounded ${className || ""}`}
      >
        <ImagePlaceholder label={product.name} />
      </div>
    );
  }

  // Posisi: di kanan thumbnail, dibalik ke kiri bila kehabisan ruang
  const CARD_W = 128;
  const spaceRight =
    typeof window !== "undefined" && rect
      ? window.innerWidth - rect.right > CARD_W + 24
      : true;
  const left = rect
    ? spaceRight
      ? rect.right + 12
      : Math.max(8, rect.left - 12 - CARD_W)
    : 0;
  const top = rect ? Math.max(8, rect.top - 30) : 0;

  return (
    <>
      <button
        type="button"
        onMouseEnter={(e) => open(e.currentTarget)}
        onMouseLeave={close}
        onFocus={(e) => open(e.currentTarget)}
        onBlur={close}
        onDoubleClick={onPreview}
        title="Klik dua kali untuk pratinjau"
        aria-label={`Pratinjau galeri ${product.name}`}
        className={`shrink-0 transition-transform duration-200 hover:scale-105 ${className || ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt={product.name}
          className="h-10 w-10 rounded object-cover"
        />
      </button>

      {rect && (
        <div
          className="fixed z-50"
          style={{ left, top, width: CARD_W }}
          onMouseEnter={(e) => open(e.currentTarget)}
          onMouseLeave={close}
        >
          {/* effective stack: selalu terbuka agar efek tumpukan terlihat */}
          <HoverCardStack
            images={images}
            alt={product.name}
            className="h-40 w-32"
            expanded
            stackGap={6}
            spread={26}
          />

          <div className="mt-3 text-center">
            <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              {product.name}
            </p>
            <p className="text-[11px] text-zinc-400">
              {images.length} foto · hover untuk menyusun
            </p>
          </div>
        </div>
      )}
    </>
  );
}
