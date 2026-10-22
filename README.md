# Article — booking foto produk fashion UMKM

Situs katalog dan booking pemotretan: pelanggan melihat produk (preview 3D), memilih paket dan model atau mengirim brief
sendiri, lalu admin menagih lewat Midtrans. Next.js 16 (App Router), React 19, Tailwind 4, Neon Postgres, Neon Object
Storage, Midtrans Core API, Resend.

## Menjalankan

```bash
cp .env.example .env.local      # isi nilainya (lihat tabel di bawah)
npm install
# jalankan db/schema.sql di database Neon, lalu buat admin pertama:
node scripts/create-admin.mjs email@anda.com
npm run dev
```

Perintah lain: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run start`.

## Environment

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ya | Koneksi Neon Postgres |
| `SESSION_PASSWORD` | ya | Rahasia sesi admin, minimal 32 karakter |
| `PII_ENCRYPTION_KEY` | ya | Kunci enkripsi data pribadi pelanggan. **Jangan diganti atau hilang**: data terenkripsi tidak bisa dibuka lagi |
| `NEXT_PUBLIC_APP_URL` | ya (production) | Domain publik; dipakai tautan di email dan SEO |
| `OBJECT_STORAGE_*` | ya | Endpoint, bucket, access key, secret key, URL publik untuk unggah gambar |
| `MIDTRANS_*`, `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL` | cadangan | Bisa diatur dari admin (menu Midtrans dan Email); nilai di `.env` dipakai bila belum diatur |

Di production, server menolak start bila `DATABASE_URL`, `SESSION_PASSWORD` (min. 32), atau `PII_ENCRYPTION_KEY` belum benar
(`instrumentation.ts`).

## Checklist sebelum production

- Buat admin dengan `node scripts/create-admin.mjs`, lalu hapus akun contoh lama bila ada:
  `DELETE FROM admin_users WHERE email = 'admin@ekatalog.local';`
- Set `NEXT_PUBLIC_APP_URL` ke domain asli dan simpan `PII_ENCRYPTION_KEY` di tempat aman (cadangkan).
- Di menu admin Midtrans: isi Server Key produksi, pilih mode Produksi, uji koneksi, lalu isi *Payment Notification URL*
  di dashboard Midtrans dengan `<domain>/api/webhooks/midtrans`.
- Di menu admin Email: isi API key Resend dan alamat pengirim dari domain yang sudah diverifikasi.
- Atur sumber IP klien bila perlu (`CLIENT_IP_HEADER` atau `TRUSTED_PROXY_COUNT`, lihat `.env.example`): pembatas laju dan
  analitik hanya mempercayai header yang ditambahkan proxy Anda. Di Vercel tidak perlu diatur.

## Catatan arsitektur

- Halaman publik (`/`, `/katalog`, `/produk/[slug]`) memakai ISR 60 detik; perubahan dari admin memanggil
  `revalidatePublic()` (`lib/revalidate.ts`) sehingga langsung terlihat.
- Data pribadi pelanggan (nama, email, WhatsApp, catatan) disimpan terenkripsi AES-256-GCM (`lib/pii.ts`); admin melihat
  hasil dekripsi.
- Pembayaran: `lib/midtrans.ts` (API), `lib/payments.ts` (logika invoice), webhook di `app/api/webhooks/midtrans`.
- Pembatas laju (`lib/rate-limit.ts`): jalur rawan (login, formulir permintaan, unggah, charge) memakai tabel `rate_limits`
  di database sehingga berlaku lintas instance dan restart; polling memakai pembatas memori.
- Privasi pengunjung: IP disimpan tersamar (IPv4 /24, IPv6 /48), data pengunjung dihapus otomatis setelah 90 hari, cookie
  pengunjung berlaku 180 hari. Data lama disamarkan sekali dengan `node scripts/anonymize-visitor-ips.mjs`.
- CSP dasar diatur di `next.config.ts` (tanpa nonce agar ISR tetap jalan). Bila ada fitur yang terblokir di production,
  set `CSP_REPORT_ONLY=true` sementara dan periksa konsol browser.
- Skema database dikelola manual lewat `db/schema.sql` (idempoten, aman dijalankan ulang).
