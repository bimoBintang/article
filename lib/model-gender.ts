/**
 * Pilihan jenis model untuk permintaan pemotretan.
 *
 * Berkas ini sengaja berisi data murni (tanpa import React atau database)
 * supaya aman dipakai di halaman produk, keranjang, API, dan email.
 * Menambah pilihan baru cukup menambah satu entri di sini.
 */
export const MODEL_GENDERS = [
  { value: "male", label: "Pria" },
  { value: "male-female", label: "Pria & Wanita" },
  { value: "female", label: "Wanita" },
  { value: "male-male", label: "Pria & Pria" },
  { value: "female-female", label: "Wanita & Wanita" },
  { value: "mixed", label: "Campur" },
] as const;

export type ModelGender = (typeof MODEL_GENDERS)[number]["value"];

export const MODEL_GENDER_VALUES = MODEL_GENDERS.map((g) => g.value) as [
  ModelGender,
  ...ModelGender[],
];

/** Panjang maksimal catatan untuk model (dipakai form dan validasi server). */
export const MODEL_NOTES_MAX = 300;

export function isModelGender(value: unknown): value is ModelGender {
  return (
    typeof value === "string" &&
    (MODEL_GENDER_VALUES as readonly string[]).includes(value)
  );
}

/** Label tampilan untuk sebuah kode; null bila kosong atau tidak dikenal. */
export function modelGenderLabel(value: string | null | undefined): string | null {
  return MODEL_GENDERS.find((g) => g.value === value)?.label ?? null;
}

/** Batas isian paket "Sesuai kebutuhan". */
export const CUSTOM_LOOK_RANGE = { min: 1, max: 50 } as const;
export const CUSTOM_PHOTO_RANGE = { min: 1, max: 500 } as const;
