"use client";

import { Package, Users, Save, Settings2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/lib/use-settings";
import type { PublicSettings } from "@/lib/settings";

type Toggle = {
  key: keyof PublicSettings;
  title: string;
  description: string;
  icon: typeof Package;
  affected: string;
};

const TOGGLES: Toggle[] = [
  {
    key: "show_product_price",
    title: "Tampilkan Harga Produk",
    description:
      "Harga dasar produk (Harga Dasar) di katalog, halaman detail produk, dan keranjang.",
    icon: Package,
    affected:
      " disembunyikan di beranda, katalog, detail produk, keranjang, dan tabel admin Produk.",
  },
  {
    key: "show_package_price",
    title: "Tampilkan Harga Paket",
    description:
      "Harga paket pemotretan (Basic, Standard, Premium) di halaman detail produk dan keranjang.",
    icon: Save,
    affected:
      " disembunyikan di detail produk, keranjang, tabel admin Paket, dan total estimasi permintaan.",
  },
  {
    key: "show_additional_fee",
    title: "Tampilkan Tarif Tambahan",
    description:
      "Biaya tambahan per model/talent (Tarif Tambahan) di halaman detail produk.",
    icon: Users,
    affected:
      " disembunyikan di detail produk, tabel admin Model, dan isian tarif tambahan.",
  },
];

export default function AdminSettingsPage() {
  const { settings, loading, savingKey, error, success, update } =
    useSettings(true);

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" title="Gagal">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" title="Berhasil">
          {success}
        </Alert>
      )}

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
          <Settings2 className="h-5 w-5 text-primary" />
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Atur elemen tampilan website. Perubahan langsung berlaku setelah
          disimpan.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-3 h-3 w-full max-w-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {TOGGLES.map((toggle, index) => (
            <div
              key={toggle.key}
              className={`flex items-start justify-between gap-4 p-5 ${
                index > 0
                  ? "border-t border-zinc-100 dark:border-zinc-800"
                  : ""
              }`}
            >
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <toggle.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p
                    id={`label-${toggle.key}`}
                    className="block text-sm font-semibold text-foreground"
                  >
                    {toggle.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {toggle.description}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Saat dimatikan, nilai{toggle.affected}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {savingKey === toggle.key && (
                  <span className="text-xs text-zinc-400">Menyimpan…</span>
                )}
                <Switch
                  id={`switch-${toggle.key}`}
                  checked={settings[toggle.key]}
                  onCheckedChange={(v) => update(toggle.key, v)}
                  disabled={savingKey === toggle.key}
                  aria-labelledby={`label-${toggle.key}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Pengaturan yang dimatikan hanya menyembunyikan tampilan. Nominal harga
        tetap tersimpan dan tetap bisa diubah di halaman masing-masing.
      </p>
    </div>
  );
}
