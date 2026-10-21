import { randomBytes } from "crypto";
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

/**
 * Ambil IP address dari header proxy (x-forwarded-for, x-real-ip, dll).
 */
export function getClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-vercel-forwarded-for"),
  ];

  for (const value of candidates) {
    if (!value) continue;
    // x-forwarded-for bisa berisi daftar: "ip1, ip2, ip3"
    const ip = value.split(",")[0]?.trim();
    if (ip && ip !== "::1" && ip !== "unknown") {
      return ip.slice(0, 45);
    }
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
  ipAddress,
  referrer,
}: {
  visitorKey: string;
  path: string;
  userAgent: string | null;
  ipAddress: string | null;
  referrer: string | null;
}): Promise<void> {
  const { device, deviceType, browser, os } = parseUserAgent(userAgent);
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
}
