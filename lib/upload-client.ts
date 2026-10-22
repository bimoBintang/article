"use client";

/**
 * Helper upload file ke object storage via presigned URL.
 * Dipakai untuk gambar (thumbnail, poster) maupun model 3D (.glb).
 */

const GLB_MIME = "model/gltf-binary";
const GLTF_MIME = "model/gltf+json";

/** Deteksi MIME type dari ekstensi file (fallback bila browser tidak mendeteksi). */
export function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "glb") return GLB_MIME;
  if (ext === "gltf") return GLTF_MIME;
  return "application/octet-stream";
}

/** Format ukuran file menjadi string yang mudah dibaca. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export type UploadResult = {
  url: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
};

/* ------------------------------------------------------------------ *
 * Kompresi gambar
 *
 * Object storage Neon melambat drastis untuk file besar (>1 MB butuh
 * >30 detik). Selain merusak UX, image optimizer Next.js punya batas
 * 7 detik untuk ambil file asal sehingga gambar besar gagal dimuat
 * (504). Solusinya: perkecil + kompres gambar di browser SEBELUM
 * diunggah, sehingga file yang tersimpan ringan (<= ~700 KB). Kualitas dijaga setinggi
 * mungkin di dalam anggaran itu; gambar yang sudah ringan tidak dikompres ulang.
 * ------------------------------------------------------------------ */

/** Dimensi maksimal sisi gambar (px). Cukup tajam untuk zoom/lightbox di layar retina. */
export const IMAGE_MAX_DIMENSION = 2400;
/**
 * Anggaran ukuran file hasil. Object storage Neon lambat (terukur ~190 KB/detik saat
 * unduh) dan image optimizer Next.js hanya menunggu ~7 detik untuk mengambil file asal:
 * file 800 KB butuh ~5 detik, 1,4 MB sudah ~7,3 detik. Anggaran 700 KB menyisakan
 * ruang aman; kualitas diturunkan hanya sejauh yang diperlukan agar muat.
 */
export const IMAGE_BYTE_BUDGET = 700 * 1024;
/** Kualitas WebP tertinggi yang dicoba lebih dulu (0-1). */
export const IMAGE_QUALITY = 0.92;

/** Tangga kualitas: dimulai tinggi, turun hanya bila file belum muat anggaran. */
const QUALITY_LADDER = [IMAGE_QUALITY, 0.88, 0.84, 0.8];
/** Dimensi cadangan bila kualitas 0.8 pun belum muat anggaran. */
const DIMENSION_FALLBACKS = [2000, 1600];
/** Format yang cukup baik untuk dikirim apa adanya bila sudah ringan dan tidak berlebihan dimensinya. */
const KEEP_AS_IS = /^image\/(jpeg|png|webp|avif)$/;

type CompressOptions = {
  maxDimension?: number;
  byteBudget?: number;
};

/**
 * Apakah JPEG memuat segmen EXIF (kamera, orientasi, dan sering lokasi GPS)?
 * File ber-EXIF selalu di-encode ulang agar metadata hilang dan orientasi tertanam.
 */
async function hasExif(file: File): Promise<boolean> {
  if (file.type !== "image/jpeg") return false;
  const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return false;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return false;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) return false; // data gambar dimulai; tidak ada EXIF lagi
    // APP1 yang diawali "Exif"
    if (marker === 0xe1 && offset + 8 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      return true;
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return false;
}

/**
 * Perkecil ke ukuran target dengan kualitas tinggi. Skala turun besar dilakukan
 * bertahap (dibagi dua berulang) karena satu langkah besar membuat tepi bergerigi.
 */
function drawScaled(bitmap: ImageBitmap, targetW: number, targetH: number): HTMLCanvasElement | null {
  let source: CanvasImageSource = bitmap;
  let w = bitmap.width;
  let h = bitmap.height;

  const step = (toW: number, toH: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = toW;
    canvas.height = toH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, toW, toH);
    return canvas;
  };

  while (w / 2 >= targetW && h / 2 >= targetH) {
    const half = step(Math.round(w / 2), Math.round(h / 2));
    if (!half) return null;
    source = half;
    w = half.width;
    h = half.height;
  }
  return step(targetW, targetH);
}

/**
 * Siapkan gambar untuk diunggah dengan kehilangan kualitas sekecil mungkin.
 *
 * 1. Gambar yang sudah ringan (<= anggaran), tidak berlebihan dimensinya, dan tanpa EXIF
 *    dikirim APA ADANYA: tidak ada kompres ulang, jadi tidak ada penurunan kualitas.
 * 2. Selain itu di-encode ke WebP. PNG (poster, teks, grafis) dicoba lossless dulu;
 *    sisanya kualitas 0.92 dan baru diturunkan bertahap bila belum muat anggaran,
 *    lalu dimensi diturunkan sebagai cadangan terakhir.
 * Bila browser tidak mendukung Canvas/encode, file asli dikembalikan.
 */
