import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

/** 404 untuk seluruh situs. Berdiri sendiri (tanpa header/footer) supaya tetap aman bila data gagal dimuat. */
export default function NotFound() {
  return (
    <div className="theme-public flex min-h-screen flex-col bg-paper px-4 text-ink">
      <header className="mx-auto w-full max-w-7xl py-6">
        <Link href="/" className="font-display text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">
          Article
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-24">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Error 404</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] [word-spacing:0.06em] sm:text-5xl">
          Halaman tidak ditemukan.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Alamat yang Anda buka tidak ada atau sudah dipindahkan. Kembali ke beranda atau lihat katalog.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/katalog"
            className="inline-flex items-center justify-center bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-zinc-800"
          >
            Lihat katalog
          </Link>
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
