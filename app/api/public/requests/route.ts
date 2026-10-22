import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getSql, query } from "@/lib/db";
import { generateRequestNumber } from "@/lib/auth";
import { getPublicUrl } from "@/lib/storage";
import {
  MAX_REFERENCE_IMAGES,
  MAX_REFERENCE_LINKS,
  PUBLIC_UPLOAD_PREFIX,
} from "@/lib/public-upload";
import { sendEmail, requestConfirmationEmail, adminNewRequestEmail } from "@/lib/email";
import { getEmailConfig } from "@/lib/email-settings";
import { encryptPii } from "@/lib/pii";
import { rateLimitedShared } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/seo";
import { getClientIp } from "@/lib/visitor";
import {
  CUSTOM_LOOK_RANGE,
  CUSTOM_PHOTO_RANGE,
  MODEL_GENDER_VALUES,
  MODEL_NOTES_MAX,
  modelGenderLabel,
} from "@/lib/model-gender";

export const runtime = "nodejs";

const itemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  packageId: z.string().uuid().nullable().optional(),
  talentId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().positive().max(100).default(1),
  // Jenis model dan catatannya (opsional)
  modelGender: z
    .enum(MODEL_GENDER_VALUES, { error: "Jenis model tidak dikenal" })
    .nullable()
    .optional(),
  modelNotes: z
    .string()
    .trim()
    .max(MODEL_NOTES_MAX, `Catatan model maksimal ${MODEL_NOTES_MAX} karakter`)
    .nullable()
    .optional(),
  // Opsi "Sesuai kebutuhan": dipakai hanya bila packageId kosong
  customLookCount: z.coerce
    .number()
    .int("Jumlah look harus bilangan bulat")
    .min(CUSTOM_LOOK_RANGE.min, `Jumlah look minimal ${CUSTOM_LOOK_RANGE.min}`)
    .max(CUSTOM_LOOK_RANGE.max, `Jumlah look maksimal ${CUSTOM_LOOK_RANGE.max}`)
    .nullable()
    .optional(),
  customPhotoCount: z.coerce
    .number()
    .int("Jumlah foto harus bilangan bulat")
    .min(CUSTOM_PHOTO_RANGE.min, `Jumlah foto minimal ${CUSTOM_PHOTO_RANGE.min}`)
    .max(CUSTOM_PHOTO_RANGE.max, `Jumlah foto maksimal ${CUSTOM_PHOTO_RANGE.max}`)
    .nullable()
    .optional(),
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

/** Permintaan Customize: brief sendiri + referensi (gambar unggahan dan/atau tautan). */
const customSchema = requestSchema.omit({ items: true }).extend({
  type: z.literal("CUSTOM"),
  custom: z.object({
    title: z
      .string()
      .trim()
      .min(2, "Nama produk atau koleksi minimal 2 karakter")
      .max(120, "Nama produk atau koleksi maksimal 120 karakter"),
    description: z
      .string()
      .trim()
      .min(10, "Deskripsi kebutuhan minimal 10 karakter")
      .max(2000, "Deskripsi kebutuhan maksimal 2000 karakter"),
    images: z
      .array(z.string().max(500))
      .max(MAX_REFERENCE_IMAGES, `Maksimal ${MAX_REFERENCE_IMAGES} gambar referensi`)
      .default([]),
    links: z
      .array(z.string().trim().max(500, "Tautan terlalu panjang"))
      .max(MAX_REFERENCE_LINKS, `Maksimal ${MAX_REFERENCE_LINKS} tautan referensi`)
      .default([]),
    ...itemSchema.pick({
      packageId: true,
      modelGender: true,
      modelNotes: true,
      customLookCount: true,
      customPhotoCount: true,
    }).shape,
  }),
});

