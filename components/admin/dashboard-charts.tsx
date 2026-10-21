"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  MousePointerClick,
  FileText,
  Smartphone,
  Monitor,
  Tablet,
  Bot,
  Globe,
} from "lucide-react";
import type {
  DailyTraffic,
  DeviceBreakdown,
  StatusBreakdown,
  TopPage,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Palet & util
 * ------------------------------------------------------------------ */

const SERIES = {
  visitors: "var(--primary)",
  pageViews: "#6366f1",
  requests: "#f59e0b",
} as const;

const DEVICE_COLORS: Record<string, string> = {
  mobile: "var(--primary)",
  desktop: "#6366f1",
  tablet: "#f59e0b",
  bot: "#a1a1aa",
  unknown: "#d4d4d8",
};

const DEVICE_META: Record<
  string,
  { label: string; icon: typeof Users; color: string }
> = {
  mobile: { label: "Mobile", icon: Smartphone, color: DEVICE_COLORS.mobile },
  desktop: { label: "Desktop", icon: Monitor, color: DEVICE_COLORS.desktop },
  tablet: { label: "Tablet", icon: Tablet, color: DEVICE_COLORS.tablet },
  bot: { label: "Bot", icon: Bot, color: DEVICE_COLORS.bot },
  unknown: {
    label: "Tidak diketahui",
    icon: Globe,
    color: DEVICE_COLORS.unknown,
  },
};

/** Tooltip dengan tema mengikuti dark mode. */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  formatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--chart-tooltip-bg)",
        borderColor: "var(--chart-tooltip-border)",
        color: "var(--chart-tooltip-text)",
      }}
    >
      {label != null && (
        <p className="mb-1 font-semibold">{String(label)}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="opacity-70">{entry.name}:</span>
          <span className="font-semibold tabular-nums">
            {formatter
              ? formatter(entry.value ?? 0)
              : Number(entry.value ?? 0).toLocaleString("id-ID")}
          </span>
        </p>
      ))}
    </div>
  );
}

