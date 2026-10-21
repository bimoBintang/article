"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from "lucide-react";

export type PreviewImage = {
  url: string;
  alt?: string;
};

export type PreviewMeta = {
  label: string;
  value: React.ReactNode;
};

/**
 * Preview tabel (double-click).
 *
 * - Kalau ada `images`: tampilkan lightbox layar penuh dengan galeri
 *   (prev/next, Esc, panah kiri/kanan, strip thumbnail, zoom).
 * - Kalau tidak ada `images`: tampilkan panel detail baris (meta).
 */
export function TablePreview({
  open,
  onClose,
  images = [],
  title,
  subtitle,
  meta = [],
}: {
  open: boolean;
  onClose: () => void;
  images?: PreviewImage[];
  title?: string;
  subtitle?: string;
  meta?: PreviewMeta[];
}) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const count = images.length;

  const go = useCallback(
    (delta: number) => {
      if (count === 0) return;
      setIndex((prev) => (prev + delta + count) % count);
      setZoomed(false);
    },
    [count]
  );

  // Reset saat dibuka
  useEffect(() => {
    if (open) {
      setIndex(0);
      setZoomed(false);
    }
  }, [open]);

  // Keyboard + scroll lock
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, go, onClose]);

  if (!open) return null;

  const hasImages = count > 0;
  const active = hasImages ? images[index] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Pratinjau ${title}` : "Pratinjau"}
      className="fixed inset-0 z-[100] flex flex-col bg-black/92 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-4 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          {title && (
            <p className="truncate text-sm font-semibold sm:text-base">
              {title}
            </p>
          )}
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-white/60">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasImages && count > 1 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium tabular-nums">
              {index + 1} / {count}
            </span>
          )}
          {hasImages && (
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? "Perkecil" : "Perbesar"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              {zoomed ? (
                <ZoomOut className="h-4 w-4" />
              ) : (
                <ZoomIn className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Konten */}
      {hasImages ? (
        <>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={active!.url}
              src={active!.url}
              alt={active!.alt || title || ""}
              className={
                zoomed
                  ? "max-h-full max-w-full cursor-zoom-out object-contain transition-transform"
                  : "max-h-full max-w-full cursor-zoom-in object-contain transition-transform"
              }
              style={zoomed ? { transform: "scale(1.8)" } : undefined}
            />

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Gambar sebelumnya"
                  className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Gambar berikutnya"
                  className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* Strip thumbnail */}
          {count > 1 && (
            <div className="shrink-0 overflow-x-auto px-4 pb-4 sm:px-6">
              <div className="mx-auto flex max-w-3xl gap-2">
                {images.map((img, i) => (
                  <button
                    key={`${img.url}-${i}`}
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      setZoomed(false);
                    }}
                    aria-label={`Lihat gambar ${i + 1}`}
                    aria-current={i === index}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === index
                        ? "border-white"
                        : "border-white/20 opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Panel detail baris (tanpa gambar) */
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4 sm:p-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            {title && (
              <h3 className="text-lg font-bold text-white">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-white/60">{subtitle}</p>
            )}
            {meta.length > 0 && (
              <dl className="mt-5 space-y-3">
                {meta.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                  >
                    <dt className="text-sm text-white/60">{row.label}</dt>
                    <dd className="text-right text-sm font-medium text-white">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper: pasang handler double-click pada elemen tabel.
 * Klik biasa tetap dipakai untuk aksi normal (Edit/Hapus).
 */
export function useTablePreview() {
  const [preview, setPreview] = useState<{
    title?: string;
    subtitle?: string;
    images?: PreviewImage[];
    meta?: PreviewMeta[];
  } | null>(null);

  return {
    preview,
    openPreview: (data: {
      title?: string;
      subtitle?: string;
      images?: PreviewImage[];
      meta?: PreviewMeta[];
    }) => setPreview(data),
    closePreview: () => setPreview(null),
  };
}
