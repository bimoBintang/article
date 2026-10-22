import { NextResponse } from "next/server";
import {
  getTransactionStatus,
  MidtransNotConfiguredError,
  recordPaymentEvent,
  verifyMidtransSignature,
} from "@/lib/midtrans";
import { applyMidtransStatus, findInvoiceByOrderId } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Notifikasi pembayaran Midtrans (URL ini diisi di dashboard Midtrans:
 * Settings > Configuration > Payment Notification URL).
 *
 * Alur: verifikasi tanda tangan, cari invoice, konfirmasi ulang lewat Status
 * API (jangan percaya isi notifikasi saja), lalu terapkan status. Midtrans
 * mengulang notifikasi bila balasan bukan 2xx, jadi kondisi yang tidak akan
 * pernah berhasil (order tidak dikenal) tetap dibalas 200.
 */
export async function POST(req: Request) {
  let body = "";
  try {
    body = await req.text();
    const payload = JSON.parse(body);
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = payload;

    const signatureValid = await verifyMidtransSignature(signature_key, order_id, status_code, gross_amount);
    const invoice = typeof order_id === "string" ? await findInvoiceByOrderId(order_id) : null;

    if (!signatureValid) {
      // Dicatat untuk audit, tidak diproses
      if (invoice) {
        await recordPaymentEvent({
          invoiceId: invoice.id,
          rawPayload: body,
          status: String(transaction_status ?? "unknown"),
          signatureValid: false,
        });
      }
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!invoice) {
      // Order dari sistem lain atau percobaan yang tidak kita kenal
      return NextResponse.json({ status: "ignored" });
    }

    await recordPaymentEvent({
      invoiceId: invoice.id,
      rawPayload: body,
      status: String(transaction_status ?? "unknown"),
      signatureValid: true,
    });

    // Konfirmasi ke Midtrans; bila gagal, jangan percaya notifikasi mentah
    const confirmed = await getTransactionStatus(order_id);
    if (!confirmed) {
      return NextResponse.json({ error: "Transaction not confirmed" }, { status: 503 });
    }

    const result = await applyMidtransStatus(invoice, confirmed, "Pembayaran diterima via Midtrans webhook");
    return NextResponse.json({ status: result.ignored ?? "ok" });
  } catch (err) {
    if (err instanceof MidtransNotConfiguredError) {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