const AXIS_PROPS = {
  stroke: "var(--chart-axis)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/* ------------------------------------------------------------------ *
 * Komponen utama
 * ------------------------------------------------------------------ */

export function DashboardCharts({
  traffic,
  devices,
  statuses,
  topPages,
}: {
  traffic: DailyTraffic[];
  devices: DeviceBreakdown[];
  statuses: StatusBreakdown[];
  topPages: TopPage[];
}) {
  const [range, setRange] = useState<7 | 14 | 30>(14);

  const sliced = useMemo(
    () => traffic.slice(Math.max(0, traffic.length - range)),
    [traffic, range]
  );

  const totals = useMemo(
    () =>
      sliced.reduce(
        (acc, d) => ({
          visitors: acc.visitors + d.visitors,
          pageViews: acc.pageViews + d.pageViews,
          requests: acc.requests + d.requests,
        }),
        { visitors: 0, pageViews: 0, requests: 0 }
      ),
    [sliced]
  );

  const hasTraffic = totals.pageViews > 0;
  const hasRequests = totals.requests > 0;

  return (
    <div className="space-y-6">
      {/* Filter rentang waktu */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Grafik &amp; Monitoring
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pantau trafik pengunjung dan permintaan masuk.
          </p>
        </div>
        <div
          role="group"
          aria-label="Pilih rentang waktu"
          className="flex shrink-0 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700"
        >
          {([7, 14, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-primary text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {r} hari
            </button>
          ))}
        </div>
      </div>

      {/* ===== Monitoring visitor ===== */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        {/* Grafik trafik (2/3 lebar) */}
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Trafik Pengunjung
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Pengunjung unik &amp; page view per hari
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <MiniStat
                label="Pengunjung"
                value={totals.visitors}
                color={SERIES.visitors}
              />
              <MiniStat
                label="Page view"
                value={totals.pageViews}
                color={SERIES.pageViews}
              />
            </div>
          </div>

          {hasTraffic ? (
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sliced}
                  margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={SERIES.visitors}
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor={SERIES.visitors}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="fillPageViews" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={SERIES.pageViews}
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor={SERIES.pageViews}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={18} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} width={44} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--chart-axis)" }} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: 12,
                      color: "var(--chart-tooltip-text)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pageViews"
                    name="Page view"
                    stroke={SERIES.pageViews}
                    strokeWidth={2}
                    fill="url(#fillPageViews)"
                  />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    name="Pengunjung"
                    stroke={SERIES.visitors}
                    strokeWidth={2}
                    fill="url(#fillVisitors)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<MousePointerClick className="h-8 w-8" />}
              title="Belum ada trafik"
              desc="Data pengunjung akan muncul di sini setelah ada kunjungan."
            />
          )}
        </section>

        {/* Komposisi perangkat */}
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Smartphone className="h-4 w-4 text-primary" />
            Komposisi Perangkat
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Total unique visitor per perangkat
          </p>

          {devices.length > 0 ? (
            <>
              <div className="mt-2 h-44 w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={devices.map((d) => ({
                        ...d,
                        fill:
                          DEVICE_META[d.name]?.color ??
                          DEVICE_COLORS.unknown,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={74}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {devices.map((d) => (
                        <Cell
                          key={d.name}
                          fill={
                            DEVICE_META[d.name]?.color ??
                            DEVICE_COLORS.unknown
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="mt-2 space-y-1.5">
                {devices.map((d) => {
                  const meta = DEVICE_META[d.name] ?? DEVICE_META.unknown;
                  const Icon = meta.icon;
                  const total = devices.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                  return (
                    <li
                      key={d.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <Icon className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="flex-1 text-zinc-600 dark:text-zinc-400">
                        {meta.label}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {d.value.toLocaleString("id-ID")}
                      </span>
                      <span className="w-9 text-right tabular-nums text-zinc-400">
                        {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={<Smartphone className="h-8 w-8" />}
              title="Belum ada data perangkat"
              desc="Komposisi perangkat tampil setelah ada pengunjung."
            />
          )}
        </section>
      </div>

      {/* ===== Permintaan ===== */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        {/* Permintaan per hari */}
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Permintaan per Hari
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Jumlah permintaan pemotretan yang dibuat
              </p>
            </div>
            <MiniStat
              label="Total"
              value={totals.requests}
              color={SERIES.requests}
            />
          </div>

          {hasRequests ? (
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sliced}
                  margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={18} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} width={44} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--chart-grid)" }}
                  />
                  <Bar
                    dataKey="requests"
                    name="Permintaan"
                    fill={SERIES.requests}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Belum ada permintaan"
              desc="Grafik permintaan muncul setelah ada pelanggan yang mengirim formulir."
            />
          )}
        </section>

        {/* Status permintaan */}
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            Status Permintaan
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Sebaran seluruh permintaan
          </p>

          {statuses.length > 0 ? (
            <div className="mt-4 h-56 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statuses}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    {...AXIS_PROPS}
                    width={104}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--chart-grid)" }}
                  />
                  <Bar
                    dataKey="value"
                    name="Permintaan"
                    fill={SERIES.requests}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Belum ada permintaan"
              desc="Sebaran status tampil setelah ada permintaan masuk."
            />
          )}
        </section>
      </div>

      {/* ===== Halaman terpopuler ===== */}
      {topPages.length > 0 && (
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Globe className="h-4 w-4 text-primary" />
            Halaman Paling Sering Dibuka
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            6 halaman dengan page view terbanyak
          </p>

          <div className="mt-4 h-56 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topPages}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--chart-grid)"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="path"
                  {...AXIS_PROPS}
                  width={150}
                  tickFormatter={(v: string) =>
                    v.length > 20 ? `${v.slice(0, 19)}…` : v
                  }
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--chart-grid)" }}
                />
                <Bar
                  dataKey="value"
                  name="Page view"
                  fill={SERIES.pageViews}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Helper UI
 * ------------------------------------------------------------------ */

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <div>
        <p className="text-[11px] leading-none text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
          {value.toLocaleString("id-ID")}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <span className="text-zinc-300 dark:text-zinc-700">{icon}</span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
    </div>
  );
}
