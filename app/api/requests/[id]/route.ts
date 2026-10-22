import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { isAdmin } from "@/lib/auth-server";
import type {
  AdminRequestDetail,
  AdminRequestInvoice,
  AdminRequestItem,
  AdminRequestLog,
  AdminRequestReference,
} from "@/types";
import { decryptFields } from "@/lib/pii";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Detail satu permintaan (khusus admin): data pelanggan, item beserta nama
 * produk/paket/model, dan riwayat perubahan status.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ID bukan UUID tidak mungkin ada; jangan kirim ke Postgres (error 500)
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: "Permintaan tidak ditemukan" },
        { status: 404 }
      );
    }

    // status_token sengaja tidak dikirim: itu rahasia tautan pelanggan
    const encrypted = await queryOne<AdminRequestDetail>(
      `SELECT id, number, status, customer_name, customer_email,
              customer_whatsapp, brand_name,
              to_char(preferred_date, 'YYYY-MM-DD') AS preferred_date, notes,
              personal_data_consent, total_estimated, request_type, custom_title,
              custom_description, created_at, updated_at
       FROM requests
       WHERE id = $1`,
      [id]
    );

    if (!encrypted) {
      return NextResponse.json(
        { error: "Permintaan tidak ditemukan" },
        { status: 404 }
      );
    }
    const request = decryptFields(encrypted);

    const [items, logs, references, invoices] = await Promise.all([
      query<AdminRequestItem>(
        `SELECT ri.id, ri.quantity, ri.estimated_price, ri.notes,
                ri.model_gender, ri.model_notes,
                ri.custom_look_count, ri.custom_photo_count,
                p.name AS product_name, p.thumbnail_url AS product_thumbnail,
                pk.name AS package_name,
                t.name AS talent_name
         FROM request_items ri
         LEFT JOIN products p ON p.id = ri.product_id
         LEFT JOIN packages pk ON pk.id = ri.package_id
         LEFT JOIN talents t ON t.id = ri.talent_id
         WHERE ri.request_id = $1
         ORDER BY ri.created_at ASC`,
        [id]
      ),
      query<AdminRequestLog>(
        `SELECT id, from_status, to_status, changed_by, changed_at, notes
         FROM request_status_logs
         WHERE request_id = $1
         ORDER BY changed_at DESC`,
        [id]
      ),
      query<AdminRequestReference>(
        `SELECT id, kind, url FROM request_references
         WHERE request_id = $1 ORDER BY kind ASC, created_at ASC`,
        [id]
      ),
      query<AdminRequestInvoice>(
        `SELECT id, invoice_number, total, status, payment_method, created_at, paid_at
         FROM invoices WHERE request_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
    ]);

    return NextResponse.json({ request, items, logs, references, invoices });
  } catch (err) {
    console.error("Fetch request detail error:", err);
    return NextResponse.json(
      { error: "Gagal memuat detail permintaan" },
      { status: 500 }
    );
  }
}
