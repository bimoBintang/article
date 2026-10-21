import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

/**
 * Halaman autentikasi tidak boleh terindeks di search engine.
 */
export const metadata: Metadata = noIndexMetadata("Masuk Admin", "/login");

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
