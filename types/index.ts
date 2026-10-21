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
  duration_minutes: number | null;
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
  product?: Product;
  package?: Package;
  talent?: Talent;
};

export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export type Invoice = {
  id: string;
  request_id: string;
  order_id: string;
  total: number;
  status: InvoiceStatus;
  payment_url: string | null;
  expire_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  request?: Request;
};

export type CartItem = {
  productId: string;
  packageId?: string;
  talentId?: string;
  quantity: number;
  notes?: string;
};

export type AnalyticsEvent = {
  id: string;
  session_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  created_at: string;
};
