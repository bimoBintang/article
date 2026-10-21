import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getSql, query } from "@/lib/db";
import { generateRequestNumber } from "@/lib/auth";
import { sendEmail, requestConfirmationEmail, adminNewRequestEmail } from "@/lib/email";

export const runtime = "nodejs";

const itemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  packageId: z.string().uuid().nullable().optional(),
  talentId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().positive().max(100).default(1),
});

const requestSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  whatsapp: z
    .string()
    .min(10, "Nomor WhatsApp minimal 10 digit")
    .refine(
      (val) => /^(\+62|62|0)[0-9]{9,13}$/.test(val.replace(/\s/g, "")),
      "Format nomor WhatsApp Indonesia tidak valid"
    ),
  brandName: z.string().max(255).nullable().optional(),
  preferredDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  consent: z.literal(true, {
    error: "Anda harus menyetujui pengolahan data pribadi",
  }),
  items: z.array(itemSchema).max(50).default([]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      const field = issue?.path?.length ? issue.path.join(".") : undefined;
      return NextResponse.json(
        {
          error: issue?.message || "Input tidak valid",
          ...(field ? { field } : {}),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const requestNumber = generateRequestNumber();
    const statusToken = randomBytes(32).toString("hex");

    // Hitung total dari data database (server-side, tidak dipercaya dari client)
    let totalEstimated = 0;
    const itemDetails: Array<{
      product: string | null;
      package: string | null;
      talent: string | null;
      quantity: number;
      estimatedPrice: number;
    }> = [];

    const packageIds = data.items
      .map((i) => i.packageId)
      .filter((id): id is string => Boolean(id));

    const packagePrices: Record<string, number> = {};
    if (packageIds.length > 0) {
      const rows = await query<{ id: string; base_price: number }>(
        `SELECT id, base_price FROM packages WHERE id = ANY($1)`,
        [packageIds]
      );
      rows.forEach((r) => (packagePrices[r.id] = r.base_price));
    }

    for (const item of data.items) {
      const price = item.packageId ? packagePrices[item.packageId] || 0 : 0;
      totalEstimated += price * item.quantity;
      itemDetails.push({
        product: item.productId ?? null,
        package: item.packageId ?? null,
        talent: item.talentId ?? null,
        quantity: item.quantity,
        estimatedPrice: price,
      });
    }

    // Simpan ke database
    const sql = getSql();
    const result = await sql`
      INSERT INTO requests (number, status, customer_name, customer_email, customer_whatsapp, brand_name, preferred_date, notes, personal_data_consent, status_token, total_estimated)
      VALUES (${requestNumber}, 'SUBMITTED', ${data.name}, ${data.email}, ${data.whatsapp}, ${data.brandName || null}, ${data.preferredDate || null}, ${data.notes || null}, ${data.consent}, ${statusToken}, ${totalEstimated || null})
      RETURNING id
    `;
    const requestId = (result as any[])[0]?.id;

    if (!requestId) {
      throw new Error("Gagal membuat permintaan");
    }

    for (const item of itemDetails) {
      await sql`
        INSERT INTO request_items (request_id, product_id, package_id, talent_id, quantity, estimated_price)
        VALUES (${requestId}, ${item.product}, ${item.package}, ${item.talent}, ${item.quantity}, ${item.estimatedPrice})
      `;
    }

    await sql`
      INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
      VALUES (${requestId}, null, 'SUBMITTED', 'sistem', 'Permintaan disubmit pelanggan')
    `;

    // Kirim email konfirmasi ke pelanggan
    const customerEmail = requestConfirmationEmail({
      customerName: data.name,
      requestNumber,
      items: itemDetails.map((i) => ({
        product: i.product,
        package: i.package,
        talent: i.talent,
        quantity: i.quantity,
      })),
      total: totalEstimated,
    });
    await sendEmail({
      to: data.email,
      subject: customerEmail.subject,
      html: customerEmail.html,
      text: customerEmail.text,
    });

    // Kirim notifikasi ke admin
    const adminEmail = adminNewRequestEmail({
      adminEmail: process.env.ADMIN_EMAIL || "admin@ekatalog.local",
      requestNumber,
      customerName: data.name,
      items: itemDetails.map((i) => ({
        product: i.product,
        package: i.package,
        talent: i.talent,
        quantity: i.quantity,
      })),
      total: totalEstimated,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/requests`,
    });
    await sendEmail({
      to: process.env.ADMIN_EMAIL || "admin@ekatalog.local",
      subject: adminEmail.subject,
      html: adminEmail.html,
      text: adminEmail.text,
    });

    return NextResponse.json({ success: true, requestNumber }, { status: 201 });
  } catch (err) {
    console.error("Submit request error:", err);
    return NextResponse.json(
      { error: "Gagal mengirim permintaan. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
