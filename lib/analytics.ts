import { query } from "./db";

/**
 * Data agregat untuk chart dashboard.
 *
 * Semua query dijalankan di server (Postgres) supaya tidak menarik
 * thousands of rows ke browser.
 */

export type DailyTraffic = {
  /** 'YYYY-MM-DD' */
  day: string;
  /** Label siap tampil, mis. '21 Okt' */
  label: string;
  /** Pengunjung unik pada hari tersebut */
  visitors: number;
  /** Total page view pada hari tersebut */
  pageViews: number;
  /** Jumlah permintaan dibuat pada hari tersebut */
  requests: number;
};

export type DeviceBreakdown = {
  name: string;
  value: number;
};

export type StatusBreakdown = {
  name: string;
  value: number;
};

export type TopPage = {
  path: string;
  value: number;
};

export type ChartRange = 7 | 14 | 30;

/** Jumlah hari data yang diambil dari database. */
export const CHART_DAYS = 30;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Ubah 'YYYY-MM-DD' menjadi label 'D MMM' (waktu lokal). */
function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return `${d} ${MONTHS[m - 1]}`;
}

/**
 * Deret harian untuk N hari terakhir, termasuk hari tanpa data (nilai 0).
 */
export function buildDaySeries(days: number = CHART_DAYS): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }
  return out;
}

/**
 * Trafik harian: pengunjung unik, page view, dan jumlah permintaan.
 */
export async function getDailyTraffic(
  days: number = CHART_DAYS
): Promise<DailyTraffic[]> {
  const series = buildDaySeries(days);

  const [trafficRows, requestRows] = await Promise.all([
    query<{ day: string; visitors: number; page_views: number }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(DISTINCT visitor_key) AS visitors,
              COUNT(*) AS page_views
       FROM page_views
       WHERE created_at >= date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day'
       GROUP BY 1`,
      [days]
    ),
    query<{ day: string; cnt: number }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*) AS cnt
       FROM requests
       WHERE created_at >= date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day'
       GROUP BY 1`,
      [days]
    ),
  ]);

  const trafficMap = new Map(
    trafficRows.map((r) => [
      r.day,
      {
        visitors: Number(r.visitors ?? 0),
        pageViews: Number(r.page_views ?? 0),
      },
    ])
  );
  const requestMap = new Map(
    requestRows.map((r) => [r.day, Number(r.cnt ?? 0)])
  );

  return series.map((day) => {
    const t = trafficMap.get(day);
    return {
      day,
      label: formatDay(day),
      visitors: t?.visitors ?? 0,
      pageViews: t?.pageViews ?? 0,
      requests: requestMap.get(day) ?? 0,
    };
  });
}

/** Komposisi perangkat pengunjung. */
export async function getDeviceBreakdown(): Promise<DeviceBreakdown[]> {
  try {
    const rows = await query<{ device: string; cnt: number }>(
      `SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS cnt
       FROM visitors
       GROUP BY 1
       ORDER BY cnt DESC`
    );
    return rows.map((r) => ({ name: r.device, value: Number(r.cnt ?? 0) }));
  } catch {
    return [];
  }
}

/** Sebaran status permintaan. */
export async function getRequestStatusBreakdown(): Promise<StatusBreakdown[]> {
  try {
    const rows = await query<{ status: string; cnt: number }>(
      `SELECT status, COUNT(*) AS cnt
       FROM requests
       GROUP BY 1
       ORDER BY cnt DESC`
    );
    return rows.map((r) => ({ name: r.status, value: Number(r.cnt ?? 0) }));
  } catch {
    return [];
  }
}

/** Halaman yang paling sering dibuka pengunjung. */
export async function getTopPages(limit = 6): Promise<TopPage[]> {
  try {
    const rows = await query<{ path: string; cnt: number }>(
      `SELECT path, COUNT(*) AS cnt
       FROM page_views
       GROUP BY 1
       ORDER BY cnt DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({ path: r.path, value: Number(r.cnt ?? 0) }));
  } catch {
    return [];
  }
}

/** Ringkasan singkat untuk kartu judul chart. */
export async function getTrafficSummary(days: number = CHART_DAYS) {
  const series = await getDailyTraffic(days);
  const totals = series.reduce(
    (acc, d) => ({
      visitors: acc.visitors + d.visitors,
      pageViews: acc.pageViews + d.pageViews,
      requests: acc.requests + d.requests,
    }),
    { visitors: 0, pageViews: 0, requests: 0 }
  );
  return { totals, series };
}
