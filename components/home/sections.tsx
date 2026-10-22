import Link from "next/link";
import { Reveal } from "./reveal";
import { StepsAnimated } from "./steps-animated";
import {
  InfiniteMovingCards,
  TestimonialCard,
  type MovingCardItem,
} from "./infinite-moving-cards";

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
    <section id="cara-kerja" className="scroll-mt-24 border-t border-line py-16 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Kicker>Cara kerja</Kicker>
          <h2 className="mt-4 font-display font-extrabold text-2xl leading-none tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-5xl">
            Tiga langkah dari katalog ke studio.
          </h2>
        </Reveal>

        <StepsAnimated steps={STEPS} />
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-24 border-t border-line py-16 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
        <div className="lg:col-span-5">
          <Reveal className="lg:sticky lg:top-28">
            <Kicker>Layanan</Kicker>
            <h2 className="mt-4 font-display font-extrabold text-2xl leading-none tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-5xl">
              Produk terlihat jelas, prosesnya singkat.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              Dirancang untuk brand fashion UMKM yang ingin katalognya tampil
              rapi tanpa harus bolak-balik chat berhari-hari.
            </p>
          </Reveal>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:block sm:gap-0 sm:divide-y sm:divide-line sm:border-y sm:border-line lg:col-span-7">
          {FEATURES.map((feature, i) => (
            <Reveal
              key={feature.title}
              delay={i * 0.06}
              className="border border-line p-4 sm:grid sm:grid-cols-5 sm:gap-8 sm:border-0 sm:px-0 sm:py-7"
            >
              <dt className="text-sm font-medium text-ink sm:col-span-2 sm:text-base">
                {feature.title}
              </dt>
              <dd className="mt-2 text-xs leading-relaxed text-muted sm:col-span-3 sm:mt-0 sm:text-sm">
                {feature.desc}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Testimoni pelanggan. Tersembunyi bila belum ada yang diterbitkan.
 * Marquee butuh cukup kartu agar terlihat wajar; di bawah 3 kartu
 * ditampilkan statis saja.
 */
export function Testimonials({ items }: { items: MovingCardItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      id="testimoni"
      className="scroll-mt-24 border-t border-line py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Kicker>Testimoni</Kicker>
          <h2 className="mt-4 font-display font-extrabold text-2xl leading-none tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-5xl">
            Kata mereka tentang prosesnya.
          </h2>
        </Reveal>
      </div>

      <Reveal className="mt-14">
        {items.length >= 3 ? (
          <InfiniteMovingCards items={items} />
        ) : (
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:px-8">
            {items.map((item) => (
              <TestimonialCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Reveal>
    </section>
  );
}

export function CtaBand() {
  return (
    <section id="tentang" className="scroll-mt-24 bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <Reveal className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display font-extrabold text-2xl leading-none tracking-[-0.03em] [word-spacing:0.06em] sm:text-6xl">
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
