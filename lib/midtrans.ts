import { query, queryOne } from "./db";

export const MIDTRANS_BASE_URL =
  process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";

export const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
export const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY!;

function midtransHeaders() {
  const token = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface CreateTransactionParams {
  order_id: string;
  gross_amount: number;
  item_details: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  customer_details: {
    first_name: string;
    email: string;
    phone: string;
  };
  callbacks?: {
    finish: string;
    unfinish: string;
    error: string;
  };
}

export async function createMidtransTransaction(params: CreateTransactionParams) {
  const response = await fetch(`${MIDTRANS_BASE_URL}/v2/charge`, {
    method: "POST",
    headers: midtransHeaders(),
    body: JSON.stringify({
      payment_type: "snap",
      transaction_details: {
        order_id: params.order_id,
        gross_amount: params.gross_amount,
      },
      item_details: params.item_details,
      customer_details: params.customer_details,
      callbacks: params.callbacks,
      expiry: {
        duration: 24,
        unit: "hour",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Midtrans error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function getTransactionStatus(orderId: string) {
  const response = await fetch(
    `${MIDTRANS_BASE_URL}/v2/${orderId}/status`,
    {
      headers: midtransHeaders(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Midtrans status error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function verifyMidtransSignature(
  signatureKey: string,
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string
) {
  const crypto = await import("crypto");
  const hash = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
  return hash === signatureKey;
}

export async function recordPaymentEvent({
  invoiceId,
  rawPayload,
  status,
  signatureValid,
}: {
  invoiceId: string;
  rawPayload: string;
  status: string;
  signatureValid: boolean;
}) {
  await query(
    `INSERT INTO payment_events (invoice_id, raw_payload, status, signature_valid)
     VALUES ($1, $2, $3, $4)`,
    [invoiceId, rawPayload, status, signatureValid]
  );
}

export function mapMidtransStatusToInvoiceStatus(
  midtransStatus: string,
  fraudStatus?: string
): InvoiceStatus {
  switch (midtransStatus) {
    case "settlement":
      return fraudStatus === "accept" ? "PAID" : "PENDING";
    case "capture":
      return fraudStatus === "accept" ? "PAID" : "PENDING";
    case "pending":
      return "PENDING";
    case "deny":
      return "FAILED";
    case "cancel":
      return "CANCELLED";
    case "expire":
      return "EXPIRED";
    case "refund":
      return "REFUNDED";
    case "partial_refund":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
