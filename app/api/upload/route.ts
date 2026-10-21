import { NextResponse } from "next/server";
import { getUploadUrl, getPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName dan contentType wajib diisi" },
        { status: 400 }
      );
    }

    // Simpan langsung di root bucket "uploads" tanpa subfolder
    const key = fileName;

    const uploadUrl = await getUploadUrl(key, contentType);

    return NextResponse.json(
      {
        uploadUrl,
        fileName: key,
        publicUrl: getPublicUrl(key),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Upload URL error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal generate upload URL" },
      { status: 500 }
    );
  }
}
