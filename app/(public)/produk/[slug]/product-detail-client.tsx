"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { FlyToCartLayer, flyToCart } from "@/components/cart/fly-to-cart";
import { ShoppingCart, Plus, Minus, Box, Images, Check } from "lucide-react";
import type { CartItem, Product, Package, ProductImage } from "@/types";
import type { PublicSettings } from "@/lib/settings";
import { displayPrice } from "@/lib/price";
import { Breadcrumb } from "@/components/seo/breadcrumb";
import { ProductGallery } from "./product-gallery";
import {
  EMPTY_MODEL_SELECTION,
  ModelPicker,
  type ModelSelection,
} from "@/components/request/model-picker";
import {
  EMPTY_PACKAGE_SELECTION,
  PackagePicker,
  resolvePackageSelection,
  type PackageSelection,
} from "@/components/request/package-picker";

/** Nomor WhatsApp admin (format 628xxxx). Tanpa nilai ini kartu "Butuh Bantuan" disembunyikan, bukan diarahkan ke nomor contoh. */
const WHATSAPP_NUMBER = (() => {
  const digits = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
  return digits === "6281234567890" ? "" : digits; // nomor contoh dari .env.example dianggap belum diisi
})();

const Viewer3D = dynamic(
 () => import("@/components/viewer3d").then((mod) => mod.Viewer3D),
 {
 loading: () => (
 <div className="flex h-[500px] items-center justify-center rounded-xl bg-zinc-100">
 <span className="text-sm text-zinc-500">
 Memuat viewer 3D...
 </span>
 </div>
 ),
 }
);

type ModelAsset = {
 file_url: string | null;
 poster_url: string | null;
} | null;

