import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { deliverEmail, resendBase } from "@/lib/email";
import { getEmailConfig } from "@/lib/email-settings";
import { sampleEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), to: z.email({ error: "Format email tujuan tidak valid" }) }),
  z.object({ action: z.literal("domains") }),
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
      if (!config.apiKey) {
        return NextResponse.json({ error: "API key Resend belum diatur" }, { status: 400 });
      }
      const res = await fetch(`${resendBase()}/domains`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      }).catch(() => null);
      if (!res) {
        return NextResponse.json({ error: "Tidak dapat menghubungi Resend" }, { status: 502 });
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: res.status === 401 || res.status === 403 ? "API key ditolak Resend" : `Resend menolak (${res.status})` },
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
    const result = await deliverEmail({
      to: parsed.data.to,
      subject: `[Uji] ${sample.subject}`,
      html: sample.html,
      text: sample.text,
    });

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
