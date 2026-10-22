-- Article Database Schema
-- Run this on your Neon PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products (katalog)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  base_price INTEGER,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3D model assets (GLB)
CREATE TABLE IF NOT EXISTS model_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  file_url TEXT,
  poster_url TEXT,
  size_bytes BIGINT,
  optimization_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product gallery (multi-angle photos)
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

-- Models / Talent
CREATE TABLE IF NOT EXISTS talents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  photo_url TEXT,
  height_cm INTEGER,
  size VARCHAR(100),
  style VARCHAR(100),
  additional_fee INTEGER DEFAULT 0,
  consent_ref TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Talent availability calendar (Fase 2 - reserved for now)
CREATE TABLE IF NOT EXISTS talent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  UNIQUE(talent_id, date),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packages
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL,
  look_count INTEGER,
  duration_minutes INTEGER, -- tidak dipakai lagi (durasi dihapus dari tampilan dan API), kolom dibiarkan
  photo_count INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer requests
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_whatsapp VARCHAR(50) NOT NULL,
  brand_name VARCHAR(255),
  preferred_date DATE,
  notes TEXT,
  personal_data_consent BOOLEAN DEFAULT FALSE,
  status_token VARCHAR(255) UNIQUE,
  total_estimated INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jenis permintaan: TEMPLATE (dari keranjang produk) atau CUSTOM (brief sendiri + referensi)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) NOT NULL DEFAULT 'TEMPLATE';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS custom_title VARCHAR(255);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS custom_description TEXT;

-- Referensi permintaan CUSTOM: gambar yang diunggah atau tautan
CREATE TABLE IF NOT EXISTS request_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL, -- IMAGE | LINK
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_request_references_request ON request_references(request_id);

-- Request line items
CREATE TABLE IF NOT EXISTS request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  package_id UUID REFERENCES packages(id),
  talent_id UUID REFERENCES talents(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  estimated_price INTEGER,
  notes TEXT,
  -- Jenis model: male, male-female, female, male-male, female-female, mixed
  model_gender VARCHAR(30),
  model_notes TEXT,
  -- Opsi paket "Sesuai kebutuhan" (package_id NULL): jumlah look dan foto dari client
  custom_look_count INTEGER,
  custom_photo_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kolom model dan paket kustom untuk database yang tabelnya sudah ada
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS model_gender VARCHAR(30);
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS model_notes TEXT;
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS custom_look_count INTEGER;
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS custom_photo_count INTEGER;

-- Request status history
CREATE TABLE IF NOT EXISTS request_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  total INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_url VARCHAR(500),
  expire_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment events (webhook audit + idempotency)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  raw_payload TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pengaturan aplikasi (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nilai awal pengaturan tampilan harga
INSERT INTO settings (key, value) VALUES
  ('show_product_price', 'true'),
  ('show_package_price', 'true'),
  ('show_additional_fee', 'true'),
  ('hero_visual_template', 'orbit-3d')
ON CONFLICT (key) DO NOTHING;

-- Testimoni pelanggan (kartu bergerak di beranda)
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_published ON testimonials(is_published, sort_order);

-- Visitors (identitas perangkat)
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_key VARCHAR(64) UNIQUE NOT NULL,
  user_agent TEXT,
  device VARCHAR(50),
  device_type VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  ip_address VARCHAR(45),
  referrer TEXT,
  landing_page TEXT,
  visit_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Riwayat halaman per visitor
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  visitor_key VARCHAR(64) NOT NULL,
  path VARCHAR(500) NOT NULL,
  title VARCHAR(255),
  referrer TEXT,
  ip_address VARCHAR(45),
  device VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visitors_key ON visitors(visitor_key);
CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_device ON visitors(device);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(is_published);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_number ON requests(number);
CREATE INDEX IF NOT EXISTS idx_requests_token ON requests(status_token);
CREATE INDEX IF NOT EXISTS idx_request_items_request ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_request ON invoices(request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_events_invoice ON payment_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name);

-- Admin pertama dibuat dengan: node scripts/create-admin.mjs <email>
-- (tidak ada akun bawaan; jangan menaruh kata sandi di berkas ini)

-- Data contoh (testimoni dan paket) ada di db/seed-sample.sql dan HANYA untuk demo/pengembangan.

-- Kalender jadwal di dashboard mengelompokkan permintaan per tanggal pemotretan
CREATE INDEX IF NOT EXISTS idx_requests_preferred_date ON requests(preferred_date);

-- Invoice untuk pembayaran Midtrans Core API.
-- Tiap percobaan charge memakai order_id baru "<invoice_number>-<attempt>";
-- order_id selalu menunjuk percobaan terbaru, riwayat ada di payment_events.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pay_token VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_details JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_pay_token ON invoices(pay_token);

-- Data pribadi pelanggan disimpan terenkripsi ("pii:v1:..."), jauh lebih panjang dari data aslinya
ALTER TABLE requests ALTER COLUMN customer_name TYPE TEXT;
ALTER TABLE requests ALTER COLUMN customer_email TYPE TEXT;
ALTER TABLE requests ALTER COLUMN customer_whatsapp TYPE TEXT;

-- Pembatas laju bersama (tahan restart dan banyak instance); lihat lib/rate-limit.ts
CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(200) PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
