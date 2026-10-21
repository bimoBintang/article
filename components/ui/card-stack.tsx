"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * CardStack — menampilkan sekumpulan data sebagai tumpukan kartu yang
 * saling tumpang tindih. Klik satu kartu untuk membesarunya dan melihat
 * detail (layout animation dari framer-motion).
 *
 * Catatan: memakai flow layout (bukan absolute) agar tinggi container
 * mengikuti isi secara otomatis dan tidak ada elemen yang tertimpa.
 *
 * @example
 * <CardStack
 *   items={products}
 *   getKey={(p) => p.id}
 *   renderTitle={(p) => p.name}
 *   renderSubtitle={(p) => p.category}
 *   renderMedia={(p) => p.thumbnail_url}
 *   renderExpanded={(p) => <Detail p={p} />}
 * />
 */

export type CardStackProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderTitle: (item: T) => React.ReactNode;
  renderSubtitle?: (item: T) => React.ReactNode;
  renderMedia?: (item: T) => React.ReactNode;
  renderExpanded?: (item: T) => React.ReactNode;
  /** Jarak tumpang tindih antar kartu (px) */
  overlap?: number;
  className?: string;
};

export function CardStack<T>({
  items,
  getKey,
  renderTitle,
  renderSubtitle,
  renderMedia,
  renderExpanded,
  overlap = 12,
  className,
}: CardStackProps<T>) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = getKey(item);
        const isActive = activeKey === key;

        return (
          <motion.div
            key={key}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: isActive ? 1 : 0.985,
            }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 32,
              mass: 0.7,
            }}
            onClick={() => setActiveKey(isActive ? null : key)}
            className={`relative cursor-pointer overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-zinc-900 ${
              isActive
                ? "z-10 border-primary/40 shadow-lg"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
            style={{
              marginTop: index === 0 ? 0 : -overlap,
              zIndex: isActive ? 20 : items.length - index,
            }}
          >
            <div className="flex items-center gap-4 p-4">
              {renderMedia && (
                <div className="shrink-0">{renderMedia(item)}</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {renderTitle(item)}
                </p>
                {renderSubtitle && (
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {renderSubtitle(item)}
                  </p>
                )}
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isActive && renderExpanded && (
                <motion.div
                  key="expanded"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
                    {renderExpanded(item)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
