import { randomBytes } from "crypto";
import { isIP } from "node:net";
import { getSql } from "@/lib/db";

/**
 * Utilitas pelacakan visitor:
 * - Membuat visitor key unik (cookie) sebagai identitas perangkat
 * - Mendeteksi device, browser, dan OS dari User-Agent
 * - Mengambil IP address dari header proxy
 * - Menyimpan ke tabel `visitors` dan `page_views`
 */

export const VISITOR_COOKIE = "ek_vid";

export type DeviceInfo = {
  device: string;
  deviceType: string;
  browser: string;
  os: string;
};

/**
 * Parse User-Agent menjadi informasi device.
 */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
  const ua = userAgent || "";
  const empty = {
    device: "unknown",
    deviceType: "unknown",
    browser: "unknown",
    os: "unknown",
  };

  if (!ua) return empty;

  // Bot / crawler
  if (
    /bot|crawl|spider|slurp|bingpreview|headless|facebookexternalhit|monitoring|curl|wget|python-requests/i.test(
      ua
    )
  ) {
    return { device: "bot", deviceType: "bot", browser: "unknown", os: "unknown" };
  }

  // Device type
  let device = "desktop";
  let deviceType = "desktop";

  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) {
    device = "tablet";
    deviceType = "tablet";
  } else if (
    /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile|webOS/i.test(
      ua
    )
  ) {
    device = "mobile";
    deviceType = "smartphone";
  }

  // Browser
  let browser = "unknown";
  if (/Edg\//i.test(ua) || /Edge\//i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Firefox\//i.test(ua) || /FxiOS/i.test(ua)) {
    browser = "Firefox";
  } else if (/Chrome\//i.test(ua) || /CriOS/i.test(ua)) {
    browser = "Chrome";
  } else if (/Safari\//i.test(ua)) {
    browser = "Safari";
  } else if (/MSIE|Trident/i.test(ua)) {
    browser = "Internet Explorer";
  }

  // OS
  let os = "unknown";
  if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  return { device, deviceType, browser, os };
}

/** Jumlah proxy tepercaya di depan aplikasi (1 = satu CDN/load balancer yang menambahkan IP klien di ujung kanan x-forwarded-for). */
function trustedProxyCount(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "", 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Buang port/kurung dari entri header lalu pastikan berupa alamat IP yang valid. */
function cleanIp(value: string | null | undefined): string | null {
  let ip = value?.trim() ?? "";
  const bracket = /^\[(.+)\](?::\d+)?$/.exec(ip);
  if (bracket) ip = bracket[1];
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(":")[0];
  if (!ip || ip === "::1" || isIP(ip) === 0) return null;
  return ip;
}

/**
 * IP klien yang bisa dipercaya untuk pembatas laju dan analitik.
 *
 * Header yang dikirim klien mudah dipalsukan, jadi hanya yang ditambahkan proxy
 * kita sendiri yang dipakai:
 * - `CLIENT_IP_HEADER` diisi (mis. `x-vercel-forwarded-for`, `cf-connecting-ip`):
 *   hanya header itu yang dibaca.
 * - selain itu `x-forwarded-for`, entri ke-`TRUSTED_PROXY_COUNT` dari kanan
 *   (isian klien berada di kiri dan diabaikan).
 * Tanpa proxy (mis. lokal) hasilnya null.
 */
export function getClientIp(headers: Headers): string | null {
  const custom = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (custom) return cleanIp(headers.get(custom)?.split(",")[0]);

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
  return cleanIp(hops[Math.max(hops.length - trustedProxyCount(), 0)]);
}

/** Jadikan 8 kelompok heksadesimal dari alamat IPv6 (menguraikan "::"). */
function expandIpv6(ip: string): string[] | null {
  const [head, tail, extra] = ip.split("::");
  if (extra !== undefined) return null;
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? left.length !== 8 : missing < 0) return null;
  return [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right];
}

