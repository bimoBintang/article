"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Batas galat untuk seluruh situs: pesan ramah dan tombol coba lagi, tanpa membocorkan detail teknis. */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="theme-public flex min-h-screen flex-col bg-paper px-4 text-ink">
      <header className="mx-auto w-full max-w-7xl py-6">
        <Link href="/" className="font-display text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">
          Article
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-24">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Terjadi kesalahan</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] [word-spacing:0.06em] sm:text-5xl">
          Halaman ini gagal dimuat.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Ada gangguan di sisi kami. Coba muat ulang; bila masih terjadi, silakan kembali beberapa saat lagi.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted">Kode: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-zinc-800"
          >
            Coba lagi
          </button>
          <Link
            href="/"
            className="text-sm font-medium underline decoration-ink/30 underline-offset-[6px] transition-colors hover:decoration-ink"
          >
            Ke beranda
          </Link>
        </div>
      </main>
    </div>
  );
}
