"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Tiga bingkai foto bertumpuk. Posisi diam dan posisi saat hover
 * didefinisikan sebagai variants supaya satu hover di wadah
 * menggerakkan ketiganya sekaligus.
 */
const FRAMES = [
  {
    label: "01",
    tone: "from-zinc-200 to-zinc-300 text-zinc-500",
    rest: { x: -58, y: 4, rotate: -9 },
    hover: { x: -84, y: 8, rotate: -14 },
    z: 10,
  },
  {
    label: "03",
    tone: "from-zinc-300 to-zinc-400 text-zinc-600 justify-end",
    rest: { x: 58, y: 4, rotate: 8 },
    hover: { x: 84, y: 8, rotate: 13 },
    z: 20,
  },
  {
    label: "02",
    tone: "from-zinc-800 to-zinc-950 text-white/60",
    rest: { x: 0, y: -8, rotate: 0 },
    hover: { x: 0, y: -16, rotate: 0 },
    z: 30,
  },
] as const;

/**
 * Tampilan saat katalog belum punya produk terbit: foto bertumpuk,
 * judul, penjelasan singkat, dan dua tindakan lanjutan.
 */
export function EmptyCollection() {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 22 };

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center text-center">
      <motion.div
        aria-hidden
        initial="rest"
        animate="rest"
        whileHover="hover"
        className="relative h-52 w-full max-w-xs cursor-default"
      >
        {FRAMES.map((frame) => (
          <motion.div
            key={frame.label}
            variants={{ rest: frame.rest, hover: frame.hover }}
            transition={transition}
            style={{ zIndex: frame.z }}
            className="absolute left-1/2 top-4 -ml-17 h-44 w-34 bg-white p-1.5 shadow-[0_14px_32px_-14px_rgba(0,0,0,0.4)] sm:-ml-19 sm:w-38"
          >
            <div
              className={`flex h-full w-full items-end bg-linear-to-br p-2 font-mono text-[10px] ${frame.tone}`}
            >
              {frame.label}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <h3 className="mt-8 font-display font-extrabold text-3xl leading-tight tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-4xl">
        Koleksi pertama segera hadir.
      </h3>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        Belum ada produk yang terbit di katalog. Anda tetap bisa mengajukan
        pemotretan untuk produk sendiri, atau lihat dulu bagaimana prosesnya
        berjalan.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
        <Link
          href="/request"
          className="inline-flex items-center justify-center bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-zinc-800"
        >
          Ajukan pemotretan
        </Link>
        <Link
          href="/#cara-kerja"
          className="inline-flex items-center justify-center border border-ink/20 px-7 py-3.5 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          Lihat cara kerja
        </Link>
      </div>
    </div>
  );
}
