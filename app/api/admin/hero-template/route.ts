import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-server";
import { HERO_TEMPLATES, HERO_TEMPLATE_IDS } from "@/lib/hero-templates";
import { getHeroTemplate, setHeroTemplate } from "@/lib/settings";
import { revalidatePublic } from "@/lib/revalidate";

const bodySchema = z.object({
  template: z.enum(HERO_TEMPLATE_IDS, { error: "Template tidak dikenal" }),
});

/** Template hero yang aktif beserta daftar template yang tersedia (khusus admin). */
export async function GET() {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const template = await getHeroTemplate();
    return NextResponse.json({ template, templates: HERO_TEMPLATES });
  } catch (err) {
    console.error("Fetch hero template error:", err);
    return NextResponse.json({ error: "Gagal memuat template hero" }, { status: 500 });
  }
}

/** Ganti template hero beranda. Body: { template: "<id>" } */
export async function PUT(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin) {
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

    await setHeroTemplate(parsed.data.template);
    revalidatePublic();
    return NextResponse.json({ template: parsed.data.template });
  } catch (err) {
    console.error("Update hero template error:", err);
    return NextResponse.json({ error: "Gagal menyimpan template hero" }, { status: 500 });
  }
}
