"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ZoomIn } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { RequestInvoiceCard } from "@/components/admin/request-invoice-card";
import { TablePreview, type PreviewImage } from "@/components/admin/table-preview";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";
import { useSettings } from "@/lib/use-settings";
import { displayAdminPrice } from "@/lib/price";
import { REQUEST_STATUSES, STATUS_COLORS } from "@/lib/request-status";
import { modelGenderLabel } from "@/lib/model-gender";
import type {
  AdminRequestDetail,
  AdminRequestItem,
  AdminRequestLog,
  AdminRequestInvoice,
  AdminRequestReference,
} from "@/types";

type Notice = { type: "success" | "error"; text: string };

/** Item "Sesuai kebutuhan": tanpa paket, jumlah look dan foto dari client. */
function isCustomItem(item: AdminRequestItem): boolean {
  return (
    !item.package_name &&
    item.custom_look_count != null &&
    item.custom_photo_count != null
  );
}

type Detail = {
  request: AdminRequestDetail;
  items: AdminRequestItem[];
  logs: AdminRequestLog[];
  references: AdminRequestReference[];
  invoices: AdminRequestInvoice[];
};

class NotFoundError extends Error {}

/** Ambil detail permintaan dari API; melempar NotFoundError untuk 404. */
async function fetchDetail(id: string): Promise<Detail> {
  const res = await fetch(`/api/requests/${id}`);
  if (res.status === 404) throw new NotFoundError();
  if (res.status === 401) {
    throw new Error("Sesi admin berakhir. Silakan masuk kembali.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Gagal memuat detail permintaan");
  }
  const data = await res.json();
  return {
    request: data.request,
    items: data.items ?? [],
    logs: data.logs ?? [],
    references: data.references ?? [],
    invoices: data.invoices ?? [],
  };
}

/** Nomor WhatsApp Indonesia (08…/+62…) menjadi tautan wa.me. */
function whatsappUrl(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** 'YYYY-MM-DD' -> '29 Oktober 2026' tanpa melewati objek Date lokal. */
function formatPlainDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-medium ${
        STATUS_COLORS[status] ||
        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      {status}
    </span>
  );
}

const cardClass =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

