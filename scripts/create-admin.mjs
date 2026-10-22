/**
 * Buat admin baru atau ganti kata sandi admin yang sudah ada.
 *
 * Jalankan:
 *   node scripts/create-admin.mjs admin@domainanda.com
 * Kata sandi diminta tanpa ditampilkan di layar. Untuk CI/otomasi, isi env ADMIN_PASSWORD.
 *
 * Tidak ada akun bawaan: jalankan ini sekali setelah skema dipasang. Bila database
 * lama masih punya akun contoh "admin@ekatalog.local" (kata sandi admin123), buat
 * admin baru lalu hapus akun itu: DELETE FROM admin_users WHERE email = 'admin@ekatalog.local';
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(`${root}/package.json`);
const { neon } = require("@neondatabase/serverless");
const { hash } = require("bcryptjs");

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Pemakaian: node scripts/create-admin.mjs <email>");
  process.exit(1);
}

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const env = readFileSync(`${root}/.env.local`, "utf8");
    databaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    // .env.local tidak ada; DATABASE_URL harus datang dari environment
  }
}
if (!databaseUrl) {
  console.error("DATABASE_URL tidak ditemukan (environment atau .env.local).");
  process.exit(1);
}

/** Baca satu baris tanpa menampilkan ketikan. */
function askHidden(prompt) {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(prompt)) rl.output.write(text);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolveAnswer(answer);
    });
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Kata sandi baru (min. 12 karakter): "));
if (password.length < 12) {
  console.error("Kata sandi minimal 12 karakter.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  const again = await askHidden("Ulangi kata sandi: ");
  if (again !== password) {
    console.error("Kata sandi tidak sama.");
    process.exit(1);
  }
}

const sql = neon(databaseUrl);
const rows = await sql.query(
  `INSERT INTO admin_users (email, password_hash, role)
   VALUES ($1, $2, 'admin')
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
   RETURNING (xmax = 0) AS created`,
  [email, await hash(password, 12)]
);
console.log(rows[0]?.created ? `Admin ${email} dibuat.` : `Kata sandi ${email} diperbarui.`);
