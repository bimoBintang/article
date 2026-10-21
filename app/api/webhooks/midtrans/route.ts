import { NextResponse } from "next/server";
import { getSql, query, queryOne } from "@/lib/db";
import { verifyMidtransSignature, mapMidtransStatusToInvoiceStatus, recordPaymentEvent, MIDTRANS_SERVER_KEY } from "@/lib/midtrans";
import { sendEmail, paymentSuccessEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const payload = JSON.parse(body);

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      fraud_status,
      transaction_status,
      payment_type,
    } = payload;

    // Verify signature
    const signatureValid = await verifyMidtransSignature(
      signature_key,
      order_id,
      status_code,
      gross_amount,
      MIDTRANS_SERVER_KEY
    );

    if (!signatureValid) {
      // Still record the event for audit but don't process
      const invoice = await queryOne<any>(
        `SELECT id FROM invoices WHERE order_id = $1`,
        [order_id]
      );
      if (invoice) {
        await recordPaymentEvent({
          invoiceId: invoice.id,
          rawPayload: body,
          status: transaction_status,
          signatureValid: false,
        });
      }
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Find invoice
    const invoice = await queryOne<any>(
      `SELECT i.*, r.customer_name, r.customer_email, r.number as request_number
       FROM invoices i
       JOIN requests r ON r.id = i.request_id
       WHERE i.order_id = $1`,
      [order_id]
    );

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Idempotency: check if this event was already processed
    const existingEvent = await queryOne<any>(
      `SELECT id FROM payment_events WHERE invoice_id = $1 AND raw_payload = $2`,
      [invoice.id, body]
    );

    if (existingEvent) {
      return NextResponse.json({ status: "already processed" });
    }

    // Confirm with Midtrans Status API (defense in depth)
    try {
      const statusCheck = await fetch(
        `https://api.sandbox.midtrans.com/v2/${order_id}/status`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64")}`,
          },
        }
      );
      if (statusCheck.ok) {
        const midtransData = await statusCheck.json();
        // Use the confirmed status from Midtrans API
        const confirmedStatus = midtransData.transaction_status;
        const confirmedFraud = midtransData.fraud_status;
        const mappedStatus = mapMidtransStatusToInvoiceStatus(confirmedStatus, confirmedFraud);

        // Update invoice status
        await getSql()`
          UPDATE invoices
          SET status = ${mappedStatus}, updated_at = NOW()
          ${mappedStatus === "PAID" ? ", paid_at = NOW()" : ""}
          WHERE id = ${invoice.id}
        `;

        // If paid, update request status to PAID
        if (mappedStatus === "PAID") {
          await getSql()`
            UPDATE requests
            SET status = 'PAID', updated_at = NOW()
            WHERE id = ${invoice.request_id}
          `;

          // Log status change
          await getSql()`
            INSERT INTO request_status_logs (request_id, from_status, to_status, changed_by, notes)
            VALUES (${invoice.request_id}, 'INVOICED', 'PAID', 'sistem', 'Pembayaran diterima via Midtrans webhook')
          `;

          // Send payment success email to customer
          try {
            const successEmail = paymentSuccessEmail({
              customerName: invoice.customer_name,
              invoiceId: invoice.order_id,
              total: invoice.total,
            });
            await sendEmail({
              to: invoice.customer_email,
              subject: successEmail.subject,
              html: successEmail.html,
              text: successEmail.text,
            });
          } catch (emailErr) {
            console.error("Email send error:", emailErr);
          }
        }
      }
    } catch (apiErr) {
      console.error("Midtrans status API error:", apiErr);
    }

    // Record payment event
    await recordPaymentEvent({
      invoiceId: invoice.id,
      rawPayload: body,
      status: transaction_status,
      signatureValid: true,
    });

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
