"use client";

import { motion } from "framer-motion";

/**
 * Baris tabel dengan animasi staggered entry dari framer-motion.
 * Gunakan bersama <AnimatedTableBody> agar efeknya berurutan.
 */

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(index * 0.04, 0.4),
      duration: 0.25,
      ease: "easeOut" as const,
    },
  }),
};

export function AnimatedTableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.tbody
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.tbody>
  );
}

export function AnimatedTableRow({
  index,
  children,
  className,
  onDoubleClick,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
  /** Dipanggil saat baris diklik dua kali (untuk pratinjau). */
  onDoubleClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
}) {
  return (
    <motion.tr
      custom={index}
      variants={rowVariants}
      onDoubleClick={onDoubleClick}
      className={className}
    >
      {children}
    </motion.tr>
  );
}
