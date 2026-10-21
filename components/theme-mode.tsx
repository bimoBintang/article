"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Mengaktifkan tema gelap HANYA di area admin.
 *
 * Halaman publik (beranda, katalog, detail produk, keranjang, permintaan)
 * selalu tampil terang, apa pun setelan sistem operasi pengguna.
 *
 * Script ini berjalan sebelum hydration (beforeInteractive) agar tidak ada
 * kedipan tema di halaman admin. Navigasi antar-halaman lewat Next.js
 * ditangani oleh useEffect di bawah.
 */
export const themeScript = `
(function () {
  try {
    var isAdmin = window.location.pathname.indexOf('/admin') === 0;
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isAdmin && prefersDark);
  } catch (e) {}
})();
`;

export function ThemeModeWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const isAdmin = pathname?.startsWith("/admin") ?? false;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isAdmin && prefersDark);
  }, [pathname]);

  return null;
}
