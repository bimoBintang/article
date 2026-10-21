import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-sidebar";
import { noIndexMetadata } from "@/lib/seo";

/**
 * Area admin tidak boleh terindeks di search engine.
 */
export const metadata: Metadata = noIndexMetadata("Panel Admin", "/admin");

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
