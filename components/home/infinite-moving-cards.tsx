import { cn } from "@/lib/utils";

export type MovingCardItem = {
  id: string;
  quote: string;
  name: string;
  title?: string | null;
};

const DURATION = { fast: "25s", normal: "45s", slow: "80s" } as const;

/**
 * Tiap salinan daftar harus lebih lebar dari layar terlebar, kalau tidak
 * akan ada celah kosong saat marquee berputar. Daftar pendek diulang
 * sampai mencapai jumlah ini.
 */
const MIN_CARDS_PER_COPY = 8;

/** Satu kartu testimoni. Dipakai juga untuk tampilan statis bila datanya sedikit. */
export function TestimonialCard({
  item,
  className,
}: {
  item: MovingCardItem;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "flex h-full flex-col justify-between border border-line bg-white p-6 sm:p-7",
        className
      )}
    >
      <blockquote className="text-[15px] leading-relaxed text-ink">
        {item.quote}
      </blockquote>
      <figcaption className="mt-6 text-sm">
        <span className="block font-medium text-ink">{item.name}</span>
        {item.title && <span className="block text-muted">{item.title}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * Baris kartu yang bergeser tanpa henti.
 *
 * Murni CSS (server component): salinan kedua ditandai aria-hidden supaya
 * pembaca layar tidak membacakan isi yang sama dua kali, dan disembunyikan
 * saat pengguna meminta mengurangi gerak (baris jadi bisa digulir manual).
 */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
}: {
  items: MovingCardItem[];
  direction?: "left" | "right";
  speed?: keyof typeof DURATION;
  pauseOnHover?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;

  const repeat = Math.ceil(MIN_CARDS_PER_COPY / items.length);
  const copy = Array.from({ length: repeat }, () => items).flat();

  const list = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className={cn(
        "flex shrink-0 gap-4 pr-4",
        hidden && "motion-reduce:hidden"
      )}
    >
      {copy.map((item, i) => (
        <li key={`${item.id}-${i}`} className="flex w-[300px] shrink-0 sm:w-[380px]">
          <TestimonialCard item={item} className="w-full" />
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        "group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        "motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]",
        className
      )}
    >
      <div
        className={cn(
          "flex w-max animate-marquee",
          pauseOnHover && "group-hover:[animation-play-state:paused]"
        )}
        style={
          {
            "--marquee-duration": DURATION[speed],
            "--marquee-direction": direction === "left" ? "normal" : "reverse",
          } as React.CSSProperties
        }
      >
        {list(false)}
        {list(true)}
      </div>
    </div>
  );
}
