"use client";

import { motion, useReducedMotion } from "framer-motion";

type Step = { title: string; desc: string };

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Langkah "Cara kerja" yang tampil berurutan saat masuk viewport:
 * garis atas tergambar dari kiri, angka naik dari balik topeng, lalu
 * judul dan deskripsi muncul. Tiap langkah menyusul 0,25 detik setelah
 * sebelumnya supaya terbaca sebagai urutan 01 > 02 > 03.
 * Saat pengguna meminta mengurangi gerak, semuanya langsung tampil.
 */
export function StepsAnimated({ steps }: { steps: Step[] }) {
  const reduce = useReducedMotion();
  const t = (duration: number, delay: number) =>
    reduce ? { duration: 0 } : { duration, delay, ease: EASE };

  return (
    <ol className="mt-10 grid grid-cols-3 gap-3 sm:mt-16 sm:gap-8">
      {steps.map((step, i) => {
        const base = i * 0.25;
        return (
          <motion.li
            key={step.title}
            className="min-w-0"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
          >
            {/* garis atas: tergambar dari kiri ke kanan */}
            <motion.div
              aria-hidden
              className="h-px origin-left bg-ink"
              variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1 } }}
              transition={t(0.7, base)}
            />

            {/* angka: naik dari balik topeng */}
            <div className="mt-4 overflow-hidden sm:mt-6">
              <motion.span
                className="block font-display font-extrabold text-3xl leading-none text-ink sm:text-5xl"
                variants={{ hidden: { y: "110%" }, show: { y: 0 } }}
                transition={t(0.6, base + 0.2)}
              >
                {String(i + 1).padStart(2, "0")}
              </motion.span>
            </div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 },
              }}
              transition={t(0.6, base + 0.4)}
            >
              <h3 className="mt-5 text-sm font-medium leading-snug text-ink sm:mt-8 sm:text-base">{step.title}</h3>
              <p className="mt-2 max-w-xs break-words text-xs leading-relaxed text-muted sm:text-sm">
                {step.desc}
              </p>
            </motion.div>
          </motion.li>
        );
      })}
    </ol>
  );
}
