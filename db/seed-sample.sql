-- Data contoh untuk DEMO/PENGEMBANGAN. Jangan dijalankan di database production.
-- Jalankan setelah db/schema.sql. Aman diulang (hanya mengisi tabel yang masih kosong).

-- Seed contoh testimoni (PLACEHOLDER, ganti atau hapus lewat Admin > Testimoni
-- sebelum situs dipakai sungguhan). Hanya diisi bila tabel masih kosong.
INSERT INTO testimonials (quote, name, title, sort_order)
SELECT v.quote, v.name, v.title, v.sort_order
FROM (VALUES
  ('Hasil fotonya rapi dan konsisten untuk seluruh koleksi. Dari pilih paket sampai jadwal semuanya jelas.', 'Pelanggan Contoh', 'Brand Kaos Contoh', 1),
  ('Saya bisa lihat produk dari semua sudut sebelum memutuskan paket. Tidak ada lagi tanya jawab berulang di chat.', 'Pelanggan Contoh', 'Brand Tas Contoh', 2),
  ('Proses permintaannya singkat. Admin membalas lewat email dengan rincian biaya yang mudah dipahami.', 'Pelanggan Contoh', 'Brand Hijab Contoh', 3),
  ('Pilihan model yang tersedia membantu karena bisa disesuaikan dengan karakter brand kami.', 'Pelanggan Contoh', 'Brand Jaket Contoh', 4),
  ('Foto katalog siap dipakai untuk marketplace dan media sosial tanpa perlu banyak revisi.', 'Pelanggan Contoh', 'Brand Sepatu Contoh', 5),
  ('Invoice dan statusnya bisa dipantau, jadi kami selalu tahu sudah sampai tahap mana.', 'Pelanggan Contoh', 'Brand Aksesori Contoh', 6)
) AS v(quote, name, title, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM testimonials);

-- Paket contoh (harga placeholder). Hanya diisi bila tabel masih kosong.
INSERT INTO packages (name, description, base_price, look_count, photo_count, is_active)
SELECT * FROM (VALUES
  ('Basic', '1 look, 30 menit, 10 foto hasil edit', 500000, 1, 10, true),
  ('Standard', '3 look, 60 menit, 25 foto hasil edit', 1200000, 3, 25, true),
  ('Premium', '5 look, 120 menit, 50 foto hasil edit', 2500000, 5, 50, true)
) AS v(name, description, base_price, look_count, photo_count, is_active)
WHERE NOT EXISTS (SELECT 1 FROM packages);

