import { query } from "./db";
import { decryptPii } from "./pii";

/**
 * Jadwal pemotretan menurut tanggal yang dipilih pelanggan
 * (requests.preferred_date). Permintaan yang masih draft, dibatalkan, atau
 * kedaluwarsa tidak dihitung karena tidak memakai slot.
 */
export type ScheduleRequest = {
  id: string;
  number: string;
  customer_name: string;
  brand_name: string | null;
  status: string;
};

export type ScheduleDay = { count: number; requests: ScheduleRequest[] };

export type ScheduleMonth = {
  /** 'YYYY-MM' */
  month: string;
  /** Hari ini (Asia/Jakarta), 'YYYY-MM-DD' */
  today: string;
  /** Kunci 'YYYY-MM-DD'; hari tanpa jadwal tidak ada di peta */
  days: Record<string, ScheduleDay>;
  /** Jadwal hari ini dan 7 hari ke depan (termasuk hari ini), tidak bergantung pada bulan yang dilihat */
  summary: { today: number; next7: number };
};

const EXCLUDED_STATUSES = ["DRAFT", "CANCELLED", "EXPIRED"];

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Tanggal hari ini di zona waktu bisnis (WIB), format 'YYYY-MM-DD'. */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonth(): string {
  return todayJakarta().slice(0, 7);
}

export async function getScheduleMonth(month: string): Promise<ScheduleMonth> {
  if (!MONTH_PATTERN.test(month)) throw new Error("Format bulan tidak valid");
  const today = todayJakarta();

  const [rows, counts] = await Promise.all([
    query<ScheduleRequest & { day: string }>(
      `SELECT id, number, customer_name, brand_name, status,
              to_char(preferred_date, 'YYYY-MM-DD') AS day
       FROM requests
       WHERE preferred_date >= $1::date
         AND preferred_date < ($1::date + INTERVAL '1 month')
         AND status <> ALL($2::text[])
       ORDER BY preferred_date, created_at`,
      [`${month}-01`, EXCLUDED_STATUSES]
    ),
    query<{ today: string; next7: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE preferred_date = $1::date) AS today,
         COUNT(*) FILTER (WHERE preferred_date >= $1::date AND preferred_date < $1::date + 7) AS next7
       FROM requests
       WHERE status <> ALL($2::text[])`,
      [today, EXCLUDED_STATUSES]
    ),
  ]);

  const days: Record<string, ScheduleDay> = {};
  for (const { day, ...req } of rows) {
    req.customer_name = decryptPii(req.customer_name, "customer_name") ?? "";
    (days[day] ??= { count: 0, requests: [] }).requests.push(req);
    days[day].count += 1;
  }

  return {
    month,
    today,
    days,
    summary: {
      today: Number(counts[0]?.today ?? 0),
      next7: Number(counts[0]?.next7 ?? 0),
    },
  };
}
