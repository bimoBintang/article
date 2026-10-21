import { cn } from "@/lib/utils";

/** Ambil maksimal dua inisial dari sebuah nama ("Kemeja Linen" -> "KL"). */
function initials(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * Pengganti foto ketika produk/model belum punya gambar.
 * Menampilkan inisial nama di atas blok netral, atau "Tanpa foto"
 * bila nama tidak tersedia.
 *
 * Wadah induk menentukan ukuran; komponen ini mengisi penuh.
 */
export function ImagePlaceholder({
  label,
  rounded = false,
  className,
}: {
  label?: string | null;
  /** Bentuk bulat untuk avatar model/talent */
  rounded?: boolean;
  className?: string;
}) {
  const text = label?.trim() ? initials(label) : "";

  return (
    <div
      role="img"
      aria-label={label ? `Belum ada foto untuk ${label}` : "Belum ada foto"}
      className={cn(
        "@container flex h-full w-full select-none items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
        rounded && "rounded-full",
        className
      )}
    >
      {text ? (
        <span className="font-display font-extrabold text-[clamp(0.75rem,28cqw,2.75rem)] leading-none tracking-normal">
          {text}
        </span>
      ) : (
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
          Tanpa foto
        </span>
      )}
    </div>
  );
}
