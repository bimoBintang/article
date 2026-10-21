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
 * diunggah, sehingga file yang tersimpan ringan (<= ~300 KB).
 * ------------------------------------------------------------------ */

/** Dimensi maksimal sisi gambar (px). Cukup untuk foto produk & lightbox. */
export const IMAGE_MAX_DIMENSION = 1600;
/** Kualitas kompresi WebP (0-1). */
export const IMAGE_QUALITY = 0.82;
/** Bila file sudah kecil & dimensinya wajar, tidak perlu dikompresi lagi. */
const IMAGE_SKIP_BYTES = 250 * 1024;

type CompressOptions = {
  maxDimension?: number;
  quality?: number;
};

/**
 * Perkecil dan kompres gambar di browser memakai Canvas.
 * Menghasilkan WebP (fallback JPEG bila WebP tidak didukung browser).
 * Bila browser tidak mendukung Canvas API, file asli dikembalikan.
 */
export async function compressImage(
  file: File,
  { maxDimension = IMAGE_MAX_DIMENSION, quality = IMAGE_QUALITY }: CompressOptions = {}
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
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  // Sudah WebP dan ukurannya sudah ringan -> tidak perlu di-encode ulang.
  // File JPG/JPEG/PNG SELALU dikonversi ke WebP, berapa pun ukurannya,
  // supaya format di object storage konsisten.
  const isWebp =
    file.type === "image/webp" || /\.webp$/i.test(file.name || "");
  if (isWebp && file.size <= IMAGE_SKIP_BYTES && scale === 1) {
    bitmap.close();
    return file;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await canvasToBlob(canvas, quality);
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + "." + extFromMime(blob.type);
    return new File([blob], newName, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Konversi canvas menjadi Blob dengan WebP, fallback ke JPEG. */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  const webp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality)
  );
  // Browser lama tidak mendukung WebP -> toBlob mengembalikan null
  if (webp && webp.type === "image/webp" && webp.size > 0) return webp;

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

  const { uploadUrl, publicUrl } = await res.json();

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
    fileName,
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
