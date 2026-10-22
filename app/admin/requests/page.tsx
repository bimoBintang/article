"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/use-settings";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { STATUS_COLORS } from "@/lib/request-status";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function AdminRequests() {
  const { settings } = useSettings(true);
  const { preview, openPreview, closePreview } = useTablePreview();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    const controller = new AbortController();
    loadRequests(controller.signal);
    return () => controller.abort();
  }, [statusFilter, debouncedSearch]);

  function previewRequest(r: any) {
    openPreview({
      title: r.number,
      subtitle: r.customer_name,
      meta: [
        { label: "Pelanggan", value: r.customer_name },
        { label: "Email", value: r.customer_email },
        { label: "WhatsApp", value: r.customer_whatsapp || "-" },
        { label: "Brand", value: r.brand_name || "-" },
        { label: "Status", value: r.status },
        { label: "Item", value: `${r.item_count} item` },
        {
          label: "Total estimasi",
          value:
            settings.show_package_price && r.total_estimated
              ? `Rp ${r.total_estimated.toLocaleString("id-ID")}`
              : "-",
        },
        {
          label: "Dibuat",
          value: new Date(r.created_at).toLocaleString("id-ID"),
        },
      ],
    });
  }

  async function loadRequests(signal?: AbortSignal) {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/requests?${params}`, { signal });
      if (res.status === 401) {
        throw new Error("Sesi admin berakhir. Silakan masuk kembali.");
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memuat permintaan");
      }

      const data = await res.json();
      setRequests(data.requests ?? []);
      setError("");
    } catch (err) {
      // Permintaan lama dibatalkan karena filter berubah: abaikan
      if (err instanceof DOMException && err.name === "AbortError") return;
      setRequests([]);
      setError(err instanceof Error ? err.message : "Gagal memuat permintaan");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(requestId: string, newStatus: string) {
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status: newStatus }),
      });
      if (res.ok) {
        loadRequests();
      }
    } catch {
      alert("Gagal memperbarui status");
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

  const statusOrder: string[] = ["SUBMITTED", "IN_REVIEW", "NEGOTIATION", "AGREED", "INVOICED", "PAID", "SCHEDULED", "COMPLETED"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Kelola Permintaan
        </h1>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <input
            type="text"
            placeholder="Cari nomor, nama, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-auto dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ALL">Semua Status</option>
            {statusOrder.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <Alert variant="error" title="Gagal memuat data">
          {error}
        </Alert>
      ) : requests.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Nomor</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Pelanggan</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Tanggal</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Item</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {requests.map((r) => (
                <tr
                  key={r.id}
                  onDoubleClick={() => previewRequest(r)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800 group"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-mono font-medium text-sm text-foreground">{r.number}</div>
                    {r.request_type === "CUSTOM" && (
                      <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Customize
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-medium text-sm text-foreground">{r.customer_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.customer_email}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[r.status] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">{r.item_count} item</td>
                  <td className="px-4 py-4 sm:px-6 text-right">
                    <Link
                      href={`/admin/requests/${r.id}`}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Detail <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Alert variant="info" title="Tidak ada data">
          {(statusFilter !== "ALL" || search)
            ? "Tidak ada permintaan yang cocok dengan filter yang dipilih."
            : "Belum ada permintaan. Mulai menerima pesanan dari katalog."}
        </Alert>
      )}
      {/* Preview double-click */}
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