export default function AdminRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings(true);

  const [request, setRequest] = useState<AdminRequestDetail | null>(null);
  const [items, setItems] = useState<AdminRequestItem[]>([]);
  const [logs, setLogs] = useState<AdminRequestLog[]>([]);
  const [references, setReferences] = useState<AdminRequestReference[]>([]);
  const [invoices, setInvoices] = useState<AdminRequestInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Pratinjau gambar layar penuh (referensi customize dan foto produk)
  const [lightbox, setLightbox] = useState<{
    images: PreviewImage[];
    index: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  const applyDetail = useCallback((d: Detail) => {
    setRequest(d.request);
    setItems(d.items);
    setLogs(d.logs);
    setReferences(d.references);
    setInvoices(d.invoices);
    setNewStatus(d.request.status);
    setError("");
    setNotFound(false);
  }, []);

  const applyError = useCallback((err: unknown) => {
    if (err instanceof NotFoundError) {
      setNotFound(true);
      return;
    }
    setError(
      err instanceof Error ? err.message : "Gagal memuat detail permintaan"
    );
  }, []);

  useEffect(() => {
    // `active` mencegah state diisi setelah halaman ditinggalkan / id berganti
    let active = true;
    fetchDetail(id)
      .then((d) => active && applyDetail(d))
      .catch((err) => active && applyError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, applyDetail, applyError]);

  async function saveStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!request || newStatus === request.status) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          status: newStatus,
          notes: statusNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memperbarui status");
      }

      setStatusNotes("");
      setNotice({ type: "success", text: `Status diubah menjadi ${newStatus}.` });
      applyDetail(await fetchDetail(id));
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memperbarui status",
      });
    } finally {
      setSaving(false);
    }
  }

  const backLink = (
    <Link
      href="/admin/requests"
      className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-foreground dark:text-zinc-400"
    >
      <ChevronLeft className="h-4 w-4" />
      Kembali ke daftar permintaan
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonPageHeader />
        <SkeletonTable columns={5} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        {backLink}
        <Alert variant="warning" title="Permintaan tidak ditemukan">
          Permintaan ini tidak ada atau sudah dihapus.
        </Alert>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        {backLink}
        <Alert variant="error" title="Gagal memuat data">
          {error || "Data permintaan tidak tersedia."}
        </Alert>
      </div>
    );
  }

  const wa = whatsappUrl(request.customer_whatsapp);
  const showPrice = settings.show_package_price;
  const statusChanged = newStatus !== request.status;

  const customerRows: { label: string; value: React.ReactNode }[] = [
    { label: "Nama", value: request.customer_name },
    {
      label: "Email",
      value: (
        <a
          href={`mailto:${request.customer_email}`}
          className="text-primary hover:underline"
        >
          {request.customer_email}
        </a>
      ),
    },
    {
      label: "WhatsApp",
      value: wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {request.customer_whatsapp}
        </a>
      ) : (
        request.customer_whatsapp || "-"
      ),
    },
    { label: "Brand", value: request.brand_name || "-" },
    {
      label: "Tanggal diinginkan",
      value: request.preferred_date
        ? formatPlainDate(request.preferred_date)
        : "-",
    },
    {
      label: "Persetujuan data",
      value: request.personal_data_consent ? "Disetujui" : "Belum",
    },
  ];

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-mono text-xl font-bold text-foreground sm:text-2xl">
          {request.number}
        </h1>
        <StatusBadge status={request.status} />
        {request.request_type === "CUSTOM" && (
          <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Customize
          </span>
        )}
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Dibuat {formatDate(request.created_at)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kolom kiri: item + riwayat */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {request.request_type === "CUSTOM" && (
            <section className={cardClass}>
              <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-foreground dark:border-zinc-800 sm:px-6">
                Brief customize
              </h2>
              <div className="space-y-4 p-4 sm:p-6">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Produk / koleksi</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{request.custom_title}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Deskripsi kebutuhan</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-sm text-foreground">
                    {request.custom_description}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Referensi ({references.length})
                  </p>
                  {references.length > 0 ? (
                    <div className="mt-2 space-y-3">
                      {references.some((r) => r.kind === "IMAGE") && (
                        <>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {references
                              .filter((r) => r.kind === "IMAGE")
                              .map((r, i, all) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  data-ref-thumb
                                  onClick={() =>
                                    setLightbox({
                                      images: all.map((x, n) => ({ url: x.url, alt: `Referensi ${n + 1}` })),
                                      index: i,
                                      title: "Referensi customize",
                                      subtitle: `${request.number} · gambar ${i + 1} dari ${all.length}`,
                                    })
                                  }
                                  aria-label={`Perbesar referensi ${i + 1}`}
                                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-800"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={r.url}
                                    alt={`Referensi ${i + 1}`}
                                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <span
                                    aria-hidden
                                    className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                                  >
                                    <ZoomIn className="h-3.5 w-3.5" />
                                  </span>
                                </button>
                              ))}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Klik gambar untuk memperbesar. Di pratinjau, klik gambar lagi untuk ukuran asli.
                          </p>
                        </>
                      )}
                      <ul className="space-y-1">
                        {references
                          .filter((r) => r.kind === "LINK")
                          .map((r) => (
                            <li key={r.id} className="break-all text-sm">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {r.url}
                              </a>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">Tidak ada referensi.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className={cardClass}>
            <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-foreground dark:border-zinc-800 sm:px-6">
              Item permintaan ({items.length})
            </h2>

            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      {["Produk", "Paket", "Model", "Jml", "Estimasi"].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={`whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:px-6 ${
                              i === 4 ? "text-right" : ""
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 sm:px-6">
                          <div className="flex items-center gap-3">
                            {item.product_thumbnail && (
                              <button
                                type="button"
                                data-item-thumb
                                onClick={() => {
                                  const withPhoto = items.filter((x) => x.product_thumbnail);
                                  setLightbox({
                                    images: withPhoto.map((x) => ({
                                      url: x.product_thumbnail as string,
                                      alt: x.product_name ?? "Produk",
                                    })),
                                    index: withPhoto.findIndex((x) => x.id === item.id),
                                    title: item.product_name ?? "Foto produk",
                                    subtitle: request.number,
                                  });
                                }}
                                aria-label={`Perbesar foto ${item.product_name ?? "produk"}`}
                                className="shrink-0 overflow-hidden rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.product_thumbnail}
                                  alt=""
                                  className="h-12 w-12 cursor-zoom-in object-cover"
                                />
                              </button>
                            )}
                            <span className="text-sm font-medium text-foreground">
                              {item.product_name ||
                                (request.request_type === "CUSTOM" ? request.custom_title : null) ||
                                "-"}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {item.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 sm:px-6">
                          {isCustomItem(item) ? (
                            <>
                              <span>Sesuai kebutuhan</span>
                              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                {item.custom_look_count} look • {item.custom_photo_count} foto
                              </span>
                            </>
                          ) : (
                            item.package_name || "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 sm:px-6">
                          {/* talent_name: data lama dari sebelum pilihan jenis model */}
                          {modelGenderLabel(item.model_gender) ||
                            item.talent_name ||
                            "-"}
                          {item.model_notes && (
                            <span className="mt-0.5 block max-w-[16rem] whitespace-pre-line text-xs text-zinc-500 dark:text-zinc-400">
                              {item.model_notes}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 sm:px-6">
                          {item.quantity}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-foreground sm:px-6">
                          {isCustomItem(item)
                            ? "Disepakati"
                            : displayAdminPrice(
                                (item.estimated_price ?? 0) * item.quantity,
                                showPrice
                              )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 sm:px-6">
                Permintaan ini tidak memiliki item.
              </p>
            )}

            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800 sm:px-6">
              <span className="text-zinc-500 dark:text-zinc-400">
                Total estimasi
              </span>
              <span className="font-semibold text-foreground">
                {displayAdminPrice(request.total_estimated, showPrice)}
              </span>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-foreground dark:border-zinc-800 sm:px-6">
              Riwayat status
            </h2>
            {logs.length > 0 ? (
              <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {logs.map((log) => (
                  <li key={log.id} className="px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {log.from_status && (
                        <>
                          <StatusBadge status={log.from_status} />
                          <span className="text-xs text-zinc-400">menjadi</span>
                        </>
                      )}
                      <StatusBadge status={log.to_status} />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(log.changed_at)}
                      {log.changed_by ? ` · oleh ${log.changed_by}` : ""}
                    </p>
                    {log.notes && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                        {log.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 sm:px-6">
                Belum ada riwayat perubahan status.
              </p>
            )}
          </section>
        </div>

        {/* Kolom kanan: ubah status + pelanggan */}
        <div className="min-w-0 space-y-6">
          <section className={`${cardClass} p-4 sm:p-6`}>
            <h2 className="text-sm font-semibold text-foreground">
              Ubah status
            </h2>
            <form onSubmit={saveStatus} className="mt-4 space-y-3">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                aria-label="Status baru"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900"
              >
                {REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                    {s === request.status ? " (saat ini)" : ""}
                  </option>
                ))}
              </select>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Catatan perubahan (opsional)"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="submit"
                disabled={!statusChanged || saving}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan status"}
              </button>
            </form>
            {notice && (
              <div className="mt-3">
                <Alert
                  variant={notice.type}
                  title={notice.type === "success" ? "Berhasil" : "Gagal"}
                >
                  {notice.text}
                </Alert>
              </div>
            )}
          </section>

          <RequestInvoiceCard
            requestId={request.id}
            requestStatus={request.status}
            totalEstimated={request.total_estimated}
            invoices={invoices}
            onChanged={async () => applyDetail(await fetchDetail(id))}
          />

          <section className={`${cardClass} p-4 sm:p-6`}>
            <h2 className="text-sm font-semibold text-foreground">Pelanggan</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {customerRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 break-words text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
              {request.notes && (
                <div>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                    Catatan pelanggan
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line text-foreground">
                    {request.notes}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>

      <TablePreview
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        images={lightbox?.images}
        startIndex={lightbox?.index}
        title={lightbox?.title}
        subtitle={lightbox?.subtitle}
      />
    </div>
  );
}