export async function compressImage(
  file: File,
  { maxDimension = IMAGE_MAX_DIMENSION, byteBudget = IMAGE_BYTE_BUDGET }: CompressOptions = {}
): Promise<File> {
  // bukan gambar -> biarkan apa adanya
  if (!file.type.startsWith("image/")) return file;

  // SVG & GIF: kompresi lossy tidak cocok
  if (/svg\+xml|gif/i.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const longest = Math.max(width, height);

  try {
    if (
      longest <= maxDimension &&
      file.size <= byteBudget &&
      KEEP_AS_IS.test(file.type) &&
      !(await hasExif(file))
    ) {
      return file;
    }

    // Dimensi yang dicoba berurutan: sedekat mungkin dengan aslinya, lalu cadangan lebih kecil
    const firstDimension = Math.min(longest, maxDimension);
    const dimensions = [firstDimension, ...DIMENSION_FALLBACKS.filter((d) => d < firstDimension)];
    const isPng = file.type === "image/png";

    let smallest: Blob | null = null;
    for (const [index, dimension] of dimensions.entries()) {
      const scale = dimension / longest;
      const canvas = drawScaled(
        bitmap,
        Math.max(1, Math.round(width * scale)),
        Math.max(1, Math.round(height * scale))
      );
      if (!canvas) return file;

      // Grafis/teks: WebP lossless (kualitas 1) mempertahankan setiap piksel
      if (isPng && index === 0) {
        const lossless = await canvasToBlob(canvas, 1, "image/webp");
        if (lossless && lossless.type === "image/webp" && lossless.size <= byteBudget) {
          return toFile(lossless, file);
        }
      }

      for (const quality of QUALITY_LADDER) {
        const blob = await canvasToBlob(canvas, quality);
        if (!blob) return file;
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= byteBudget) return toFile(blob, file);
      }
    }

    return smallest ? toFile(smallest, file) : file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

function toFile(blob: Blob, original: File): File {
  const newName = original.name.replace(/\.[^.]+$/, "") + "." + extFromMime(blob.type);
  return new File([blob], newName, { type: blob.type, lastModified: Date.now() });
}

/** Konversi canvas menjadi Blob WebP (atau tipe lain bila diminta), fallback ke JPEG bila WebP tidak didukung. */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  type: "image/webp" | "image/jpeg" = "image/webp"
): Promise<Blob | null> {
  const first = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality)
  );
  // Browser lama tidak mendukung WebP -> toBlob mengembalikan PNG; pakai JPEG sebagai gantinya
  if (first && first.type === type && first.size > 0) return first;
  if (type === "image/webp" && quality === 1) return first; // lossless tidak tersedia: biarkan pemanggil memutuskan

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
}

/** Ekstensi file dari MIME type. */
function extFromMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

/**
 * Upload file ke object storage dan kembalikan URL publiknya.
 * Gambar otomatis dikompresi terlebih dahulu.
 * @param file File yang diunggah
 * @param prefix Prefiks nama file (mis. "model", "poster")
 */
export async function uploadToStorage(
  file: File,
  prefix?: string
): Promise<UploadResult> {
  let outFile = file;
  let contentType = resolveContentType(file);

  if (contentType.startsWith("image/")) {
    try {
      outFile = await compressImage(file);
      contentType = outFile.type;
    } catch (err) {
      console.warn("Kompresi gambar gagal, memakai file asli:", err);
    }
  }

  const safeName = outFile.name.replace(/\s+/g, "_");
  const fileName = prefix
    ? `${prefix}-${Date.now()}-${safeName}`
    : `${Date.now()}-${safeName}`;

  // Step 1: minta presigned URL
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Gagal generate upload URL");
  }

  // Server menambah akhiran acak pada nama file; pakai nama yang dikembalikan
  const { uploadUrl, publicUrl, fileName: storedName } = await res.json();

  // Step 2: upload langsung ke object storage
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: outFile,
    headers: { "Content-Type": contentType },
  });

  if (!putRes.ok) {
    throw new Error(`Upload gagal (${putRes.status})`);
  }

  return {
    url: publicUrl || uploadUrl,
    fileName: storedName ?? fileName,
    sizeBytes: outFile.size,
    contentType,
  };
}

/** Buka dialog file picker dan kembalikan File yang dipilih (null jika dibatalkan). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    // Dilampirkan ke DOM agar .click() konsisten di semua browser
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    const cleanup = () => input.remove();

    input.onchange = () => {
      const file = input.files?.[0] || null;
      cleanup();
      resolve(file);
    };
    // Terpanggil saat user menutup dialog tanpa memilih file
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };

    input.click();
  });
}

/** Buka dialog file picker multi-select dan kembalikan array File. */
export function pickFiles(accept: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    const cleanup = () => input.remove();

    input.onchange = () => {
      const files = Array.from(input.files || []);
      cleanup();
      resolve(files);
    };
    input.oncancel = () => {
      cleanup();
      resolve([]);
    };

    input.click();
  });
}

/**
 * Upload gambar referensi dari pengunjung lewat endpoint publik terbatas.
 * Gambar dikompresi dulu; ukuran hasil kompresi itulah yang ditandatangani.
 */
export async function uploadPublicImage(file: File): Promise<string> {
  let outFile = file;
  try {
    outFile = await compressImage(file);
  } catch {
    /* pakai file asli; server tetap membatasi tipe dan ukuran */
  }
  const contentType = outFile.type || resolveContentType(outFile);

  const res = await fetch("/api/public/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, size: outFile.size }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal menyiapkan unggahan");

  const putRes = await fetch(data.uploadUrl, {
    method: "PUT",
    body: outFile,
    headers: { "Content-Type": contentType },
  });
  if (!putRes.ok) throw new Error(`Unggahan gagal (${putRes.status})`);
  return data.publicUrl as string;
}
