"use client";

import type { Package } from "@/types";
import type { PublicSettings } from "@/lib/settings";
import { displayPrice } from "@/lib/price";
import { CUSTOM_LOOK_RANGE, CUSTOM_PHOTO_RANGE } from "@/lib/model-gender";

/** Nilai khusus pilihan paket "Sesuai kebutuhan" (bukan id paket sungguhan). */
export const CUSTOM_PACKAGE = "custom";

export type PackageSelection = {
  /** id paket, CUSTOM_PACKAGE, atau null bila belum memilih */
  selected: string | null;
  look: string;
  photo: string;
};

export const EMPTY_PACKAGE_SELECTION: PackageSelection = {
  selected: null,
  look: "1",
  photo: "10",
};

/** Ubah isian angka menjadi bilangan bulat dalam rentang; null bila kosong/di luar batas. */
export function parseCount(
  value: string,
  range: { min: number; max: number }
): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= range.min && n <= range.max ? n : null;
}

export type ResolvedPackage =
  | {
      ok: true;
      packageId: string | null;
      customLookCount: number | null;
      customPhotoCount: number | null;
    }
  | { ok: false; error: string };

/** Validasi pilihan paket dan ubah menjadi nilai yang dikirim ke keranjang/API. */
export function resolvePackageSelection(sel: PackageSelection): ResolvedPackage {
  if (!sel.selected) {
    return { ok: false, error: "Silakan pilih paket terlebih dahulu." };
  }
  if (sel.selected !== CUSTOM_PACKAGE) {
    return { ok: true, packageId: sel.selected, customLookCount: null, customPhotoCount: null };
  }
  const look = parseCount(sel.look, CUSTOM_LOOK_RANGE);
  if (look === null) {
    return {
      ok: false,
      error: `Jumlah look harus berupa angka ${CUSTOM_LOOK_RANGE.min} sampai ${CUSTOM_LOOK_RANGE.max}.`,
    };
  }
  const photo = parseCount(sel.photo, CUSTOM_PHOTO_RANGE);
  if (photo === null) {
    return {
      ok: false,
      error: `Jumlah foto harus berupa angka ${CUSTOM_PHOTO_RANGE.min} sampai ${CUSTOM_PHOTO_RANGE.max}.`,
    };
  }
  return { ok: true, packageId: null, customLookCount: look, customPhotoCount: photo };
}

/** Ringkasan isi paket: "3 look • 25 foto"; bagian yang kosong dilewati. */
export function packageSummary(pkg: Package): string {
  return [
    pkg.look_count != null ? `${pkg.look_count} look` : null,
    pkg.photo_count != null ? `${pkg.photo_count} foto` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

/**
 * Pilihan Paket Pemotretan: kartu paket + opsi "Sesuai kebutuhan" dengan
 * isian jumlah look dan foto. Dipakai halaman produk dan form Customize.
 */
export function PackagePicker({
  packages,
  settings,
  value,
  onChange,
}: {
  packages: Package[];
  settings: Pick<PublicSettings, "show_package_price">;
  value: PackageSelection;
  onChange: (next: PackageSelection) => void;
}) {
  const isCustom = value.selected === CUSTOM_PACKAGE;

  return (
    <div className="mt-4 space-y-4">
      <label className="mb-2 block text-sm font-semibold text-zinc-700">
        Paket Pemotretan
      </label>
      <div className="space-y-2">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onChange({ ...value, selected: pkg.id })}
            aria-pressed={value.selected === pkg.id}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-all ${
              value.selected === pkg.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-zinc-200 hover:border-zinc-300 bg-white "
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium">{pkg.name}</div>
              {packageSummary(pkg) && (
                <div className="text-xs text-zinc-500">{packageSummary(pkg)}</div>
              )}
            </div>
            <span className="shrink-0 font-semibold">
              {displayPrice(pkg.base_price, settings.show_package_price)}
            </span>
          </button>
        ))}

        {/* Bukan paket: jumlah look dan foto ditentukan client */}
        <div
          className={`rounded-lg border transition-all ${
            isCustom
              ? "border-primary bg-primary/5"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <button
            type="button"
            onClick={() => onChange({ ...value, selected: CUSTOM_PACKAGE })}
            aria-pressed={isCustom}
            className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm"
          >
            <div className="min-w-0">
              <div className={`font-medium ${isCustom ? "text-primary" : ""}`}>
                Sesuai kebutuhan
              </div>
              <div className="text-xs text-zinc-500">
                Tentukan sendiri jumlah look dan foto
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-zinc-600">
              Disepakati admin
            </span>
          </button>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3 border-t border-primary/20 p-3">
              <div>
                <label
                  htmlFor="custom-look"
                  className="mb-1 block text-xs font-medium text-zinc-600"
                >
                  Jumlah look
                </label>
                <input
                  id="custom-look"
                  type="number"
                  inputMode="numeric"
                  min={CUSTOM_LOOK_RANGE.min}
                  max={CUSTOM_LOOK_RANGE.max}
                  value={value.look}
                  onChange={(e) => onChange({ ...value, look: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="custom-photo"
                  className="mb-1 block text-xs font-medium text-zinc-600"
                >
                  Jumlah foto
                </label>
                <input
                  id="custom-photo"
                  type="number"
                  inputMode="numeric"
                  min={CUSTOM_PHOTO_RANGE.min}
                  max={CUSTOM_PHOTO_RANGE.max}
                  value={value.photo}
                  onChange={(e) => onChange({ ...value, photo: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="col-span-2 text-xs text-zinc-500">
                Harga untuk pilihan ini disepakati dengan admin dan tidak ikut
                total estimasi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
