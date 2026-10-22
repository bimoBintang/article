"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  MAX_INVOICE_TOTAL,
  MIN_INVOICE_TOTAL,
  rupiah,
} from "@/lib/invoice-status";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { AdminRequestInvoice } from "@/types";

const BUILDABLE = ["SUBMITTED", "IN_REVIEW", "NEGOTIATION", "AGREED", "INVOICED"];

/** Angka dengan pemisah ribuan format Indonesia: 1500000 -> "1.500.000". */
const formatDigits = (digits: string) => (digits ? Number(digits).toLocaleString("id-ID") : "");
const MAX_DIGITS = String(MAX_INVOICE_TOTAL).length;

const INPUT =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900";

/**
 * Kartu invoice di detail permintaan: daftar invoice dan formulir membuat
 * invoice baru (nominal final hasil kesepakatan) yang langsung mengirim
 * tautan bayar ke pelanggan.
 */
export function RequestInvoiceCard({
  requestId,
  requestStatus,
  totalEstimated,
  invoices,
  onChanged,
}: {
  requestId: string;
  requestStatus: string;
  totalEstimated: number | null;
  invoices: AdminRequestInvoice[];
  onChanged: () => Promise<void> | void;
}) {
  // Hanya angka; tampilan dibuat berpemisah ribuan oleh formatDigits
  const [amount, setAmount] = useState(totalEstimated ? String(totalEstimated) : "");
  const amountRef = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasOpen = invoices.some((i) => i.status === "PENDING");
  const hasPaid = invoices.some((i) => i.status === "PAID");
  const blocker = hasPaid
    ? "Permintaan ini sudah dibayar."
    : hasOpen
      ? "Masih ada invoice yang menunggu pembayaran. Batalkan dulu bila ingin membuat yang baru."
      : !BUILDABLE.includes(requestStatus)
        ? `Invoice tidak bisa dibuat untuk permintaan berstatus ${requestStatus}.`
        : null;

  // Setelah diformat ulang, kursor kembali ke posisi angka yang sama (bukan lompat ke akhir)
  useLayoutEffect(() => {
    const el = amountRef.current;
    if (caretDigits.current === null || !el) return;
    const shown = formatDigits(amount);
    let seen = 0;
    let pos = 0;
    while (pos < shown.length && seen < caretDigits.current) {
      if (/\d/.test(shown[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [amount]);

  function onAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    let next = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
    let digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
    // Backspace tepat setelah titik pemisah hanya menghapus titiknya; anggap itu menghapus angka di kirinya
    if (next === amount && raw.length < formatDigits(amount).length && digitsBefore > 0) {
      next = amount.slice(0, digitsBefore - 1) + amount.slice(digitsBefore);
      digitsBefore -= 1;
    }
    caretDigits.current = Math.min(digitsBefore, next.length);
    setAmount(next);
  }

  const total = Number(amount || 0);
  const amountError =
    amount && total < MIN_INVOICE_TOTAL
      ? `Nominal minimal ${rupiah(MIN_INVOICE_TOTAL)}`
      : total > MAX_INVOICE_TOTAL
        ? `Nominal maksimal ${rupiah(MAX_INVOICE_TOTAL)}`
        : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, total, description: description.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice");
      setNotice({
        type: "success",
        text: data.emailSent
          ? `Invoice ${data.invoice.invoice_number} dibuat dan tautan bayar dikirim ke pelanggan.`
          : `Invoice ${data.invoice.invoice_number} dibuat, tetapi email gagal terkirim. Kirim ulang dari halaman detail invoice.`,
      });
      setDescription("");
      await onChanged();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Gagal membuat invoice" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <h2 className="text-sm font-semibold text-foreground">Invoice</h2>

      {invoices.length > 0 && (
        <ul className="mt-4 space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/admin/invoices/${inv.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-primary hover:bg-primary/5 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold text-foreground">{inv.invoice_number ?? inv.id}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {rupiah(inv.total)}
                    {inv.payment_method ? ` · ${paymentMethodLabel(inv.payment_method)}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] ?? ""}`}>
                  {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {blocker ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{blocker}</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="invoice-amount" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nominal tagihan (Rp)
            </label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400"
              >
                Rp
              </span>
              <input
                id="invoice-amount"
                ref={amountRef}
                inputMode="numeric"
                autoComplete="off"
                value={formatDigits(amount)}
                onChange={onAmountChange}
                aria-invalid={amountError ? true : undefined}
                aria-describedby="invoice-amount-hint"
                placeholder="1.500.000"
                className={`${INPUT} pl-9 tabular-nums`}
              />
            </div>
            <p
              id="invoice-amount-hint"
              className={`mt-1.5 text-xs ${amountError ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              {amountError || "Nominal final hasil kesepakatan dengan pelanggan."}
            </p>
          </div>
          <div>
            <label htmlFor="invoice-desc" className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Keterangan (opsional)
            </label>
            <input
              id="invoice-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="mis. Pemotretan koleksi Oktober"
              className={INPUT}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !amount || Boolean(amountError)}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Membuat..." : "Buat invoice dan kirim tautan"}
          </button>
        </form>
      )}

      {notice && (
        <div className="mt-3">
          <Alert variant={notice.type} title={notice.type === "success" ? "Berhasil" : "Gagal"}>
            {notice.text}
          </Alert>
        </div>
      )}
    </section>
  );
}
