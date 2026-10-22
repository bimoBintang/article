/**
 * Pemeriksaan konfigurasi saat server production dinyalakan. Rahasia yang
 * hilang atau terlalu lemah membuat server berhenti sejak awal (gagal keras),
 * bukan baru ketahuan saat pelanggan pertama gagal mengirim permintaan.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL belum diatur");
  if ((process.env.SESSION_PASSWORD?.length ?? 0) < 32) {
    problems.push("SESSION_PASSWORD belum diatur atau kurang dari 32 karakter");
  }
  if ((process.env.PII_ENCRYPTION_KEY?.trim().length ?? 0) < 16) {
    problems.push("PII_ENCRYPTION_KEY belum diatur (kunci enkripsi data pribadi pelanggan)");
  }

  if (problems.length > 0) {
    throw new Error(`Konfigurasi production tidak lengkap:\n- ${problems.join("\n- ")}`);
  }

  // Tidak fatal, tetapi hampir pasti salah di production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!process.env.VERCEL_PROJECT_PRODUCTION_URL && (!appUrl || appUrl.includes("localhost"))) {
    console.warn("[config] NEXT_PUBLIC_APP_URL belum diisi domain produksi: tautan di email akan menuju localhost.");
  }
  if (!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER === "6281234567890") {
    console.warn("[config] NEXT_PUBLIC_WHATSAPP_NUMBER belum diisi nomor asli: tombol WhatsApp di halaman produk disembunyikan.");
  }
  if (!process.env.OBJECT_STORAGE_ENDPOINT) {
    console.warn("[config] OBJECT_STORAGE_* belum diatur: unggah gambar tidak akan berfungsi.");
  }
}
