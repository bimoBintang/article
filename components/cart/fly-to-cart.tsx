"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const FLY_EVENT = "ekatalog:fly";
const BUMP_EVENT = "ekatalog:cart-bump";
const SIZE = 56; // px, ukuran foto yang terbang
const DURATION = 0.85; // detik

/** Berapa layer yang sedang terpasang; tanpa layer, flyToCart tidak bisa menganimasikan. */
let mountedLayers = 0;

type FlyDetail = { from: DOMRect; imageUrl: string | null };

/**
 * Terbangkan foto produk dari elemen pemicu ke tautan keranjang di header
 * (elemen ber-atribut data-cart-target).
 *
 * Mengembalikan true bila animasi dimulai. Saat animasi selesai, event
 * "ekatalog:cart-change" dikirim (jumlah di header berubah tepat saat foto
 * tiba) lalu "ekatalog:cart-bump". Bila false (mengurangi gerak, tidak ada
 * target, atau tidak ada layer), pemanggil wajib mengirim cart-change sendiri.
 */
export function flyToCart(from: Element, imageUrl: string | null): boolean {
  if (typeof window === "undefined" || mountedLayers === 0) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const target = document.querySelector("[data-cart-target]");
  if (!target || target.getBoundingClientRect().width === 0) return false;

  window.dispatchEvent(
    new CustomEvent<FlyDetail>(FLY_EVENT, {
      detail: { from: from.getBoundingClientRect(), imageUrl },
    })
  );
  return true;
}

type Flight = {
  id: number;
  imageUrl: string | null;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
};

let nextId = 0;

/** Pasang sekali di halaman yang memakai flyToCart. */
export function FlyToCartLayer() {
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    mountedLayers += 1;
    const onFly = (e: Event) => {
      const { from, imageUrl } = (e as CustomEvent<FlyDetail>).detail;
      // Posisi target dibaca saat animasi mulai: tetap akurat setelah layar digulir
      const target = document.querySelector("[data-cart-target]");
      if (!target) return;
      const to = target.getBoundingClientRect();
      const startX = from.left + from.width / 2 - SIZE / 2;
      const startY = from.top + from.height / 2 - SIZE / 2;
      setFlights((prev) => [
        ...prev,
        {
          id: nextId++,
          imageUrl,
          startX,
          startY,
          dx: to.left + to.width / 2 - SIZE / 2 - startX,
          dy: to.top + to.height / 2 - SIZE / 2 - startY,
        },
      ]);
    };
    window.addEventListener(FLY_EVENT, onFly);
    return () => {
      mountedLayers -= 1;
      window.removeEventListener(FLY_EVENT, onFly);
    };
  }, []);

  function land(id: number) {
    setFlights((prev) => prev.filter((f) => f.id !== id));
    window.dispatchEvent(new Event("ekatalog:cart-change"));
    window.dispatchEvent(new Event(BUMP_EVENT));
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      {flights.map((f) => (
        <motion.div
          key={f.id}
          className="absolute overflow-hidden rounded-lg bg-ink shadow-xl ring-2 ring-white"
          style={{ left: f.startX, top: f.startY, width: SIZE, height: SIZE }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            // naik sedikit dulu, lalu meluncur ke target
            x: [0, f.dx * 0.45, f.dx],
            y: [0, Math.min(f.dy * 0.5, 0) - 70, f.dy],
            scale: [1, 0.85, 0.2],
            opacity: [1, 1, 0.85],
          }}
          transition={{ duration: DURATION, ease: "easeInOut", times: [0, 0.45, 1] }}
          onAnimationComplete={() => land(f.id)}
        >
          {f.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
          )}
        </motion.div>
      ))}
    </div>
  );
}
