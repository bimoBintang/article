import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

/**
 * Keranjang adalah halaman transisi — tidak boleh terindeks.
 */
export const metadata: Metadata = noIndexMetadata("Keranjang Permintaan", "/keranjang");

export default function KeranjangLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
