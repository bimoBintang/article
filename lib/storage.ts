import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

/**
 * Konfigurasi Neon Object Storage (S3-compatible).
 * Isi di .env.local:
 *   OBJECT_STORAGE_ENDPOINT   - Endpoint S3 dari Neon
 *   OBJECT_STORAGE_BUCKET     - Nama bucket (default: "uploads")
 *   OBJECT_STORAGE_ACCESS_KEY - Access key
 *   OBJECT_STORAGE_SECRET_KEY - Secret key
 *   OBJECT_STORAGE_PUBLIC_URL - Base URL publik untuk mengakses file
 */

const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
const bucket = process.env.OBJECT_STORAGE_BUCKET || "uploads";
const accessKey = process.env.OBJECT_STORAGE_ACCESS_KEY;
const secretKey = process.env.OBJECT_STORAGE_SECRET_KEY;
const publicUrl = process.env.OBJECT_STORAGE_PUBLIC_URL;

const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  credentials: {
    accessKeyId: accessKey || "",
    secretAccessKey: secretKey || "",
  },
  forcePathStyle: true,
});

/**
 * Generate presigned PUT URL untuk upload file langsung dari frontend ke object storage.
 * @param fileName Nama file di bucket (mis. "products/abc123.jpg")
 * @param contentType MIME type file
 * @returns URL yang bisa digunakan frontend untuk PUT file
 */
export async function getUploadUrl(
  fileName: string,
  contentType: string,
  /** Bila diisi, ukuran ikut ditandatangani sehingga PUT dengan ukuran lain ditolak storage. */
  contentLength?: number
): Promise<string> {
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error(
      "Konfigurasi Object Storage belum lengkap. Isi OBJECT_STORAGE_ENDPOINT, " +
        "OBJECT_STORAGE_ACCESS_KEY, dan OBJECT_STORAGE_SECRET_KEY di .env.local"
    );
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileName,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 menit
  return url;
}

/**
 * Dapatkan URL publik untuk mengakses file yang sudah diunggah.
 * Path publik Neon Object Storage: {endpoint}/{bucket}/{key}
 * - Jika OBJECT_STORAGE_PUBLIC_URL sudah memuat bucket, tidak ditambahkan lagi.
 * - Jika kosong, fallback ke endpoint + bucket.
 * @param fileName Nama file di bucket (key)
 * @returns URL publik
 */
export function getPublicUrl(fileName: string): string {
  const base = (publicUrl || endpoint || "").replace(/\/+$/, "");
  if (!base) return "";

  const hasBucket = base.endsWith(`/${bucket}`);
  return hasBucket ? `${base}/${fileName}` : `${base}/${bucket}/${fileName}`;
}

/**
 * Hapus file dari object storage.
 * @param fileName Nama file di bucket
 */
export async function deleteFile(fileName: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileName,
    });
    await s3.send(command);
  } catch (err) {
    console.error("Delete error:", err);
  }
}

/**
 * Ekstrak fileName dari URL publik.
 * @param url URL publik file
 * @returns fileName (key di bucket)
 */
export function extractFileName(url: string): string | null {
  try {
    // Coba ekstrak dari path setelah nama bucket
    const bucketPattern = new RegExp(`/${bucket}/(.+)$`);
    const match = url.match(bucketPattern);
    if (match) return match[1];

    // Fallback: ambil segment terakhir setelah /
    const parts = url.split("/");
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}
