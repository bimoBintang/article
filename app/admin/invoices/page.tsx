"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Copy, Check } from "lucide-react";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";
import { Alert } from "@/components/ui/alert";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, rupiah } from "@/lib/invoice-status";
import { paymentMethodLabel } from "@/lib/payment-methods";

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  order_id: string;
  total: number;
  status: string;
  payment_method: string | null;
  created_at: string;
  request_id: string;
  request_number: string;
  customer_name: string;
  customer_email: string;
};

export default function AdminInvoices() {
  const { preview, openPreview, closePreview } = useTablePreview();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    fetch("/api/admin/invoices", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Gagal memuat invoice");
        setInvoices(data.invoices);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setWebhookUrl(`${window.location.origin}/api/webhooks/midtrans`);
        setLoading(false);
      });
  }, []);

  function previewInvoice(inv: InvoiceRow) {
    openPreview({
      title: inv.invoice_number || inv.order_id || "Invoice",
      subtitle: inv.request_number ? `#${inv.request_number}` : undefined,
      meta: [
        { label: "Pelanggan", value: inv.customer_name || "-" },
        { label: "Email", value: inv.customer_email || "-" },
        { label: "Total", value: rupiah(inv.total) },
        { label: "Metode", value: inv.payment_method ? paymentMethodLabel(inv.payment_method) : "-" },
        { label: "Status", value: INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS] ?? inv.status },
        { label: "Dibuat", value: inv.created_at ? new Date(inv.created_at).toLocaleString("id-ID") : "-" },
      ],
    });
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bisa diblokir; URL tetap terlihat untuk disalin manual
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonPageHeader />
        <SkeletonTable columns={6} />
      </div>
    );
  }

  const th = "whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">Kelola Invoice</h1>

      {error && (
        <Alert variant="error" title="Gagal memuat">
          {error}
        </Alert>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-foreground">URL notifikasi Midtrans</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Isi di dashboard Midtrans (Settings &gt; Configuration &gt; Payment Notification URL). Key, mode, dan metode diatur di{" "}
          <Link href="/admin/midtrans" className="text-primary hover:underline">halaman Midtrans</Link>. Harus alamat publik; saat
          lokal, status tetap diperbarui lewat pengecekan otomatis di halaman bayar atau tombol Sinkronkan.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-foreground dark:bg-zinc-800">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={copyWebhook}
            aria-label="Salin URL notifikasi"
            className="shrink-0 rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </section>

      {invoices.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={th}>Invoice</th>
                <th className={th}>Permintaan</th>
                <th className={th}>Email</th>
                <th className={th}>Total</th>
                <th className={th}>Metode</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onDoubleClick={() => previewInvoice(inv)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-mono text-sm font-medium text-foreground">{inv.invoice_number ?? inv.order_id}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm font-medium text-foreground">#{inv.request_number}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{inv.customer_name}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">{inv.customer_email}</td>
                  <td className="px-4 py-4 text-sm font-medium text-foreground sm:px-6">{rupiah(inv.total)}</td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                    {inv.payment_method ? paymentMethodLabel(inv.payment_method) : "-"}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right sm:px-6">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Detail <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !error && (
          <Alert variant="info" title="Belum ada invoice">
            Buat invoice dari halaman detail sebuah permintaan. Pelanggan menerima tautan bayar lewat email.
          </Alert>
        )
      )}

      <TablePreview
        open={Boolean(preview)}
        onClose={closePreview}
        title={preview?.title}
        subtitle={preview?.subtitle}
        images={preview?.images}
        meta={preview?.meta}
      />
    </div>
  );
}
