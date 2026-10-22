/**
 * Optimasi gambar yang sudah tersimpan di Neon Object Storage.
 *
 * Latar belakang: object storage Neon sangat lambat untuk file besar
 * (>1 MB bisa Requires >30 detik). Image optimizer Next.js punya batas
 * 7 detik untuk mengambil file asal sehingga gambar besar gagal dimuat
 * (504). Script ini mengunduh gambar lama, memotong + mengompresnya
 * dengan sharp, mengunggah hasilnya, lalu memperbarui URL di database
 * dan menghapus file lama.
 *
 * Jalankan:  node scripts/optimize-storage-images.mjs [--dry-run]
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ---------- Load .env.local ---------- */
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    console.warn("⚠ .env.local tidak ditemukan, lanjut dengan env yang ada");
  }
}
loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

const MAX_DIMENSION = 2400;
const QUALITY = 90;
const SKIP_BYTES = 700 * 1024; // sama dengan IMAGE_BYTE_BUDGET di lib/upload-client.ts; di bawah ini jangan dikompres ulang

const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
const bucket = process.env.OBJECT_STORAGE_BUCKET || "uploads";
const publicUrl = process.env.OBJECT_STORAGE_PUBLIC_URL;

if (!endpoint || !process.env.OBJECT_STORAGE_ACCESS_KEY) {
  console.error("❌ Konfigurasi object storage belum lengkap (.env.local)");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY || "",
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

const sql = neon(process.env.DATABASE_URL);

/** Ambil key object dari URL publik. */
function keyFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const prefix = `/${bucket}/`;
    const idx = u.pathname.indexOf(prefix);
    if (idx >= 0) return decodeURIComponent(u.pathname.slice(idx + prefix.length));
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    return null;
  }
}

/** Download file dari storage. */
async function download(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Bangun URL publik, sama seperti getPublicUrl() di lib/storage.ts:
 * bila base URL sudah memuat nama bucket, bucket tidak ditambahkan lagi.
 */
function buildPublicUrl(key) {
  const base = (publicUrl || endpoint || "").replace(/\/+$/, "");
  if (!base) return "";
  const hasBucket = base.endsWith(`/${bucket}`);
  return hasBucket ? `${base}/${key}` : `${base}/${bucket}/${key}`;
}

/** Daftar file gambar yang direferensikan di database. */
async function collectTargets() {
  const [products, images, talents] = await Promise.all([
    sql.query(
      `SELECT id::text, thumbnail_url FROM products WHERE thumbnail_url IS NOT NULL`
    ),
    sql.query(
      `SELECT id::text, image_url FROM product_images WHERE image_url IS NOT NULL`
    ),
    sql.query(`SELECT id::text, photo_url FROM talents WHERE photo_url IS NOT NULL`),
  ]);

  const targets = [];
  for (const p of products) {
    targets.push({
      table: "products",
      id: p.id,
      column: "thumbnail_url",
      url: p.thumbnail_url,
    });
  }
  for (const i of images) {
    targets.push({
      table: "product_images",
      id: i.id,
      column: "image_url",
      url: i.image_url,
    });
  }
  for (const t of talents) {
    targets.push({
      table: "talents",
      id: t.id,
      column: "photo_url",
      url: t.photo_url,
    });
  }
  return targets;
}

async function main() {
  console.log("📦 Memeriksa gambar di object storage...\n");
  const targets = await collectTargets();

  let optimized = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    const key = keyFromUrl(target.url);
    if (!key) {
      console.log(`  ⚠ URL tidak bisa dipetakan: ${target.url}`);
      continue;
    }

    let buffer;
    try {
      buffer = await download(key);
    } catch (err) {
      console.log(`  ✗ gagal unduh ${key}: ${err.message}`);
      failed++;
      continue;
    }

    const before = buffer.length;
    if (before <= SKIP_BYTES) {
      console.log(
        `  ✓ ${key}\n      ${(before / 1024).toFixed(0)} KB — sudah ringan, dilewati`
      );
      skipped++;
      continue;
    }

    // Deteksi dimensi asli
    const meta = await sharp(buffer).metadata();
    const needsResize = Math.max(meta.width || 0, meta.height || 0) > MAX_DIMENSION;

    const out = await sharp(buffer)
      .rotate() // hormati orientasi EXIF
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY })
      .toBuffer();

    const after = out.length;
    const newKey = key.replace(/\.[^.]+$/, "") + ".webp";
    const newUrl = buildPublicUrl(newKey);

    console.log(
      `  → ${key}\n      ${(before / 1024).toFixed(0)} KB (${meta.width}×${meta.height}) → ${(after / 1024).toFixed(0)} KB WebP` +
        `${needsResize ? " [diperkecil]" : ""}`
    );

    if (DRY_RUN) {
      console.log(`      (dry-run) tidak ada perubahan ke storage`);
      optimized++;
      continue;
    }

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: newKey,
          Body: out,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      // Update URL di database
      await sql.query(
        `UPDATE ${target.table} SET ${target.column} = $1 WHERE id = $2`,
        [newUrl, target.id]
      );

      // Hapus file lama (kecuali kalau nama sama)
      if (newKey !== key) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key })
        );
      }

      console.log(`      ✓ tersimpan & URL diperbarui`);
      optimized++;
    } catch (err) {
      console.log(`      ✗ gagal menyimpan: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\n✅ Selesai — ${optimized} dioptimasi, ${skipped} dilewati, ${failed} gagal` +
      (DRY_RUN ? " (DRY RUN, tidak ada perubahan)" : "")
  );
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