function validationError(issue: z.core.$ZodIssue | undefined) {
  // Kesalahan pada item keranjang tidak punya kolom di form: biarkan jadi pesan umum
  const field =
    issue?.path?.length && issue.path[0] !== "items"
      ? issue.path.join(".")
      : undefined;
  return NextResponse.json(
    { error: issue?.message || "Input tidak valid", ...(field ? { field } : {}) },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  try {
    // Setiap permintaan mengirim email ke alamat yang diisi pengunjung: batasi per IP dan per alamat
    // supaya formulir ini tidak bisa dipakai membanjiri kotak masuk orang lain
    const ip = getClientIp(req.headers) ?? "unknown";
    if (await rateLimitedShared(`request-ip:${ip}`, 8, 10 * 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak pengiriman. Coba lagi beberapa menit lagi." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const emailKey = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (emailKey && (await rateLimitedShared(`request-email:${emailKey}`, 3, 60 * 60_000))) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan untuk email ini. Coba lagi dalam satu jam." },
        { status: 429 }
      );
    }

    if (body?.type === "CUSTOM") return await handleCustom(body);
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      // Kesalahan pada item keranjang tidak punya kolom di form: biarkan jadi pesan umum
      const field =
        issue?.path?.length && issue.path[0] !== "items"
          ? issue.path.join(".")
          : undefined;
      return NextResponse.json(
        {
          error: issue?.message || "Input tidak valid",
          ...(field ? { field } : {}),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const statusToken = randomBytes(32).toString("hex");

    // Hitung total dari data database (server-side, tidak dipercaya dari client)
    let totalEstimated = 0;
    const itemDetails: Array<{
      productId: string | null;
      packageId: string | null;
      talentId: string | null;
      quantity: number;
      /** null untuk "Sesuai kebutuhan": harganya disepakati dengan admin */
      estimatedPrice: number | null;
      modelGender: string | null;
      modelNotes: string | null;
      customLookCount: number | null;
      customPhotoCount: number | null;
    }> = [];

    const packageIds = data.items
      .map((i) => i.packageId)
      .filter((id): id is string => Boolean(id));
    const productIds = [
      ...new Set(
        data.items
          .map((i) => i.productId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    // Harga dan nama diambil dari database; nama dipakai di email
    const packagePrices: Record<string, number> = {};
    const packageNames: Record<string, string> = {};
    const productNames: Record<string, string> = {};
    const [packageRows, productRows] = await Promise.all([
      packageIds.length > 0
        ? query<{ id: string; name: string; base_price: number }>(
            `SELECT id, name, base_price FROM packages WHERE id = ANY($1)`,
            [packageIds]
          )
        : Promise.resolve([]),
      productIds.length > 0
        ? query<{ id: string; name: string }>(
            `SELECT id, name FROM products WHERE id = ANY($1)`,
            [productIds]
          )
        : Promise.resolve([]),
    ]);
    packageRows.forEach((r) => {
      packagePrices[r.id] = r.base_price;
      packageNames[r.id] = r.name;
    });
    productRows.forEach((r) => (productNames[r.id] = r.name));

    for (const item of data.items) {
      // Opsi "Sesuai kebutuhan": tanpa paket; jumlah look dan foto harus berpasangan.
      // Bila ada paket, angka kustom diabaikan.
      const custom =
        !item.packageId &&
        (item.customLookCount != null || item.customPhotoCount != null);
      if (
        custom &&
        (item.customLookCount == null || item.customPhotoCount == null)
      ) {
        return NextResponse.json(
          { error: "Jumlah look dan jumlah foto harus diisi keduanya" },
          { status: 400 }
        );
      }

      // Harga "Sesuai kebutuhan" disepakati admin, jadi tidak masuk total estimasi
      const price = item.packageId ? packagePrices[item.packageId] || 0 : 0;
      totalEstimated += price * item.quantity;
      itemDetails.push({
        productId: item.productId ?? null,
        packageId: item.packageId ?? null,
        talentId: item.talentId ?? null,
        quantity: item.quantity,
        estimatedPrice: custom ? null : price,
        modelGender: item.modelGender ?? null,
        modelNotes: item.modelNotes || null,
        customLookCount: custom ? item.customLookCount! : null,
        customPhotoCount: custom ? item.customPhotoCount! : null,
      });
    }

    // Simpan ke database
    const sql = getSql();
    // Nomor acak 6 digit bisa bentrok saat volume besar: ulangi dengan nomor baru, bukan gagal 500
    let requestNumber = "";
    let requestId: string | undefined;
    for (let attempt = 0; attempt < 5 && !requestId; attempt++) {
      requestNumber = generateRequestNumber();
      const result = await sql`
        INSERT INTO requests (number, status, customer_name, customer_email, customer_whatsapp, brand_name, preferred_date, notes, personal_data_consent, status_token, total_estimated)
        VALUES (${requestNumber}, 'SUBMITTED', ${encryptPii(data.name, "customer_name")}, ${encryptPii(data.email, "customer_email")}, ${encryptPii(data.whatsapp, "customer_whatsapp")}, ${data.brandName || null}, ${data.preferredDate || null}, ${encryptPii(data.notes, "notes")}, ${data.consent}, ${statusToken}, ${totalEstimated || null})
        ON CONFLICT (number) DO NOTHING
        RETURNING id
      `;
      requestId = (result as { id: string }[])[0]?.id;
    }

    if (!requestId) {
      throw new Error("Gagal membuat permintaan");
    }

    for (const item of itemDetails) {
      await sql`
        INSERT INTO request_items (request_id, product_id, package_id, talent_id, quantity, estimated_price, model_gender, model_notes, custom_look_count, custom_photo_count)
        VALUES (${requestId}, ${item.productId}, ${item.packageId}, ${item.talentId}, ${item.quantity}, ${item.estimatedPrice}, ${item.modelGender}, ${item.modelNotes}, ${item.customLookCount}, ${item.customPhotoCount})
      `;
    }

    await sql`
      INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
      VALUES (${requestId}, null, 'SUBMITTED', 'sistem', 'Permintaan disubmit pelanggan')
    `;

    // Baris item untuk email: nama yang terbaca manusia, bukan id
    const emailItems = itemDetails.map((i) => ({
      product: (i.productId && productNames[i.productId]) || null,
      package: i.packageId
        ? packageNames[i.packageId] || null
        : i.customLookCount != null
          ? `Sesuai kebutuhan (${i.customLookCount} look, ${i.customPhotoCount} foto)`
          : null,
      model:
        [
          modelGenderLabel(i.modelGender),
          i.modelNotes ? `Catatan: ${i.modelNotes}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      quantity: i.quantity,
    }));

    const emailConfig = await getEmailConfig();

    // Kirim email konfirmasi ke pelanggan
    const customerEmail = requestConfirmationEmail({
      customerName: data.name,
      requestNumber,
      items: emailItems,
      total: totalEstimated,
      brand: emailConfig.brand,
    });
    await sendEmail({
      to: data.email,
      subject: customerEmail.subject,
      html: customerEmail.html,
      text: customerEmail.text,
    });

    // Kirim notifikasi ke admin
    const adminEmail = adminNewRequestEmail({
      requestNumber,
      customerName: data.name,
      items: emailItems,
      total: totalEstimated,
      dashboardUrl: absoluteUrl("/admin/requests"),
      brand: emailConfig.brand,
    });
    await sendEmail({
      to: emailConfig.adminRecipients,
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

async function handleCustom(body: unknown) {
  const parsed = customSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues?.[0]);

  const data = parsed.data;
  const c = data.custom;

  // Gambar hanya boleh berasal dari unggahan kita sendiri (folder requests/)
  const imagePrefix = getPublicUrl(PUBLIC_UPLOAD_PREFIX);
  const images = [...new Set(c.images)];
  if (images.length > 0 && (!imagePrefix || !images.every((u) => u.startsWith(imagePrefix)))) {
    return NextResponse.json({ error: "Gambar referensi tidak valid" }, { status: 400 });
  }

  // Tautan harus http(s)
  const links = [...new Set(c.links.filter(Boolean))];
  for (const link of links) {
    let ok = false;
    try {
      ok = ["http:", "https:"].includes(new URL(link).protocol);
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.json(
        { error: "Tautan referensi harus berupa alamat http:// atau https://", field: "custom.links" },
        { status: 400 }
      );
    }
  }

  if (images.length + links.length === 0) {
    return NextResponse.json(
      { error: "Tambahkan minimal satu referensi: gambar atau tautan", field: "custom.references" },
      { status: 400 }
    );
  }

  // Paket: id paket atau "Sesuai kebutuhan" (look + foto berpasangan)
  const customPackage = !c.packageId;
  if (customPackage && (c.customLookCount == null || c.customPhotoCount == null)) {
    return NextResponse.json(
      { error: "Pilih paket atau isi jumlah look dan foto untuk 'Sesuai kebutuhan'", field: "custom.package" },
      { status: 400 }
    );
  }

  let packageName: string | null = null;
  let price = 0;
  if (c.packageId) {
    const rows = await query<{ name: string; base_price: number }>(
      `SELECT name, base_price FROM packages WHERE id = $1 AND is_active = true`,
      [c.packageId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Paket tidak ditemukan", field: "custom.package" }, { status: 400 });
    }
    packageName = rows[0].name;
    price = rows[0].base_price;
  }

  const statusToken = randomBytes(32).toString("hex");
  const sql = getSql();

  // Nomor acak 6 digit bisa bentrok saat volume besar: ulangi dengan nomor baru, bukan gagal 500
  let requestNumber = "";
  let requestId: string | undefined;
  for (let attempt = 0; attempt < 5 && !requestId; attempt++) {
    requestNumber = generateRequestNumber();
    const result = await sql`
      INSERT INTO requests (number, status, request_type, custom_title, custom_description, customer_name, customer_email, customer_whatsapp, brand_name, preferred_date, notes, personal_data_consent, status_token, total_estimated)
      VALUES (${requestNumber}, 'SUBMITTED', 'CUSTOM', ${c.title}, ${c.description}, ${encryptPii(data.name, "customer_name")}, ${encryptPii(data.email, "customer_email")}, ${encryptPii(data.whatsapp, "customer_whatsapp")}, ${data.brandName || null}, ${data.preferredDate || null}, ${encryptPii(data.notes, "notes")}, ${data.consent}, ${statusToken}, ${price || null})
      ON CONFLICT (number) DO NOTHING
      RETURNING id
    `;
    requestId = (result as { id: string }[])[0]?.id;
  }
  if (!requestId) throw new Error("Gagal membuat permintaan");

  await sql`
    INSERT INTO request_items (request_id, product_id, package_id, quantity, estimated_price, model_gender, model_notes, custom_look_count, custom_photo_count)
    VALUES (${requestId}, null, ${c.packageId ?? null}, 1, ${customPackage ? null : price}, ${c.modelGender ?? null}, ${c.modelNotes || null}, ${customPackage ? c.customLookCount! : null}, ${customPackage ? c.customPhotoCount! : null})
  `;
  for (const url of images) {
    await sql`INSERT INTO request_references (request_id, kind, url) VALUES (${requestId}, 'IMAGE', ${url})`;
  }
  for (const url of links) {
    await sql`INSERT INTO request_references (request_id, kind, url) VALUES (${requestId}, 'LINK', ${url})`;
  }
  await sql`
    INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
    VALUES (${requestId}, null, 'SUBMITTED', 'sistem', 'Permintaan customize disubmit pelanggan')
  `;

  const emailItems = [
    {
      product: `Customize: ${c.title} (${images.length + links.length} referensi)`,
      package: customPackage
        ? `Sesuai kebutuhan (${c.customLookCount} look, ${c.customPhotoCount} foto)`
        : packageName,
      model:
        [modelGenderLabel(c.modelGender), c.modelNotes ? `Catatan: ${c.modelNotes}` : null]
          .filter(Boolean)
          .join(" · ") || null,
      quantity: 1,
    },
  ];

  const emailConfig = await getEmailConfig();

  const customerEmail = requestConfirmationEmail({
    customerName: data.name,
    requestNumber,
    items: emailItems,
    total: price,
    brief: { title: c.title, description: c.description },
    brand: emailConfig.brand,
  });
  await sendEmail({ to: data.email, subject: customerEmail.subject, html: customerEmail.html, text: customerEmail.text });

  const adminEmail = adminNewRequestEmail({
    requestNumber,
    customerName: data.name,
    items: emailItems,
    total: price,
    dashboardUrl: absoluteUrl("/admin/requests"),
    brand: emailConfig.brand,
  });
  await sendEmail({
    to: emailConfig.adminRecipients,
    subject: adminEmail.subject,
    html: adminEmail.html,
    text: adminEmail.text,
  });

  return NextResponse.json({ success: true, requestNumber }, { status: 201 });
}
