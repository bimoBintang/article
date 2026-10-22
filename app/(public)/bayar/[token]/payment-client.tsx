"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { PAYMENT_GROUPS, paymentMethodLabel, type PaymentMethod } from "@/lib/payment-methods";
import { rupiah } from "@/lib/invoice-status";
import type { PublicInvoice } from "@/lib/payments";

const POLL_MS = 5000;

const KICKER = "text-[11px] font-medium uppercase tracking-[0.18em] text-muted";
const HEADING =
  "font-display font-extrabold text-3xl leading-[1.05] tracking-[-0.03em] [word-spacing:0.06em] text-ink sm:text-4xl";
const PRIMARY_BTN =
  "inline-flex w-full items-center justify-center bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BTN =
  "inline-flex items-center justify-center border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50";

/** Hitung mundur ke `expireAt`; null bila tidak ada batas waktu. */
function useCountdown(expireAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expireAt) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, new Date(expireAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expireAt]);
  return left;
}

function formatLeft(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard diblokir; nilai tetap terlihat untuk disalin manual
        }
      }}
      className={GHOST_BTN}
      aria-label={label}
    >
      {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
      {copied ? "Tersalin" : "Salin"}
    </button>
  );
}

const BANK_STEPS = (bank: string) => [
  `Buka aplikasi mobile banking atau ATM ${bank}.`,
  "Pilih Transfer, lalu Virtual Account.",
  "Masukkan nomor di atas dan pastikan nominalnya sesuai.",
  "Selesaikan pembayaran. Halaman ini otomatis berubah setelah pembayaran diterima.",
];

