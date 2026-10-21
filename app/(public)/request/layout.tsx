import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

/**
 * Formulir permintaan adalah halaman transisi — tidak boleh terindeks.
 */
export const metadata: Metadata = noIndexMetadata("Ajukan Permintaan", "/request");

export default function RequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
