import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Breadcrumb yang terlihat di halaman.
 *
 * Sengaja tanpa JSON-LD: komponen ini bisa dipakai di client component,
 * sedangkan structured data harus dirender di server (butuh env server
 * untuk URL absolut). Structured data-nya dibuat terpisah di halaman server.
 */
export function Breadcrumb({
 items,
 className = "",
}: {
 items: { name: string; path: string }[];
 className?: string;
}) {
 return (
 <nav
 aria-label="Breadcrumb"
 className={`flex flex-wrap items-center gap-1 text-xs text-zinc-500 ${className}`}
 >
 {items.map((item, i) => {
 const isLast = i === items.length - 1;
 return (
 <span key={item.path} className="flex items-center gap-1">
 {i > 0 && (
 <ChevronRight className="h-3 w-3 text-zinc-300" />
 )}
 {isLast ? (
 <span
 aria-current="page"
 className="font-medium text-zinc-700"
 >
 {item.name}
 </span>
 ) : (
 <Link
 href={item.path}
 className="transition-colors hover:text-primary"
 >
 {item.name}
 </Link>
 )}
 </span>
 );
 })}
 </nav>
 );
}