export function PaymentClient({
  token,
  initial,
  methods,
}: {
  token: string;
  initial: PublicInvoice;
  methods: PaymentMethod[];
}) {
  const [invoice, setInvoice] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const left = useCountdown(invoice.expireAt);

  const live = invoice.status === "PENDING" && invoice.instructions !== null;

  const refresh = useCallback(
    async (manual = false) => {
      if (manual) setChecking(true);
      try {
        const res = await fetch(`/api/public/pay/${token}/refresh`, { method: "POST" });
        if (res.ok) setInvoice((await res.json()).invoice);
      } catch {
        // jaringan sesaat putus; polling berikutnya mencoba lagi
      } finally {
        if (manual) setChecking(false);
      }
    },
    [token]
  );

  // Webhook tidak selalu bisa menjangkau server, jadi status ditanyakan berkala
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [live, refresh]);

  // Begitu hitung mundur habis, minta status terbaru (kedaluwarsa)
  const expiredHandled = useRef<string | null>(null);
  useEffect(() => {
    if (live && left === 0 && expiredHandled.current !== invoice.expireAt) {
      expiredHandled.current = invoice.expireAt;
      refresh();
    }
  }, [live, left, invoice.expireAt, refresh]);

  async function pay() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/public/pay/${token}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal membuat pembayaran. Coba lagi.");
        if (res.status === 409) await refresh();
        return;
      }
      setInvoice(data.invoice);
      setChoosing(false);
      setSelected(null);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <div>
      <p className={KICKER}>Pembayaran</p>
      <h1 className={`${HEADING} mt-3`}>{invoice.status === "PAID" ? "Pembayaran diterima." : "Selesaikan pembayaran."}</h1>
    </div>
  );

  const summary = (
    <dl className="mt-8 border-y border-line">
      <div className="flex items-baseline justify-between gap-4 py-3">
        <dt className="text-xs uppercase tracking-[0.08em] text-muted">Invoice</dt>
        <dd className="font-mono text-sm text-ink">{invoice.invoiceNumber ?? "-"}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
        <dt className="text-xs uppercase tracking-[0.08em] text-muted">Permintaan</dt>
        <dd className="font-mono text-sm text-ink">{invoice.requestNumber}</dd>
      </div>
      {invoice.description && (
        <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted">Keterangan</dt>
          <dd className="text-right text-sm text-ink">{invoice.description}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
        <dt className="text-xs uppercase tracking-[0.08em] text-muted">Total</dt>
        <dd className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink" data-total>
          {rupiah(invoice.total)}
        </dd>
      </div>
    </dl>
  );

  let body: React.ReactNode;

  if (invoice.status === "PAID") {
    body = (
      <div className="mt-8" data-state="paid">
        <div className="flex items-start gap-3 border border-line bg-white p-5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-ink text-paper" aria-hidden>
            <Check className="h-4 w-4" />
          </span>
          <p className="text-sm leading-relaxed text-ink">
            Terima kasih, {invoice.customerName}. Pembayaran Anda sudah masuk
            {invoice.paidAt ? ` pada ${new Date(invoice.paidAt).toLocaleString("id-ID")}` : ""}. Tim kami akan
            mengonfirmasi jadwal pemotretan lewat email.
          </p>
        </div>
        <Link href="/" className={`${GHOST_BTN} mt-6`}>
          Kembali ke beranda
        </Link>
      </div>
    );
  } else if (invoice.status === "CANCELLED" || invoice.status === "REFUNDED") {
    body = (
      <p className="mt-8 border border-line bg-white p-5 text-sm leading-relaxed text-ink" data-state="closed">
        {invoice.status === "CANCELLED"
          ? "Tagihan ini sudah dibatalkan. Hubungi admin bila Anda merasa ini keliru."
          : "Pembayaran untuk tagihan ini sudah dikembalikan."}
      </p>
    );
  } else if (live && !choosing) {
    const ins = invoice.instructions!;
    body = (
      <div className="mt-8" data-state="instructions">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-ink">{paymentMethodLabel(invoice.paymentMethod)}</span>
          {left !== null && (
            <span className="text-muted">
              Sisa waktu <span className="font-mono text-ink" data-countdown>{formatLeft(left)}</span>
            </span>
          )}
        </div>

        {ins.type === "va" && (
          <div className="mt-4 border border-line bg-white p-5">
            <p className={KICKER}>Nomor Virtual Account {ins.bank.toUpperCase()}</p>
            <p className="mt-3 break-all font-mono text-2xl tracking-wider text-ink sm:text-3xl" data-va>
              {ins.vaNumber}
            </p>
            <div className="mt-4">
              <CopyButton value={ins.vaNumber} label="Salin nomor Virtual Account" />
            </div>
            <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
              {BANK_STEPS(paymentMethodLabel(invoice.paymentMethod).replace(" Virtual Account", "")).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        )}

        {ins.type !== "va" && (
          <div className="mt-4 border border-line bg-white p-5 text-center">
            {ins.qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ins.qrUrl}
                alt="Kode QR pembayaran"
                className="mx-auto h-56 w-56 max-w-full"
                data-qr
              />
            ) : (
              <p className="text-sm text-muted">Kode QR belum tersedia. Pilih metode lain atau hubungi admin.</p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Buka aplikasi dompet digital atau mobile banking yang mendukung QRIS, lalu pindai kode ini.
            </p>
            {ins.type === "gopay" && ins.deeplinkUrl && (
              <a href={ins.deeplinkUrl} className={`${PRIMARY_BTN} mt-4`} data-deeplink>
                Buka GoPay
              </a>
            )}
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 text-sm text-muted" role="status" aria-live="polite">
          <span className="mt-1.5 inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-ink" aria-hidden />
          Menunggu pembayaran. Halaman ini diperbarui otomatis.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => refresh(true)} disabled={checking} className={GHOST_BTN}>
            {checking ? "Memeriksa..." : "Cek status"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChoosing(true);
              setError("");
            }}
            className={GHOST_BTN}
          >
            Ganti metode
          </button>
        </div>
      </div>
    );
  } else {
    const retry = invoice.status === "EXPIRED" || invoice.status === "FAILED";
    body = (
      <div className="mt-8" data-state="picker">
        {retry && (
          <p className="mb-5 border border-line bg-white p-4 text-sm leading-relaxed text-ink">
            {invoice.status === "EXPIRED"
              ? "Pembayaran sebelumnya sudah kedaluwarsa."
              : "Pembayaran sebelumnya tidak berhasil."}{" "}
            Pilih metode untuk membuat yang baru.
          </p>
        )}
        <p className="text-sm text-muted">Pilih metode pembayaran.</p>

        <div className="mt-4 space-y-6">
          {PAYMENT_GROUPS.map((group) => (
            <fieldset key={group.id}>
              <legend className={`${KICKER} mb-3`}>{group.label}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {methods
                  .filter((m) => m.group === group.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-method={m.id}
                      aria-pressed={selected === m.id}
                      onClick={() => setSelected(m.id)}
                      className={`border px-3 py-3.5 text-left text-sm font-medium transition-colors ${
                        selected === m.id
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-white text-ink hover:border-ink"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
              </div>
            </fieldset>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button type="button" onClick={pay} disabled={!selected || submitting} className={`${PRIMARY_BTN} mt-6`}>
          {submitting ? "Memproses..." : "Lanjut ke pembayaran"}
        </button>
        {live && choosing && (
          <button type="button" onClick={() => setChoosing(false)} className={`${GHOST_BTN} mt-2 w-full`}>
            Kembali ke instruksi
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
      {header}
      {summary}
      {body}
    </div>
  );
}
