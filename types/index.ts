export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  thumbnail_url: string | null;
  base_price: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type ModelAsset = {
  id: string;
  product_id: string;
  file_url: string | null;
  poster_url: string | null;
  size_bytes: number | null;
  optimization_status: "pending" | "optimized" | "failed";
  created_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Talent = {
  id: string;
  name: string;
  photo_url: string | null;
  height_cm: number | null;
  size: string | null;
  style: string | null;
  additional_fee: number;
  consent_ref: string | null;
  is_available: boolean;
  created_at: string;
};

export type Package = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  look_count: number | null;
  photo_count: number | null;
  is_active: boolean;
  created_at: string;
};

export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "NEGOTIATION"
  | "AGREED"
  | "INVOICED"
  | "PAID"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type Request = {
  id: string;
  number: string;
  status: RequestStatus;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  brand_name: string | null;
  preferred_date: string | null;
  notes: string | null;
  personal_data_consent: boolean;
  status_token: string | null;
  total_estimated: number | null;
  /** TEMPLATE = dari keranjang produk; CUSTOM = brief sendiri + referensi. */
  request_type: "TEMPLATE" | "CUSTOM";
  custom_title: string | null;
  custom_description: string | null;
  created_at: string;
  updated_at: string;
  items?: RequestItem[];
};

export type RequestItem = {
  id: string;
  request_id: string;
  product_id: string | null;
  package_id: string | null;
  talent_id: string | null;
  quantity: number;
  estimated_price: number | null;
  notes: string | null;
  /** Kode jenis model (lihat lib/model-gender.ts) dan catatannya. */
  model_gender: string | null;
  model_notes: string | null;
  /** Terisi hanya untuk opsi paket "Sesuai kebutuhan" (package_id kosong). */
  custom_look_count: number | null;
  custom_photo_count: number | null;
  product?: Product;
  package?: Package;
  talent?: Talent;
};

export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export type Invoice = {
  id: string;
  request_id: string;
  invoice_number: string | null;
  /** Rahasia tautan bayar pelanggan; hanya dikirim ke admin */
  pay_token: string | null;
  order_id: string;
  total: number;
  status: InvoiceStatus;
  /** Percobaan charge ke Midtrans yang sudah dibuat (0 = belum memilih metode). */
  attempt: number;
  payment_method: string | null;
  payment_details: PaymentInstructions | null;
  transaction_id: string | null;
  description: string | null;
  payment_url: string | null;
  expire_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  request?: Request;
};

/** Instruksi bayar hasil charge Core API yang sudah dinormalkan. */
export type PaymentInstructions =
  | { type: "va"; bank: string; vaNumber: string }
  | { type: "qris"; qrUrl: string | null; qrString: string | null }
  | { type: "gopay"; deeplinkUrl: string | null; qrUrl: string | null };

/**
 * Item keranjang (localStorage "ekatalog_cart").
 * `talentId` hanya ada di keranjang lama dari sebelum pilihan jenis model;
 * tetap diterima agar keranjang itu tidak rusak.
 */
export type CartItem = {
  productId: string;
  /** Kosong untuk opsi "Sesuai kebutuhan". */
  packageId?: string | null;
  customLookCount?: number | null;
  customPhotoCount?: number | null;
  modelGender?: string | null;
  modelNotes?: string | null;
  talentId?: string | null;
  quantity: number;
};

export type AnalyticsEvent = {
  id: string;
  session_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  created_at: string;
};

/** Detail permintaan untuk panel admin (tanpa status_token yang rahasia). */
export type AdminRequestDetail = Omit<Request, "status_token" | "items">;

/** Baris item permintaan beserta nama produk/paket/model hasil JOIN. */
export type AdminRequestItem = {
  id: string;
  quantity: number;
  estimated_price: number | null;
  notes: string | null;
  product_name: string | null;
  product_thumbnail: string | null;
  package_name: string | null;
  talent_name: string | null;
  model_gender: string | null;
  model_notes: string | null;
  custom_look_count: number | null;
  custom_photo_count: number | null;
};

/** Satu baris riwayat perubahan status permintaan. */
export type AdminRequestLog = {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
};

/** Testimoni pelanggan yang tampil sebagai kartu bergerak di beranda. */
export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  title: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

/** Referensi permintaan Customize: gambar unggahan atau tautan. */
/** Ringkasan invoice di halaman detail permintaan (admin). */
export type AdminRequestInvoice = {
  id: string;
  invoice_number: string | null;
  total: number;
  status: InvoiceStatus;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
};

export type AdminRequestReference = {
  id: string;
  kind: "IMAGE" | "LINK";
  url: string;
};
