"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const CART_KEY = "ekatalog_cart";

const NAV_LINKS = [
  { label: "Beranda", href: "/" },
  { label: "Katalog", href: "/katalog" },
  { label: "Cara Kerja", href: "/#cara-kerja" },
  { label: "Permintaan", href: "/request" },
];

/**
 * Header publik — sticky, transparan saat di atas hero lalu solid
 * ketika halaman digulir, dengan jumlah keranjang yang sinkron real-time.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // Status scroll untuk efek "menempel" header
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Jumlah keranjang: baca localStorage + dengarkan perubahan antar tab
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(CART_KEY);
        if (!raw) {
          setCartCount(0);
          return;
        }
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) {
          setCartCount(0);
          return;
        }
        const total = items.reduce(
          (sum: number, item: any) => sum + (Number(item?.quantity) || 1),
          0
        );
        setCartCount(total);
      } catch {
        setCartCount(0);
      }
    };

    read();
    window.addEventListener("storage", read);
    window.addEventListener("ekatalog:cart-change", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("ekatalog:cart-change", read);
    };
  }, []);

  // Tutup menu mobile saat pindah halaman
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    // Tautan anchor (mis. /#cara-kerja) tidak pernah menjadi "aktif" —
    // kalau tidak, akan aktif di semua halaman karena path-nya "/".
    if (href.includes("#")) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  const cartLabel = cartCount > 99 ? "99+" : String(cartCount);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        scrolled || menuOpen
          ? "border-b border-line bg-paper/90 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display font-extrabold text-xl tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-2xl"
        >
          Article
        </Link>

        {/* Navigasi desktop */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`text-sm transition-colors ${
                isActive(link.href)
                  ? "text-ink underline decoration-ink underline-offset-[6px]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Aksi kanan */}
        <div className="flex items-center gap-5">
          <Link
            href="/keranjang"
            aria-label={`Keranjang${cartCount > 0 ? `, ${cartCount} item` : ""}`}
            className="text-sm text-ink transition-colors hover:text-muted"
          >
            Keranjang
            {cartCount > 0 && (
              <span className="ml-1 font-mono text-xs">({cartLabel})</span>
            )}
          </Link>

          <Link
            href="/katalog"
            className="hidden bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-zinc-800 sm:inline-flex"
          >
            Lihat katalog
          </Link>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuOpen}
            className="-mr-1.5 p-1.5 text-ink md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <nav className="mx-auto flex max-w-7xl flex-col px-4 pb-6 pt-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  // Anchor di halaman yang sama tidak mengubah pathname
                  onClick={() => setMenuOpen(false)}
                  className={`border-b border-line py-4 font-display text-2xl font-extrabold tracking-[-0.03em] [word-spacing:0.06em] ${
                    isActive(link.href) ? "text-ink" : "text-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/katalog"
                className="mt-6 inline-flex justify-center bg-ink px-4 py-3.5 text-sm font-medium text-paper"
              >
                Lihat katalog
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