/**
 * Samarkan IP sebelum disimpan: IPv4 jadi /24 (a.b.c.0), IPv6 jadi /48 (a:b:c::).
 * Cukup untuk statistik wilayah/perangkat, tetapi tidak lagi menunjuk satu orang.
 */
export function anonymizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const v4 = mapped ? mapped[1] : ip;
  if (isIP(v4) === 4) {
    const parts = v4.split(".");
    parts[3] = "0";
    return parts.join(".");
  }
  if (isIP(ip) === 6) {
    const groups = expandIpv6(ip);
    if (!groups) return null;
    return `${groups.slice(0, 3).map((g) => g.replace(/^0+(?=.)/, "").toLowerCase()).join(":")}::`;
  }
  return null;
}

/**
 * Buat visitor key baru (random, stabil per cookie).
 */
export function generateVisitorKey(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Catat kunjungan visitor: upsert ke `visitors` + insert ke `page_views`.
 *
 * @param visitorKey Key dari cookie (dibuat di proxy bila belum ada)
 * @param path Path halaman yang diakses
 * @param userAgent User-Agent mentah
 * @param ipAddress IP address
 * @param referrer Referrer / halaman sebelumnya
 */
export async function trackVisit({
  visitorKey,
  path,
  userAgent,
  ipAddress: rawIp,
  referrer,
}: {
  visitorKey: string;
  path: string;
  userAgent: string | null;
  /** IP penuh dari getClientIp; disamarkan sebelum disimpan */
  ipAddress: string | null;
  referrer: string | null;
}): Promise<void> {
  const { device, deviceType, browser, os } = parseUserAgent(userAgent);
  // Hanya IP tersamar yang masuk database; IP penuh dipakai sebatas pembatas laju
  const ipAddress = anonymizeIp(rawIp);
  const sql = getSql();

  // Upsert visitor
  const rows = await sql`
    INSERT INTO visitors (
      visitor_key, user_agent, device, device_type, browser, os,
      ip_address, referrer, landing_page, visit_count,
      first_seen_at, last_seen_at, updated_at
    )
    VALUES (
      ${visitorKey}, ${userAgent}, ${device}, ${deviceType}, ${browser}, ${os},
      ${ipAddress}, ${referrer}, ${path}, 1,
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (visitor_key) DO UPDATE SET
      last_seen_at = NOW(),
      updated_at = NOW(),
      visit_count = visitors.visit_count + 1,
      ip_address = COALESCE(EXCLUDED.ip_address, visitors.ip_address),
      user_agent = COALESCE(EXCLUDED.user_agent, visitors.user_agent),
      device = EXCLUDED.device,
      device_type = EXCLUDED.device_type,
      browser = EXCLUDED.browser,
      os = EXCLUDED.os
    RETURNING id
  `;

  const visitorId = (rows as any[])[0]?.id;

  // Insert page view
  await sql`
    INSERT INTO page_views (
      visitor_id, visitor_key, path, referrer, ip_address, device, browser, os
    )
    VALUES (
      ${visitorId ?? null}, ${visitorKey}, ${path}, ${referrer},
      ${ipAddress}, ${device}, ${browser}, ${os}
    )
  `;

  // Pembersihan masa simpan dijalankan sesekali supaya tidak butuh cron
  const rate = Number.parseFloat(process.env.VISITOR_PURGE_RATE ?? "0.01");
  if (Math.random() < (Number.isFinite(rate) ? rate : 0.01)) {
    await purgeOldVisitorData();
  }
}

/** Masa simpan data pengunjung. Statistik dashboard hanya memakai data terbaru. */
export const VISITOR_RETENTION_DAYS = 90;

/** Hapus kunjungan dan pengunjung yang tidak aktif lebih dari masa simpan. */
export async function purgeOldVisitorData(): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM page_views WHERE created_at < NOW() - make_interval(days => ${VISITOR_RETENTION_DAYS})`;
  await sql`DELETE FROM visitors WHERE last_seen_at < NOW() - make_interval(days => ${VISITOR_RETENTION_DAYS})`;
}

