"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/use-settings";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { query } from "@/lib/db";
import { Alert } from "@/components/ui/alert";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function AdminRequests() {
  const { settings } = useSettings(true);
  const { preview, openPreview, closePreview } = useTablePreview();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const statusColors: Record<string, string> = {
    DRAFT: "bg-zinc-100 text-zinc-700",
    SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
    IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
    NEGOTIATION: "bg-orange-50 text-orange-700 border-orange-200",
    AGREED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    INVOICED: "bg-purple-50 text-purple-700 border-purple-200",
    PAID: "bg-green-50 text-green-700 border-green-200",
    SCHEDULED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-gray-50 text-gray-700 border-gray-200",
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, search]);

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

  async function loadRequests() {
    try {
      let sql = `
        SELECT r.*, COUNT(ri.id) as item_count
        FROM requests r
        LEFT JOIN request_items ri ON ri.request_id = r.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (statusFilter !== "ALL") {
        params.push(statusFilter);
        sql += ` AND r.status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (r.number ILIKE $${params.length} OR r.customer_name ILIKE $${params.length} OR r.customer_email ILIKE $${params.length})`;
      }

      sql += ` GROUP BY r.id ORDER BY r.created_at DESC`;

      const rows = await query<any>(sql, params);
      setRequests(rows);
    } catch {
      setRequests([]);
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
  const filtered = requests.filter((r) => statusFilter === "ALL" || r.status === statusFilter);

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

      {filtered.length > 0 ? (
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
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onDoubleClick={() => previewRequest(r)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800 group"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-mono font-medium text-sm text-foreground">{r.number}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-medium text-sm text-foreground">{r.customer_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.customer_email}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[r.status] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
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
