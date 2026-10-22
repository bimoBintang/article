/**
 * Aturan upload gambar referensi dari pengunjung (tanpa login).
 * Data murni: dipakai endpoint upload, klien, dan validasi permintaan.
 */
export const PUBLIC_UPLOAD_PREFIX = "requests/";
export const PUBLIC_UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PUBLIC_UPLOAD_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type PublicUploadType = keyof typeof PUBLIC_UPLOAD_TYPES;

/** Batas jumlah referensi per permintaan customize. */
export const MAX_REFERENCE_IMAGES = 5;
export const MAX_REFERENCE_LINKS = 5;
