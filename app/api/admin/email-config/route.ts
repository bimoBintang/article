import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import {
  getEmailConfigPublic,
  parseRecipients,
  saveEmailConfig,
} from "@/lib/email-settings";

export const dynamic = "force-dynamic";

const optionalEmail = z.union([z.literal(""), z.email({ error: "Format email tidak valid" })]);

const bodySchema = z.object({
  // Kosong = pertahankan key tersimpan
  apiKey: z.string().trim().max(200).optional(),
  clearApiKey: z.boolean().optional(),
  fromName: z.string().trim().max(80, { error: "Nama pengirim maksimal 80 karakter" }),
  fromAddress: optionalEmail,
  replyTo: optionalEmail,
  adminRecipients: z
    .string()
    .max(500, { error: "Daftar penerima terlalu panjang" })
    .refine(
      (v) => v.split(/[,;\s]+/).filter(Boolean).length === parseRecipients(v).length,
      { error: "Ada alamat penerima admin yang tidak valid" }
    ),
  brandName: z.string().trim().max(60, { error: "Nama brand maksimal 60 karakter" }),
  accent: z.union([
    z.literal(""),
    z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Warna aksen harus berformat #rrggbb" }),
  ]),
  footerNote: z.string().trim().max(200, { error: "Catatan footer maksimal 200 karakter" }),
});

/** Konfigurasi email untuk admin. API key tidak pernah ikut terkirim, hanya versi tersamar. */
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { config: await getEmailConfigPublic() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Fetch email config error:", err);
    return NextResponse.json({ error: "Gagal memuat konfigurasi email" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    await saveEmailConfig(parsed.data);
    return NextResponse.json({ config: await getEmailConfigPublic() });
  } catch (err) {
    console.error("Update email config error:", err);
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi email" }, { status: 500 });
  }
}
