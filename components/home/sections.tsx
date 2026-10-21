import Link from "next/link";
import { Reveal } from "./reveal";

const STEPS = [
  {
    title: "Pilih produk",
    desc: "Putar model 3D dan lihat foto dari beberapa sudut sebelum memutuskan.",
  },
  {
    title: "Susun kebutuhan",
    desc: "Masukkan produk ke keranjang, lalu tentukan paket pemotretan dan model yang Anda mau.",
  },
  {
    title: "Kirim permintaan",
    desc: "Isi satu formulir. Admin membalas lewat email dengan jadwal, rincian biaya, dan invoice.",
  },
];

const FEATURES = [
  {
    title: "Preview 3D di browser",
    desc: "Produk bisa diputar 360° langsung di halaman, tanpa mengunduh aplikasi apa pun.",
  },
  {
    title: "Galeri beberapa sudut",
    desc: "Foto detail dari depan, samping, dan belakang, bisa dibuka layar penuh untuk melihat bahan.",
  },
  {
    title: "Permintaan yang terstruktur",
    desc: "Kebutuhan, jadwal, dan anggaran tertulis jelas sejak awal, jadi tidak ada yang terlewat di chat.",
  },
  {
    title: "Invoice dan pembayaran digital",
    desc: "Setiap permintaan punya nomor sendiri, invoice resmi, dan status pembayaran yang bisa dilacak.",
  },
];

/** Label kecil di atas judul section. */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
      {children}
    </p>
  );
}

export function HowItWorks() {
  return (
    <section id="cara-kerja" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Kicker>Cara kerja</Kicker>
          <h2 className="mt-4 font-display font-extrabold text-4xl leading-[1] tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-5xl">
            Tiga langkah dari katalog ke studio.
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Reveal delay={i * 0.08} className="border-t border-ink pt-6">
                <span className="font-display font-extrabold text-5xl leading-none text-ink">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-8 text-base font-medium text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                  {step.desc}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
        <div className="lg:col-span-5">
          <Reveal className="lg:sticky lg:top-28">
            <Kicker>Layanan</Kicker>
            <h2 className="mt-4 font-display font-extrabold text-4xl leading-[1] tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-5xl">
              Produk terlihat jelas, prosesnya singkat.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              Dirancang untuk brand fashion UMKM yang ingin katalognya tampil
              rapi tanpa harus bolak-balik chat berhari-hari.
            </p>
          </Reveal>
        </div>

        <dl className="divide-y divide-line border-y border-line lg:col-span-7">
          {FEATURES.map((feature, i) => (
            <Reveal
              key={feature.title}
              delay={i * 0.06}
              className="grid gap-2 py-7 sm:grid-cols-5 sm:gap-8"
            >
              <dt className="text-base font-medium text-ink sm:col-span-2">
                {feature.title}
              </dt>
              <dd className="text-sm leading-relaxed text-muted sm:col-span-3">
                {feature.desc}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section id="tentang" className="scroll-mt-24 bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <Reveal className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display font-extrabold text-4xl leading-[1] tracking-[-0.03em] [word-spacing:0.06em] sm:text-6xl">
              Siap memotret koleksi berikutnya?
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/60">
              Pilih produk dari katalog, atau langsung kirim permintaan kalau
              Anda sudah tahu apa yang dibutuhkan.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Link
              href="/katalog"
              className="inline-flex items-center justify-center bg-paper px-7 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-white"
            >
              Lihat katalog
            </Link>
            <Link
              href="/request"
              className="text-center text-sm font-medium text-paper underline decoration-white/30 underline-offset-[6px] transition-colors hover:decoration-white"
            >
              Ajukan permintaan
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
