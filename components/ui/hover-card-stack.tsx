"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * HoverCardStack — tumpukan kartu bergaya "fan-out" seperti CardStack
 * dari Aceternity UI, dibuat dari nol (tanpa library tambahan).
 *
 * - Kartu ditumpuk rapat sehingga tepi kartu di belakang terlihat
 * - Saat hover, kartu mengembang/fan-out mengikuti posisi mouse
 * - Auto-rotasi ke foto berikutnya jika tidak di-hover
 */

export type HoverCardStackProps = {
  images: string[];
  alt?: string;
  className?: string;
  /** Jarak antar kartu saat tertumpuk (px) */
  stackGap?: number;
  /** Jarak antar kartu saat fan-out penuh (px) */
  spread?: number;
  /** Mulai dalam kondisi ter展开 penuh (untuk pratinjau di tabel) */
  expanded?: boolean;
  /** Interval rotasi otomatis (ms), 0 untuk mematikan */
  autoRotateMs?: number;
};

export function HoverCardStack({
  images,
  alt = "",
  className,
  stackGap = 7,
  spread = 30,
  expanded = false,
  autoRotateMs = 3500,
}: HoverCardStackProps) {
  const [hovered, setHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const total = images.length;
  const isOpen = hovered || expanded;

  // Rotasi otomatis saat tidak di-hover
  useEffect(() => {
    if (hovered || total <= 1 || autoRotateMs <= 0) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, autoRotateMs);
    return () => clearInterval(timer);
  }, [hovered, total, autoRotateMs]);

  // Reset saat daftar gambar berubah
  useEffect(() => {
    setActiveIndex(0);
  }, [total]);

  if (total === 0) {
    return null;
  }

  return (
    <div
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPointer({ x: 0, y: 0 });
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPointer({
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        });
      }}
      style={{ perspective: 1200 }}
    >
      {images.map((src, index) => {
        const depth = index - activeIndex;
        const isActive = depth === 0;
        const isBehind = depth > 0;

        // Jarak antar kartu: rapat saat tertutup, lebar saat terbuka
        const gap = isOpen ? spread : stackGap;

        return (
          <motion.div
            key={`${src}-${index}`}
            className="absolute inset-0 h-full w-full overflow-hidden rounded-lg border-2 border-white shadow-lg dark:border-zinc-700"
            style={{ zIndex: total - index }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{
              opacity: isBehind ? 0.9 : 1,
              // Kartu aktif di depan, kartu belakang menyingkir ke bawah
              y: isBehind ? depth * gap : 0,
              // Saat terbuka, kartu belakang ikut bergerak mengikuti mouse
              x: isBehind && isOpen ? pointer.x * 18 : 0,
              rotateZ: isBehind && isOpen ? pointer.x * 2.5 : 0,
              rotateY: isBehind && isOpen ? pointer.x * 6 : 0,
              scale: isBehind ? Math.max(0.88, 1 - depth * 0.045) : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 28,
              mass: 0.7,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${alt} ${index + 1}`}
              className="h-full w-full object-cover"
              draggable={false}
            />
            {isActive && total > 1 && (
              <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {index + 1}/{total}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
