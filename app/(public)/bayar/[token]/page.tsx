import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findInvoiceByToken, getEnabledMethods, TOKEN_PATTERN, toPublicInvoice } from "@/lib/payments";
import { noIndexMetadata } from "@/lib/seo";
import { PaymentClient } from "./payment-client";

export const dynamic = "force-dynamic";

/** Tautan bayar bersifat pribadi: jangan terindeks mesin pencari. */
export const metadata: Metadata = noIndexMetadata("Pembayaran");

export default async function PayPage({ params }: PageProps<"/bayar/[token]">) {
  const { token } = await params;
  const invoice = TOKEN_PATTERN.test(token) ? await findInvoiceByToken(token) : null;
  if (!invoice) notFound();

  return (
    <PaymentClient token={token} initial={toPublicInvoice(invoice)} methods={await getEnabledMethods()} />
  );
}
