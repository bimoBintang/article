"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronLeft, Copy } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, rupiah } from "@/lib/invoice-status";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { Invoice } from "@/types";

type InvoiceDetail = Omit<Invoice, "pay_token"> & {
  pay_url: string | null;
  request_number: string;
  customer_name: string;
  customer_email: string;
};
type PaymentEvent = { id: string; status: string; signature_valid: boolean; created_at: string };

const card = "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";
const btn =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function fmt(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

export default function AdminInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<"sync" | "resend" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/invoices/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Gagal memuat invoice");
    setInvoice(data.invoice);
    setEvents(data.events ?? []);
  }, [id]);

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  async function act(action: "sync" | "resend" | "cancel", okText: (data: any) => string) {
    setBusy(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/invoices/${id}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Aksi gagal");
      setNotice({ type: "success", text: okText(data) });
      await load();
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "Aksi gagal" });
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  }

  async function copyLink() {
    if (!invoice?.pay_url) return;
    try {
      await navigator.clipboard.writeText(invoice.pay_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard diblokir; tautan tetap terlihat untuk disalin manual
    }
  }

  const back = (
    <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-foreground dark:text-zinc-400">
      <ChevronLeft className="h-4 w-4" />
      Kembali ke daftar invoice
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonPageHeader />
        <SkeletonTable columns={4} />
      </div>
    );
  }
  if (notFound || !invoice) {
    return (
      <div className="space-y-6">
        {back}
        <Alert variant={notFound ? "warning" : "error"} title={notFound ? "Invoice tidak ditemukan" : "Gagal memuat"}>
          {notFound ? "Invoice ini tidak ada atau sudah dihapus." : error || "Coba muat ulang halaman."}
        </Alert>
      </div>
    );
  }

  const ins = invoice.payment_details;
  const payable = invoice.status !== "PAID" && invoice.status !== "CANCELLED" && invoice.status !== "REFUNDED";
  const rows: [string, React.ReactNode][] = [
    ["Permintaan", <Link key="r" href={`/admin/requests/${invoice.request_id}`} className="text-primary hover:underline">#{invoice.request_number}</Link>],
    ["Pelanggan", `${invoice.customer_name} (${invoice.customer_email})`],
    ["Nominal", <strong key="t">{rupiah(invoice.total)}</strong>],
    ["Keterangan", invoice.description || "-"],
    ["Dibuat", fmt(invoice.created_at)],
    ["Dibayar", fmt(invoice.paid_at)],
    ["Percobaan pembayaran", String(invoice.attempt)],
    ["Order ID Midtrans", <span key="o" className="break-all font-mono text-xs">{invoice.order_id}</span>],
    ["Transaction ID", <span key="x" className="break-all font-mono text-xs">{invoice.transaction_id ?? "-"}</span>],
  ];

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-foreground sm:text-2xl">{invoice.invoice_number ?? invoice.order_id}</h1>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status] ?? ""}`}>
          {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
        </span>
      </div>

      {notice && (
        <Alert variant={notice.type} title={notice.type === "success" ? "Berhasil" : "Gagal"} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-foreground">Rincian</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-foreground">Instruksi pembayaran</h2>
            {invoice.payment_method && ins ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Metode</dt>
                  <dd className="mt-0.5 text-foreground">{paymentMethodLabel(invoice.payment_method)}</dd>
                </div>
                {ins.type === "va" && (
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Nomor Virtual Account</dt>
                    <dd className="mt-0.5 font-mono text-foreground">{ins.vaNumber}</dd>
                  </div>
                )}
                {ins.type !== "va" && ins.qrUrl && (
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Kode QR</dt>
                    <dd className="mt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ins.qrUrl} alt="Kode QR pembayaran" className="h-40 w-40 rounded border border-zinc-200 bg-white p-1 dark:border-zinc-700" />
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Berlaku sampai</dt>
                  <dd className="mt-0.5 text-foreground">{fmt(invoice.expire_at)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Pelanggan belum memilih metode pembayaran.</p>
            )}
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-foreground">Riwayat notifikasi Midtrans</h2>
            {events.length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {events.map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="font-mono text-xs text-foreground">{ev.status}</span>
                    <span className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className={ev.signature_valid ? "" : "font-semibold text-red-600"}>
                        {ev.signature_valid ? "tanda tangan valid" : "TANDA TANGAN TIDAK VALID"}
                      </span>
                      {fmt(ev.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Belum ada notifikasi dari Midtrans.</p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className={card}>
            <h2 className="text-sm font-semibold text-foreground">Tautan bayar</h2>
            {invoice.pay_url ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={invoice.pay_url}
                  aria-label="Tautan bayar pelanggan"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-foreground dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button type="button" onClick={copyLink} aria-label="Salin tautan bayar" className={`${btn} px-2.5`}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Tidak tersedia.</p>
            )}
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-foreground">Aksi</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" disabled={busy !== null} className={btn}
                onClick={() => act("sync", (d) => d.ignored ? `Data tidak diterapkan (${d.ignored}).` : `Status disinkronkan: ${INVOICE_STATUS_LABELS[d.status as keyof typeof INVOICE_STATUS_LABELS] ?? d.status}.`)}>
                {busy === "sync" ? "Memeriksa..." : "Sinkronkan status"}
              </button>
              <button type="button" disabled={busy !== null || !payable} className={btn}
                onClick={() => act("resend", () => "Email tautan bayar dikirim ulang ke pelanggan.")}>
                {busy === "resend" ? "Mengirim..." : "Kirim ulang email"}
              </button>
              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                confirmCancel ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy !== null} onClick={() => act("cancel", () => "Invoice dibatalkan.")}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                      {busy === "cancel" ? "Membatalkan..." : "Ya, batalkan"}
                    </button>
                    <button type="button" disabled={busy !== null} onClick={() => setConfirmCancel(false)} className={btn}>
                      Tidak
                    </button>
                  </div>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => setConfirmCancel(true)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40">
                    Batalkan invoice
                  </button>
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
