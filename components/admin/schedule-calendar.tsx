"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import type { ScheduleMonth } from "@/lib/schedule";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Warna sel menurut jumlah order. Level 0 kosong; makin pekat makin padat. */
const LEVELS = [
  "bg-zinc-50 text-zinc-400 dark:bg-zinc-800/40 dark:text-zinc-500",
  "bg-primary/15 text-foreground",
  "bg-primary/30 text-foreground",
  "bg-primary/50 text-foreground",
  "bg-primary/80 text-primary-foreground",
];
const LEVEL_LABELS = ["Kosong", "1 order", "2 order", "3 order", "4+ order"];

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Baru",
  IN_REVIEW: "Ditinjau",
  NEGOTIATION: "Negosiasi",
  AGREED: "Disepakati",
  INVOICED: "Invoice",
  PAID: "Dibayar",
  SCHEDULED: "Terjadwal",
  COMPLETED: "Selesai",
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Kalender jadwal pemotretan: tiap tanggal diwarnai menurut jumlah order
 * supaya admin langsung melihat hari yang padat. Klik tanggal untuk daftar
 * permintaannya.
 */
export function ScheduleCalendar({ initial }: { initial: ScheduleMonth }) {
  const [data, setData] = useState<ScheduleMonth>(initial);
  const [month, setMonth] = useState(initial.month);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cache = useRef(new Map<string, ScheduleMonth>([[initial.month, initial]]));

  useEffect(() => {
    const cached = cache.current.get(month);
    if (cached) {
      setData(cached);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/admin/schedule?month=${month}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Gagal memuat jadwal");
        cache.current.set(month, json);
        setData(json);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month]);

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  // Kalender mulai hari Senin
  const leading = (new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay() + 6) % 7;

  const dayKey = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
  const busiest = Object.entries(data.days).reduce<[string, number] | null>(
    (best, [day, d]) => (!best || d.count > best[1] ? [day, d.count] : best),
    null
  );
  const monthTotal = Object.values(data.days).reduce((sum, d) => sum + d.count, 0);
  const selectedDay = selected ? data.days[selected] : undefined;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Jadwal pemotretan
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Order per tanggal pemotretan pilihan pelanggan. Makin pekat, makin padat.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMonth(shiftMonth(month, -1));
              setSelected(null);
            }}
            aria-label="Bulan sebelumnya"
            className="rounded-lg border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMonth(data.today.slice(0, 7));
              setSelected(null);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => {
              setMonth(shiftMonth(month, 1));
              setSelected(null);
            }}
            aria-label="Bulan berikutnya"
            className="rounded-lg border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Jadwal hari ini</dt>
          <dd className="mt-0.5 text-lg font-bold text-foreground" data-summary="today">
            {data.summary.today}
          </dd>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">7 hari ke depan</dt>
          <dd className="mt-0.5 text-lg font-bold text-foreground" data-summary="next7">
            {data.summary.next7}
          </dd>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Terpadat bulan ini</dt>
          <dd className="mt-0.5 text-lg font-bold text-foreground" data-summary="busiest">
            {busiest ? `${Number(busiest[0].slice(8))} (${busiest[1]})` : "-"}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground" aria-live="polite">
          {monthTitle(month)}
        </h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{monthTotal} order bulan ini</span>
      </div>

      {error && (
        <Alert className="mt-3" variant="error" title="Gagal memuat">
          {error}
        </Alert>
      )}

      <div
        className={`mt-3 grid grid-cols-7 gap-1 transition-opacity sm:gap-1.5 ${loading ? "opacity-50" : ""}`}
        role="grid"
        aria-label={`Kalender jadwal ${monthTitle(month)}`}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {w}
          </div>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`pad-${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const n = i + 1;
          const key = dayKey(n);
          const count = data.days[key]?.count ?? 0;
          const isToday = key === data.today;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              data-day={key}
              data-count={count}
              onClick={() => setSelected(isSelected ? null : key)}
              aria-pressed={isSelected}
              aria-label={`${longDate(key)}: ${count} order`}
              className={`flex h-12 flex-col items-start justify-between rounded-md p-1 text-left transition-colors sm:h-16 sm:p-1.5 ${
                LEVELS[Math.min(count, 4)]
              } ${isToday ? "ring-2 ring-primary" : ""} ${
                isSelected ? "outline outline-2 outline-offset-1 outline-foreground" : ""
              } hover:brightness-95 dark:hover:brightness-110`}
            >
              <span className="text-[11px] font-medium leading-none sm:text-xs">{n}</span>
              {count > 0 && (
                <span className="self-end text-xs font-bold leading-none sm:text-sm">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>Sepi</span>
        {LEVELS.map((cls, i) => (
          <span key={i} className="flex items-center gap-1">
            <span
              className={`inline-block h-3 w-3 rounded-sm border border-zinc-200 dark:border-zinc-700 ${cls.split(" ").filter((c) => c.startsWith("bg-") || c.startsWith("dark:bg-")).join(" ")}`}
              aria-hidden
            />
            <span className="sr-only">{LEVEL_LABELS[i]}</span>
          </span>
        ))}
        <span>Padat</span>
      </div>

      {/* Daftar permintaan pada tanggal terpilih */}
      {selected && (
        <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800" data-day-panel>
          <h3 className="text-sm font-semibold text-foreground">{longDate(selected)}</h3>
          {selectedDay && selectedDay.requests.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {selectedDay.requests.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/requests/${r.id}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-primary hover:bg-primary/5 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-foreground">{r.number}</p>
                      <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {r.customer_name}
                        {r.brand_name ? ` · ${r.brand_name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Belum ada jadwal pada tanggal ini.</p>
          )}
        </div>
      )}
    </section>
  );
}
