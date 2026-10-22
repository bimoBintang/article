"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Kunci localStorage untuk pilihan tema admin: "light" | "dark" (kosong = ikut sistem). */
export const ADMIN_THEME_KEY = "ekatalog_admin_theme";
export const ADMIN_THEME_EVENT = "ekatalog:theme-change";

export type AdminTheme = "light" | "dark";

/**
 * Mengaktifkan tema gelap HANYA di area admin.
 *
 * Halaman publik (beranda, katalog, detail produk, keranjang, permintaan)
 * selalu tampil terang, apa pun setelan sistem operasi pengguna atau pilihan
 * tema admin. Di area admin, tema mengikuti pilihan yang disimpan lewat
 * tombol ganti tema; bila belum pernah memilih, mengikuti setelan sistem.
 *
 * Script ini berjalan sebelum hydration (beforeInteractive) agar tidak ada
 * kedipan tema di halaman admin. Navigasi antar-halaman lewat Next.js
 * ditangani oleh useEffect di bawah.
 */
export const themeScript = `
(function () {
  try {
    var isAdmin = window.location.pathname.indexOf('/admin') === 0;
    var saved = null;
    try { saved = localStorage.getItem('${ADMIN_THEME_KEY}'); } catch (e) {}
    var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isAdmin && dark);
  } catch (e) {}
})();
`;

/** Tema admin yang berlaku saat ini (pilihan tersimpan, atau setelan sistem). */
export function getAdminTheme(): AdminTheme {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(ADMIN_THEME_KEY);
  } catch {
    // localStorage bisa diblokir; jatuh ke setelan sistem
  }
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Simpan pilihan tema admin dan terapkan seketika. */
export function setAdminTheme(theme: AdminTheme) {
  try {
    localStorage.setItem(ADMIN_THEME_KEY, theme);
  } catch {
    // tetap diterapkan untuk sesi ini
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(ADMIN_THEME_EVENT));
}

export function ThemeModeWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const isAdmin = pathname?.startsWith("/admin") ?? false;
    document.documentElement.classList.toggle(
      "dark",
      isAdmin && getAdminTheme() === "dark"
    );
  }, [pathname]);

  return null;
}
