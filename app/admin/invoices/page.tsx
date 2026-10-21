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

export default function AdminInvoices() {
  const { settings } = useSettings(true);
  const { preview, openPreview, closePreview } = useTablePreview();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    PAID: "bg-green-50 text-green-700 border-green-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-gray-50 text-gray-700 border-gray-200",
    REFUNDED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  function previewInvoice(inv: any) {
    openPreview({
      title: inv.order_id || "Invoice",
      subtitle: inv.request_number ? `#${inv.request_number}` : undefined,
      meta: [
        { label: "Pelanggan", value: inv.customer_name || "-" },
        { label: "Email", value: inv.customer_email || "-" },
        {
          label: "Total",
          value: settings.show_package_price
            ? `Rp ${parseInt(inv.total || 0).toLocaleString("id-ID")}`
            : "-",
        },
        { label: "Status", value: inv.status || "-" },
        {
          label: "Dibuat",
          value: inv.created_at
            ? new Date(inv.created_at).toLocaleString("id-ID")
            : "-",
        },
      ],
    });
  }

  async function loadInvoices() {
    try {
      const rows = await query<any>(
        `SELECT i.*, r.number as request_number, r.customer_name, r.customer_email
         FROM invoices i
         JOIN requests r ON r.id = i.request_id
         ORDER BY i.created_at DESC`
      );
      setInvoices(rows);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">
        Kelola Invoice
      </h1>

      {invoices.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[780px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Order ID</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Permintaan</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Pelanggan</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Total</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6 text-right">Aksi</th>
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
                    <div className="font-mono font-medium text-sm text-foreground">{inv.order_id}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-medium text-sm text-foreground">#{inv.request_number}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{inv.customer_name}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">{inv.customer_email}</td>
                  <td className="px-4 py-4 sm:px-6 text-sm font-medium text-foreground">
                    {settings.show_package_price
                      ? `Rp ${parseInt(inv.total || 0).toLocaleString("id-ID")}`
                      : "-"}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[inv.status] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-right">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
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
        <Alert variant="info" title="Belum ada invoice">
          Invoice akan muncul setelah pelanggan menyelesaikan pembayaran Midtrans.
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
