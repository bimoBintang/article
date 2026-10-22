/**
 * Samarkan IP lama di tabel `visitors` dan `page_views` (satu kali, aman diulang).
 *
 * IPv4 dipotong ke /24 (a.b.c.0), IPv6 ke /48 (a:b:c::). Nilai yang sudah tersamar
 * dibiarkan; nilai yang bukan alamat IP diubah menjadi NULL. Setelah ini `trackVisit` (lib/visitor.ts) hanya
 * menyimpan IP tersamar, sehingga skrip ini cukup dijalankan sekali pada data lama.
 *
 * Jalankan:
 *   node scripts/anonymize-visitor-ips.mjs --dry-run   (hanya menghitung)
 *   node scripts/anonymize-visitor-ips.mjs
 */
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { neon } = createRequire(`${root}/package.json`)("@neondatabase/serverless");

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    databaseUrl = readFileSync(`${root}/.env.local`, "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    // .env.local tidak ada; DATABASE_URL harus datang dari environment
  }
}
if (!databaseUrl) {
  console.error("DATABASE_URL tidak ditemukan (environment atau .env.local).");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const sql = neon(databaseUrl);

/** Sama dengan anonymizeIp di lib/visitor.ts: IPv4 -> /24, IPv6 -> /48, selain itu null. */
function expandIpv6(ip) {
  const [head, tail, extra] = ip.split("::");
  if (extra !== undefined) return null;
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? left.length !== 8 : missing < 0) return null;
  return [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right];
}
function anonymizeIp(ip) {
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

// Cukup memproses nilai IP yang berbeda-beda: satu UPDATE per nilai, bukan per baris.
// Nilai yang bukan alamat IP (isian header palsu) diubah menjadi NULL.
for (const table of ["visitors", "page_views"]) {
  const distinct = await sql.query(`SELECT DISTINCT ip_address AS ip FROM ${table} WHERE ip_address IS NOT NULL`);
  let changed = 0;
  for (const { ip } of distinct) {
    const masked = anonymizeIp(ip);
    if (masked === ip) continue;
    if (dryRun) {
      const [{ n }] = await sql.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ip_address = $1`, [ip]);
      changed += n;
    } else {
      changed += (await sql.query(`UPDATE ${table} SET ip_address = $2 WHERE ip_address = $1 RETURNING 1`, [ip, masked])).length;
    }
  }
  console.log(`${table}: ${changed} baris ${dryRun ? "perlu disamarkan (dry-run, tidak diubah)" : "disamarkan"}`);
}
