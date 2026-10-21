"use client";

import { useState, useEffect } from "react";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";
import { Search, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Visitor = {
  id: string;
  visitor_key: string;
  user_agent: string | null;
  device: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string | null;
  referrer: string | null;
  landing_page: string | null;
  visit_count: number;
  page_view_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

type Totals = {
  total_visitors: number;
  total_page_views: number;
  active_24h: number;
  mobile_visitors: number;
  desktop_visitors: number;
  tablet_visitors: number;
  bot_visitors: number;
};

const deviceStyles: Record<string, string> = {
  mobile: "bg-blue-100 text-blue-700",
  tablet: "bg-purple-100 text-purple-700",
  desktop: "bg-zinc-100 text-zinc-700",
  bot: "bg-amber-100 text-amber-700",
  unknown: "bg-zinc-100 text-zinc-600",
};

export default function AdminVisitors() {
  const { preview, openPreview, closePreview } = useTablePreview();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadVisitors();
  }, [search]);

  function previewVisitor(v: Visitor) {
    openPreview({
      title: v.visitor_key.slice(0, 16) + "…",
      subtitle: `${v.device_type} • ${v.browser} • ${v.os}`,
      meta: [
        { label: "Perangkat", value: v.device_type },
        { label: "Browser", value: v.browser },
        { label: "Sistem Operasi", value: v.os },
        { label: "IP Address", value: v.ip_address || "-" },
        { label: "Halaman awal", value: v.landing_page || "-" },
        { label: "Referrer", value: v.referrer || "-" },
        { label: "Kunjungan", value: `${v.visit_count}×` },
        { label: "Page view", value: `${v.page_view_count}×` },
        {
          label: "Terakhir dilihat",
          value: new Date(v.last_seen_at).toLocaleString("id-ID"),
        },
      ],
    });
  }

  async function loadVisitors() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/visitors?search=${encodeURIComponent(search)}`
      );
      if (!res.ok) throw new Error("Gagal memuat data visitor");
      const data = await res.json();
      setVisitors(data.visitors || []);
      setTotals(data.totals || null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data visitor");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" title="Gagal">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Visitor &amp; Trafik
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pelacakan pengunjung, perangkat, dan halaman yang dikunjungi.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari key, IP, atau halaman..."
              aria-label="Cari visitor"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            onClick={loadVisitors}
            aria-label="Muat ulang"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview double-click */}
      <TablePreview
        open={Boolean(preview)}
        onClose={closePreview}
        title={preview?.title}
        subtitle={preview?.subtitle}
        images={preview?.images}
        meta={preview?.meta}
      />

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Visitor" value={totals?.total_visitors ?? 0} />
        <StatCard label="Total Page View" value={totals?.total_page_views ?? 0} />
        <StatCard label="Aktif 24 Jam" value={totals?.active_24h ?? 0} />
        <StatCard
          label="Perangkat"
          value={`${totals?.mobile_visitors ?? 0}M / ${
            totals?.desktop_visitors ?? 0
          }D / ${totals?.tablet_visitors ?? 0}T`}
        />
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {[
                "Visitor Key",
                "Perangkat",
                "Browser / OS",
                "IP Address",
                "Halaman Awal",
                "Kunjungan",
                "Terakhir Seen",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6 ${
                    i >= 5 ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-4 sm:px-6">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : visitors.length > 0 ? (
              visitors.map((v) => (
                <tr
                  key={v.id}
                  onDoubleClick={() => previewVisitor(v)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-mono text-xs font-medium text-foreground">
                      {v.visitor_key.slice(0, 16)}…
                    </div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        deviceStyles[v.device] || deviceStyles.unknown
                      }`}
                    >
                      {v.device_type}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {v.browser} · {v.os}
                  </td>
                  <td className="px-4 py-4 sm:px-6 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {v.ip_address || "-"}
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {v.landing_page || "-"}
                  </td>
                  <td className="px-4 py-4 text-right sm:px-6">
                    <span className="text-sm font-medium text-foreground">
                      {v.visit_count}
                    </span>
                    <span className="ml-1 text-xs text-zinc-400">
                      ({v.page_view_count} pv)
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
                    {formatDate(v.last_seen_at)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Belum ada data visitor
                    {search ? " yang cocok dengan pencarian." : "."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
