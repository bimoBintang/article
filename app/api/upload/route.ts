import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { getUploadUrl, getPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";

/** Jenis file yang boleh diunggah admin: gambar produk dan model 3D. SVG sengaja tidak termasuk (bisa memuat skrip). */
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "model/gltf-binary",
  "model/gltf+json",
] as const;

const bodySchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_TYPES, { error: "Jenis file tidak diperbolehkan" }),
});

/**
 * Nama file aman untuk kunci object storage: tanpa path/spasi/karakter aneh,
 * ditambah akhiran acak supaya unggahan tidak pernah menimpa file yang sudah ada.
 */
function toStorageKey(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "file";
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80) || "file";
  const ext = dot > 0 ? base.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 8) : "";
  return `${stem}-${randomBytes(4).toString("hex")}${ext ? `.${ext}` : ""}`;
}

/** Presigned URL unggahan untuk admin (gambar dan model 3D produk). */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "fileName dan contentType wajib diisi" },
        { status: 400 }
      );
    }

    const key = toStorageKey(parsed.data.fileName);
    const uploadUrl = await getUploadUrl(key, parsed.data.contentType);

    return NextResponse.json({ uploadUrl, fileName: key, publicUrl: getPublicUrl(key) });
  } catch (err) {
    console.error("Upload URL error:", err);
    return NextResponse.json({ error: "Gagal menyiapkan unggahan" }, { status: 500 });
  }
}
