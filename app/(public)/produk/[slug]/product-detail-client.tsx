"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ShoppingCart, Plus, Minus, Box, Images, Check } from "lucide-react";
import type { Product, Talent, Package, ProductImage } from "@/types";
import type { PublicSettings } from "@/lib/settings";
import { displayPrice } from "@/lib/price";
import { Breadcrumb } from "@/components/seo/breadcrumb";
import { ProductGallery } from "./product-gallery";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

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
 talents,
 packages,
 images,
 settings,
}: {
 product: Product;
 modelAsset: ModelAsset;
 talents: Talent[];
 packages: Package[];
 images: ProductImage[];
 settings: PublicSettings;
}) {
 const [selectedTalent, setSelectedTalent] = useState<string | null>(null);
 const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
 const [quantity, setQuantity] = useState(1);
 const [inCart, setInCart] = useState(false);

 const hasModel3d = Boolean(modelAsset?.file_url);
 const hasGallery = images.length > 0;
 const [view, setView] = useState<"3d" | "gallery">(
 hasModel3d ? "3d" : "gallery"
 );

 function addToCart() {
 if (!selectedPackage) {
 alert("Silakan pilih paket terlebih dahulu.");
 return;
 }
 const cartItem = {
 productId: product.id,
 packageId: selectedPackage,
 talentId: selectedTalent,
 quantity,
 };
 const existing = localStorage.getItem("ekatalog_cart");
 const cart = existing ? JSON.parse(existing) : [];
 cart.push(cartItem);
 localStorage.setItem("ekatalog_cart", JSON.stringify(cart));
 setInCart(true);
 setTimeout(() => setInCart(false), 2000);
 }

 return (
 <div className="min-h-screen">
 <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 lg:pb-8">
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

 {/* Model / Talent */}
 <div className="space-y-4">
 <label className="mb-2 block text-sm font-semibold text-zinc-700">
 Model / Talent
 </label>
 {talents.length > 0 ? (
 <div className="grid grid-cols-2 gap-3">
 {talents.map((talent) => (
 <button
 key={talent.id}
 onClick={() => setSelectedTalent(talent.id)}
 aria-pressed={selectedTalent === talent.id}
 className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
 selectedTalent === talent.id
 ? "border-primary bg-primary/5 text-primary"
 : "border-zinc-200 hover:border-zinc-300 bg-white "
 }`}
 >
 {talent.photo_url ? (
 <Image
 src={talent.photo_url}
 alt={talent.name}
 width={60}
 height={60}
 className="rounded-full object-cover"
 />
 ) : (
 <div className="h-12 w-12">
 <ImagePlaceholder label={talent.name} rounded />
 </div>
 )}
 <span className="text-center">{talent.name}</span>
 {settings.show_additional_fee &&
 talent.additional_fee > 0 && (
 <span className="text-xs text-zinc-500">
 +Rp{" "}
 {talent.additional_fee.toLocaleString("id-ID")}
 </span>
 )}
 </button>
 ))}
 </div>
 ) : (
 <p className="text-sm text-zinc-500">
 Belum ada model tersedia.
 </p>
 )}
 </div>

 {/* Paket */}
 <div className="mt-4 space-y-4">
 <label className="mb-2 block text-sm font-semibold text-zinc-700">
 Paket Pemotretan
 </label>
 {packages.length > 0 ? (
 <div className="space-y-2">
 {packages.map((pkg) => (
 <button
 key={pkg.id}
 onClick={() => setSelectedPackage(pkg.id)}
 aria-pressed={selectedPackage === pkg.id}
 className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-all ${
 selectedPackage === pkg.id
 ? "border-primary bg-primary/5 text-primary"
 : "border-zinc-200 hover:border-zinc-300 bg-white "
 }`}
 >
 <div className="min-w-0">
 <div className="font-medium">{pkg.name}</div>
 <div className="text-xs text-zinc-500">
 {pkg.look_count} look • {pkg.photo_count} foto •{" "}
 {pkg.duration_minutes} menit
 </div>
 </div>
 <span className="shrink-0 font-semibold">
 {displayPrice(
 pkg.base_price,
 settings.show_package_price
 )}
 </span>
 </button>
 ))}
 </div>
 ) : (
 <p className="text-sm text-zinc-500">
 Belum ada paket tersedia.
 </p>
 )}
 </div>

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

 {inCart ? (
 <div className="mt-6 rounded-lg border border-green-100 bg-green-50 p-3">
 <div className="flex items-center gap-2 text-sm font-medium text-green-700">
 <Check className="h-4 w-4" />
 Ditambahkan ke keranjang
 </div>
 </div>
 ) : (
 <button
 onClick={addToCart}
 className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary/90"
 >
 <ShoppingCart className="h-4 w-4" />
 Tambah ke Keranjang
 </button>
 )}

 <div className="mt-4 text-center text-xs text-zinc-500">
 Harga adalah estimasi hingga disepakati dengan admin.
 </div>
 </div>

 {/* WhatsApp quick contact */}
 <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
 <h3 className="mb-4 text-lg font-bold text-foreground">
 Butuh Bantuan?
 </h3>
 <p className="mb-4 text-sm text-zinc-600">
 Hubungi admin lewat WhatsApp untuk konsultasi pemotretan.
 </p>
 <a
 href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "6281234567890"}?text=${encodeURIComponent(
 `Halo, saya tertarik memesan pemotretan untuk produk ${product.name}`
 )}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 font-medium text-white transition-colors hover:bg-green-600"
 >
 Hubungi via WhatsApp
 </a>
 </div>
 </div>
 </div>
 </div>

 {/* CTA bar sticky (mobile) - harga + keranjang + WhatsApp */}
 <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
 <div className="flex items-center gap-3">
 <div className="min-w-0 shrink-0">
 <p className="text-xs text-zinc-500">
 {displayPrice(product.base_price, settings.show_product_price)}
 </p>
 </div>
 <a
 href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "6281234567890"}?text=${encodeURIComponent(
 `Halo, saya tertarik memesan pemotretan untuk produk ${product.name}`
 )}`}
 target="_blank"
 rel="noopener noreferrer"
 aria-label="Hubungi via WhatsApp"
 className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-500 text-xs font-semibold text-white transition-colors hover:bg-green-600"
 >
 WA
 </a>
 <button
 onClick={addToCart}
 className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-white transition-colors hover:bg-primary/90"
 >
 <ShoppingCart className="h-4 w-4" />
 Tambah ke Keranjang
 </button>
 </div>
 </div>
 </div>
 );
}
