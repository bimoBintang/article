import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { deliverEmail, describeResendError, resendBase } from "@/lib/email";
import { getEmailConfig } from "@/lib/email-settings";
import { sampleEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// Isian formulir yang belum disimpan boleh dipakai untuk uji; tidak pernah disimpan oleh endpoint ini
const apiKeyField = z.string().trim().max(200).optional();
const optionalEmail = z.union([z.literal(""), z.email({ error: "Format alamat tidak valid" })]).optional();

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    to: z.email({ error: "Format email tujuan tidak valid" }),
    apiKey: apiKeyField,
    fromName: z.string().trim().max(80).optional(),
    fromAddress: optionalEmail,
    replyTo: optionalEmail,
  }),
  z.object({ action: z.literal("domains"), apiKey: apiKeyField }),
]);

// Batas sederhana per proses: mencegah tombol "kirim email uji" dipakai membanjiri Resend
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
let recent: number[] = [];

/**
 * Uji konfigurasi: kirim email contoh ke alamat tertentu, atau ambil daftar
 * domain Resend beserta status verifikasinya.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const now = Date.now();
    recent = recent.filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
      return NextResponse.json(
        { error: "Terlalu sering. Coba lagi sebentar lagi." },
        { status: 429 }
      );
    }
    recent.push(now);

    const config = await getEmailConfig();

    if (parsed.data.action === "domains") {
      const apiKey = parsed.data.apiKey || config.apiKey;
      if (!apiKey) {
        return NextResponse.json(
          { error: "API key Resend belum diisi. Tempel key di kolom API key lalu klik Cek domain lagi." },
          { status: 400 }
        );
      }
      const res = await fetch(`${resendBase()}/domains`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => null);
      if (!res) {
        return NextResponse.json({ error: "Tidak dapat menghubungi Resend" }, { status: 502 });
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: describeResendError(res.status, await res.text().catch(() => "")) },
          { status: 502 }
        );
      }
      const json = await res.json().catch(() => ({}));
      const domains = Array.isArray(json?.data)
        ? json.data.map((d: { name?: string; status?: string }) => ({
            name: String(d.name ?? ""),
            status: String(d.status ?? ""),
          }))
        : [];
      return NextResponse.json({ domains });
    }

    const sample = sampleEmail("confirmation", config.brand);
    const result = await deliverEmail(
      {
        to: parsed.data.to,
        subject: `[Uji] ${sample.subject}`,
        html: sample.html,
        text: sample.text,
      },
      {
        apiKey: parsed.data.apiKey || undefined,
        fromName: parsed.data.fromName,
        fromAddress: parsed.data.fromAddress || undefined,
        replyTo: parsed.data.replyTo,
      }
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      provider: result.provider,
      message:
        result.provider === "fallback"
          ? "API key belum diatur, email hanya dicatat di log server."
          : "Email uji terkirim.",
    });
  } catch (err) {
    console.error("Email test error:", err);
    return NextResponse.json({ error: "Gagal menjalankan uji email" }, { status: 500 });
  }
}
