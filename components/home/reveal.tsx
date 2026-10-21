"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Munculkan konten saat masuk viewport (fade + geser sedikit ke atas).
 *
 * Hanya untuk section di bawah lipatan: konten hero sengaja tidak memakai
 * ini agar tetap terlihat sebelum JavaScript selesai dimuat.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Jeda dalam detik, untuk efek bertahap pada grid */
  delay?: number;
  className?: string;
}) {
  // Markup server & client harus identik (hindari hydration mismatch),
  // jadi reduced-motion cukup membuat transisi instan.
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }
      }
    >
      {children}
    </motion.div>
  );
}
