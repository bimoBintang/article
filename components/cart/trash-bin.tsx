"use client";

import { motion } from "framer-motion";

export type TrashPhase = "hidden" | "open" | "closed";

/**
 * Tong sampah yang muncul sementara di tengah bawah layar saat item keranjang
 * dibuang. Pembungkus luar tetap di tempat (rect-nya dipakai sebagai sasaran
 * kartu yang terbang); hanya bagian dalamnya yang naik/turun, dan tutupnya
 * berputar dari engsel kiri.
 */
export function TrashBin({
  phase,
  ref,
}: {
  phase: TrashPhase;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const visible = phase !== "hidden";

  return (
    <div
      ref={ref}
      aria-hidden
      data-trash
      className="pointer-events-none fixed bottom-4 left-1/2 z-[90] h-20 w-16 -translate-x-1/2"
    >
      <motion.div
        className="h-full w-full"
        initial={false}
        animate={{ y: visible ? 0 : 110, opacity: visible ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <svg viewBox="0 0 64 80" className="h-full w-full overflow-visible drop-shadow-lg">
          {/* badan */}
          <path
            d="M10 28 H54 L50 74 Q49.6 78 45.6 78 H18.4 Q14.4 78 14 74 Z"
            fill="#0a0a0a"
          />
          <path d="M24 36 V70 M32 36 V70 M40 36 V70" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
          {/* tutup: berputar dari engsel kiri bawah */}
          <motion.g
            initial={false}
            animate={{ rotate: phase === "open" ? -38 : 0 }}
            transition={
              phase === "open"
                ? { type: "spring", stiffness: 300, damping: 18 }
                : { type: "spring", stiffness: 520, damping: 14 }
            }
            style={{ transformBox: "fill-box", transformOrigin: "left bottom" }}
          >
            <rect x="6" y="18" width="52" height="8" rx="3" fill="#0a0a0a" />
            <rect x="24" y="11" width="16" height="8" rx="3" fill="#0a0a0a" />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