export default function ProductDetailClient({
 product,
 modelAsset,
 packages,
 images,
 settings,
}: {
 product: Product;
 modelAsset: ModelAsset;
 packages: Package[];
 images: ProductImage[];
 settings: PublicSettings;
}) {
 const [pkgSel, setPkgSel] = useState<PackageSelection>(EMPTY_PACKAGE_SELECTION);
 const [model, setModel] = useState<ModelSelection>(EMPTY_MODEL_SELECTION);
 const [formError, setFormError] = useState("");
 const errorRef = useRef<HTMLParagraphElement>(null);
 const [quantity, setQuantity] = useState(1);
 // true selama 1,6 detik setelah menambah ke keranjang (umpan balik tombol)
 const [added, setAdded] = useState(false);
 const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

 const hasModel3d = Boolean(modelAsset?.file_url);
 const hasGallery = images.length > 0;
 const [view, setView] = useState<"3d" | "gallery">(
 hasModel3d ? "3d" : "gallery"
 );

 // Pesan kesalahan muncul di kartu opsi; di layar kecil tombol keranjang ada di
 // bar bawah, jadi gulirkan pesannya ke tengah layar supaya terlihat.
 useEffect(() => {
 if (formError) {
 errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
 }
 }, [formError]);

 function addToCart(trigger: HTMLElement) {
 setFormError("");
 const resolved = resolvePackageSelection(pkgSel);
 if (!resolved.ok) {
 setFormError(resolved.error);
 return;
 }

 const cartItem: CartItem = {
 productId: product.id,
 packageId: resolved.packageId,
 customLookCount: resolved.customLookCount,
 customPhotoCount: resolved.customPhotoCount,
 modelGender: model.gender,
 modelNotes: model.notes.trim() || null,
 quantity,
 };
 const existing = localStorage.getItem("ekatalog_cart");
 const cart = existing ? JSON.parse(existing) : [];
 cart.push(cartItem);
 localStorage.setItem("ekatalog_cart", JSON.stringify(cart));
 // Foto produk terbang ke header; jumlah keranjang berubah saat foto tiba.
 // Tanpa animasi (mengurangi gerak dsb.), perbarui jumlah di header langsung.
 const flying = flyToCart(
 trigger,
 product.thumbnail_url ?? images[0]?.image_url ?? null
 );
 if (!flying) window.dispatchEvent(new Event("ekatalog:cart-change"));
 setAdded(true);
 if (addedTimer.current) clearTimeout(addedTimer.current);
 addedTimer.current = setTimeout(() => setAdded(false), 1600);
 }

 return (
 <div className="min-h-screen">
 <FlyToCartLayer />
 <div className="mx-auto max-w-7xl px-4 py-8">
 <Breadcrumb
 items={[
 { name: "Beranda", path: "/" },
 { name: "Katalog", path: "/katalog" },
 { name: product.name, path: `/produk/${product.slug}` },
 ]}
 className="mb-3"
 />

 <div className="grid gap-8 lg:grid-cols-12">
 {/* Left: 3D Viewer & Galeri */}
 <div className="space-y-6 lg:col-span-7">
 <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
 {/* Tab switcher */}
 {(hasModel3d || hasGallery) && (
 <div className="flex gap-1 border-b border-zinc-100 p-2">
 {hasModel3d && (
 <button
 onClick={() => setView("3d")}
 aria-current={view === "3d"}
 className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
 view === "3d"
 ? "bg-primary/10 text-primary"
 : "text-zinc-500 hover:bg-zinc-100 "
 }`}
 >
 <Box className="h-4 w-4" /> Tampilan 3D
 </button>
 )}
 {hasGallery && (
 <button
 onClick={() => setView("gallery")}
 aria-current={view === "gallery"}
 className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
 view === "gallery"
 ? "bg-primary/10 text-primary"
 : "text-zinc-500 hover:bg-zinc-100 "
 }`}
 >
 <Images className="h-4 w-4" /> Galeri Foto
 <span className="rounded-full bg-zinc-100 px-1.5 text-xs">
 {images.length}
 </span>
 </button>
 )}
 </div>
 )}

 {/* Konten tab */}
 {view === "3d" && hasModel3d ? (
 <Viewer3D
 glbUrl={modelAsset?.file_url || undefined}
 posterUrl={
 modelAsset?.poster_url || product.thumbnail_url || undefined
 }
 className="h-[500px] w-full"
 />
 ) : (
 <div className="p-4">
 <ProductGallery
 images={images.map((i) => ({
 id: i.id,
 image_url: i.image_url,
 alt_text: i.alt_text,
 }))}
 fallbackUrl={product.thumbnail_url}
 productName={product.name}
 />
 </div>
 )}

 <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 p-4">
 <h1 className="text-lg font-bold text-foreground">{product.name}</h1>
 <span className="font-semibold text-primary">
 {displayPrice(product.base_price, settings.show_product_price)}
 </span>
 </div>
 {product.description && (
 <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
 <h2 className="mb-3 text-base font-bold text-foreground">
 Deskripsi Produk
 </h2>
 <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600">
 {product.description}
 </p>
 </section>
 )}
 </div>
 </div>

 {/* Right: Options & Cart */}
 <div className="space-y-6 lg:col-span-5">
 <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
 <h3 className="mb-6 text-lg font-bold text-foreground">Pilih Opsi</h3>

 <ModelPicker
 value={model}
 onChange={(next) => setModel(next)}
 />

 <PackagePicker
 packages={packages}
 settings={settings}
 value={pkgSel}
 onChange={(next) => {
 setPkgSel(next);
 setFormError("");
 }}
 />

 {/* Jumlah */}
 <div className="mt-4 space-y-4">
 <label className="mb-2 block text-sm font-semibold text-zinc-700">
 Jumlah
 </label>
 <div className="flex items-center gap-3">
 <button
 onClick={() => setQuantity((q) => Math.max(1, q - 1))}
 aria-label="Kurangi jumlah"
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50"
 >
 <Minus className="h-4 w-4" />
 </button>
 <span className="w-8 text-center font-medium">{quantity}</span>
 <button
 onClick={() => setQuantity((q) => q + 1)}
 aria-label="Tambah jumlah"
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50"
 >
 <Plus className="h-4 w-4" />
 </button>
 </div>
 </div>

 {formError && (
 <p
 ref={errorRef}
 role="alert"
 className="mt-4 text-sm font-medium text-red-600"
 >
 {formError}
 </p>
 )}

 <button
 onClick={(e) => addToCart(e.currentTarget)}
 className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 font-medium text-white transition-colors ${
 added ? "bg-green-600" : "bg-primary hover:bg-primary/90"
 }`}
 >
 {added ? (
 <>
 <Check className="h-4 w-4" />
 Ditambahkan
 </>
 ) : (
 <>
 <ShoppingCart className="h-4 w-4" />
 Tambah ke Keranjang
 </>
 )}
 </button>

 <div className="mt-4 text-center text-xs text-zinc-500">
 Harga adalah estimasi hingga disepakati dengan admin.
 </div>
 </div>

 {/* WhatsApp quick contact */}
 {WHATSAPP_NUMBER && (
 <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
 <h3 className="mb-4 text-lg font-bold text-foreground">
 Butuh Bantuan?
 </h3>
 <p className="mb-4 text-sm text-zinc-600">
 Hubungi admin lewat WhatsApp untuk konsultasi pemotretan.
 </p>
 <a
 href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
 `Halo, saya tertarik memesan pemotretan untuk produk ${product.name}`
 )}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 font-medium text-white transition-colors hover:bg-green-600"
 >
 Hubungi via WhatsApp
 </a>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
