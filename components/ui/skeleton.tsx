import { cn } from "@/lib/utils";

/**
 * Placeholder untuk konten yang belum termuat.
 * Gunakan shape yang mencerminkan layout akhir agar tidak ada "lompatan" layout.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800", className)}
      {...props}
    />
  );
}

/** Baris teks dengan lebar acak yang terlihat natural. */
export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-11/12", "w-9/12", "w-4/5"];
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** Kotak dengan rasio tertentu (mis. 16/9, 4/3, 1/1). */
export function SkeletonBox({
  aspect = "aspect-video",
  className,
}: {
  aspect?: string;
  className?: string;
}) {
  return <Skeleton className={cn("w-full", aspect, className)} />;
}

/** Avatar bulat. */
export function SkeletonAvatar({
  size = "h-10 w-10",
  className,
}: {
  size?: string;
  className?: string;
}) {
  return <Skeleton className={cn("shrink-0 rounded-full", size, className)} />;
}

/** Placeholder untuk sel tabel. */
export function SkeletonCell() {
  return <Skeleton className="h-4 w-full" />;
}

/** Placeholder untuk baris tabel. */
export function SkeletonRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4 sm:px-6">
          <SkeletonCell />
        </td>
      ))}
    </tr>
  );
}

/** Placeholder untuk kartu statistik dashboard. */
export function SkeletonStatCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

/** Placeholder untuk tabel admin (header + beberapa baris). */
export function SkeletonTable({
  columns = 5,
  rows = 6,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {Array.from({ length: columns }).map((_, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-3 sm:px-6"
              >
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <SkeletonRow key={r} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Placeholder untuk header halaman dengan tombol aksi. */
export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-9 w-36 rounded-lg" />
    </div>
  );
}
