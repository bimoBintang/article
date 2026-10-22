import Link from "next/link";

const FOOTER_LINKS = [
  {
    title: "Katalog",
    links: [
      { label: "Semua produk", href: "/katalog" },
      { label: "Koleksi terbaru", href: "/#produk-unggulan" },
      { label: "Layanan", href: "/#fitur" },
    ],
  },
  {
    title: "Pemesanan",
    links: [
      { label: "Cara kerja", href: "/#cara-kerja" },
      { label: "Keranjang", href: "/keranjang" },
      { label: "Ajukan permintaan", href: "/request" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-5">
            <Link href="/" className="font-display font-extrabold text-2xl tracking-[-0.03em] [word-spacing:0.06em] text-ink">
              Article
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Booking pemotretan produk untuk brand fashion UMKM. Lihat produk
              dari semua sudut, pilih model, lalu ajukan permintaan dalam satu
              alur.
            </p>
          </div>

          {/* Tautan */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title} className="md:col-span-2">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Kontak */}
          <div className="col-span-2 md:col-span-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              Kontak
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink">
              <li>
                <a
                  href="https://www.instagram.com/article.ppercent_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  Instagram @article.ppercent_
                </a>
              </li>
              <li className="text-muted">Senin–Jumat, jam kerja</li>
              <li className="text-muted">Invoice dikirim lewat email</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between sm:mt-16 gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Article</p>
          <p>Harga dan layanan dapat berubah sewaktu-waktu.</p>
        </div>
      </div>
    </footer>
  );
}
