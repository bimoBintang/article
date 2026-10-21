import Link from "next/link";
import { query } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth-server";
import { Alert } from "@/components/ui/alert";
import nextDynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDailyTraffic,
  getDeviceBreakdown,
  getRequestStatusBreakdown,
  getTopPages,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * Chart dimuat lazy: bundel recharts cukup besar dan di mode dev
 * kompilasi pertama bisa memakan waktu lama. Dengan lazy-load, halaman
 * dashboard langsung tampil dan chart menyusul.
 */
const DashboardCharts = nextDynamic(
  () =>
    import("@/components/admin/dashboard-charts").then(
      (mod) => mod.DashboardCharts
    ),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 p-5 lg:col-span-2 dark:border-zinc-800">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
          <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-4 h-44 w-full" />
          </div>
        </div>
      </div>
    ),
  }
);

export default async function AdminDashboard() {
  const session = await getCurrentSession();

  let stats: any = {
    totalRequests: 0,
    pendingRequests: 0,
    paidInvoices: 0,
    totalRevenue: 0,
  };

  let recentRequests: any[] = [];
  let dbAvailable = true;

  // Data untuk chart
  let traffic: Awaited<ReturnType<typeof getDailyTraffic>> = [];
  let devices: Awaited<ReturnType<typeof getDeviceBreakdown>> = [];
  let statuses: Awaited<ReturnType<typeof getRequestStatusBreakdown>> = [];
  let topPages: Awaited<ReturnType<typeof getTopPages>> = [];

  try {
    const [reqStats, invStats, recent, t, d, st, tp] = await Promise.all([
      query<any>(
        `SELECT status, COUNT(*) as cnt FROM requests GROUP BY status`
      ),
      query<any>(
        `SELECT status, COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM invoices GROUP BY status`
      ),
      query<any>(
        `SELECT r.*, COUNT(ri.id) as item_count FROM requests r LEFT JOIN request_items ri ON ri.request_id = r.id GROUP BY r.id ORDER BY r.created_at DESC LIMIT 5`
      ),
      getDailyTraffic(),
      getDeviceBreakdown(),
      getRequestStatusBreakdown(),
      getTopPages(),
    ]);

    traffic = t;
    devices = d;
    statuses = st;
    topPages = tp;

    stats.totalRequests = reqStats.reduce((sum: number, r: any) => sum + parseInt(r.cnt), 0);
    stats.pendingRequests = reqStats.find((r: any) => r.status === "SUBMITTED")?.cnt || 0;
    const paid = invStats.find((i: any) => i.status === "PAID");
    stats.paidInvoices = paid ? parseInt(paid.cnt) : 0;
    stats.totalRevenue = paid ? parseInt(paid.total) : 0;
    recentRequests = recent;
  } catch {
    dbAvailable = false;
  }

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-6">
      {!dbAvailable && (
        <Alert variant="warning" title="Database belum tersedia">
          Beberapa data mungkin tidak ditampilkan. Pastikan DATABASE_URL diatur dan skema
          telah dijalankan di Neon.
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Dashboard Admin
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Selamat datang, {session.email || "Admin"}. Berikut ringkasan aktivitas
          platform.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Permintaan"
          value={stats.totalRequests}
          accent="text-blue-600 dark:text-blue-400"
          bar="bg-blue-500"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingRequests}
          accent="text-amber-600 dark:text-amber-400"
          bar="bg-amber-500"
        />
        <StatCard
          title="Terbayar"
          value={stats.paidInvoices}
          accent="text-green-600 dark:text-green-400"
          bar="bg-green-500"
        />
        <StatCard
          title="Total Pendapatan"
          value={formatRupiah(stats.totalRevenue)}
          accent="text-indigo-600 dark:text-indigo-400"
          bar="bg-indigo-500"
        />
      </div>

      {/* Grafik & monitoring */}
      <DashboardCharts
        traffic={traffic}
        devices={devices}
        statuses={statuses}
        topPages={topPages}
      />

      {/* Panel bawah */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-bold text-foreground">
            Permintaan Terbaru
          </h2>
          <div className="space-y-2">
            {recentRequests.length > 0 ? (
              recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-foreground">
                      {req.number}
                    </p>
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                      {req.customer_name} · {req.item_count} item
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Belum ada permintaan.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-bold text-foreground">Aksi Cepat</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { label: "Kelola Permintaan", href: "/admin/requests" },
              { label: "Kelola Produk", href: "/admin/products" },
              { label: "Kelola Model", href: "/admin/models" },
              { label: "Kelola Invoice", href: "/admin/invoices" },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  accent,
  bar,
}: {
  title: string;
  value: number | string;
  accent: string;
  bar: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden="true" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
      <p
        className={`mt-1 break-words text-2xl font-bold ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SUBMITTED: "bg-amber-100 text-amber-700",
    IN_REVIEW: "bg-blue-100 text-blue-700",
    NEGOTIATION: "bg-orange-100 text-orange-700",
    AGREED: "bg-indigo-100 text-indigo-700",
    INVOICED: "bg-purple-100 text-purple-700",
    PAID: "bg-green-100 text-green-700",
    SCHEDULED: "bg-indigo-100 text-indigo-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
    EXPIRED: "bg-zinc-100 text-zinc-600",
    DRAFT: "bg-zinc-100 text-zinc-600",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] || "bg-zinc-100 text-zinc-600"
      }`}
    >
      {status}
    </span>
  );
}
