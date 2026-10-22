import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getClientIp } from "@/lib/visitor";
import { rateLimitedShared } from "@/lib/rate-limit";
import { getPublicUrl, getUploadUrl } from "@/lib/storage";
import {
  PUBLIC_UPLOAD_MAX_BYTES,
  PUBLIC_UPLOAD_PREFIX,
  PUBLIC_UPLOAD_TYPES,
} from "@/lib/public-upload";

export const runtime = "nodejs";

const bodySchema = z.object({
  contentType: z.enum(
    Object.keys(PUBLIC_UPLOAD_TYPES) as [keyof typeof PUBLIC_UPLOAD_TYPES],
    { error: "Hanya gambar JPG, PNG, atau WebP yang diperbolehkan" }
  ),
  size: z
    .number({ error: "Ukuran file wajib diisi" })
    .int()
    .positive("Ukuran file tidak valid")
    .max(PUBLIC_UPLOAD_MAX_BYTES, "Ukuran gambar maksimal 5 MB"),
});

/**
 * Presigned URL untuk gambar referensi permintaan customize (tanpa login).
 * Nama file dibuat server (acak) dan ukuran ikut ditandatangani.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers) ?? "unknown";
    if (await rateLimitedShared(`public-upload:${ip}`, 20, 10 * 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak unggahan. Coba lagi beberapa menit lagi." },
        { status: 429 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const { contentType, size } = parsed.data;
    const key = `${PUBLIC_UPLOAD_PREFIX}${randomBytes(16).toString("hex")}.${PUBLIC_UPLOAD_TYPES[contentType]}`;
    const uploadUrl = await getUploadUrl(key, contentType, size);

    return NextResponse.json({ uploadUrl, publicUrl: getPublicUrl(key) });
  } catch (err) {
    console.error("Public upload error:", err);
    return NextResponse.json({ error: "Gagal menyiapkan unggahan" }, { status: 500 });
  }
}
