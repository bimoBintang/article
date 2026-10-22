"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/types";
import type { PublicSettings } from "@/lib/settings";
import { displayPrice } from "@/lib/price";
import { Breadcrumb } from "@/components/seo/breadcrumb";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

export default function KatalogClient({
 products,
 settings,
}: {
 products: Product[];
 settings: PublicSettings;
}) {
 const [search, setSearch] = useState("");
 const debouncedSearch = useDebouncedValue(search);
 const [category, setCategory] = useState("ALL");

 // Daftar kategori unik dari produk yang tersedia
 const categories = useMemo(() => {
 const set = new Set(products.map((p) => p.category).filter(Boolean));
 return Array.from(set).sort();
 }, [products]);

 const filtered = useMemo(() => {
 const keyword = debouncedSearch.trim().toLowerCase();
 return products.filter((product) => {
 const matchCategory =
 category === "ALL" || product.category === category;
 const matchSearch =
 keyword === "" ||
 product.name.toLowerCase().includes(keyword) ||
 (product.description || "").toLowerCase().includes(keyword);
 return matchCategory && matchSearch;
 });
 }, [products, debouncedSearch, category]);

 return (
 <div className="min-h-screen">
 <div className="mx-auto max-w-7xl px-4 py-8">
 <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
 <div>
 <Breadcrumb
 items={[
 { name: "Beranda", path: "/" },
 { name: "Katalog", path: "/katalog" },
 ]}
 className="mb-2"
 />
 <h1 className="text-2xl font-bold text-foreground">
 Katalog Produk
 </h1>
 <p className="text-zinc-600">
 Jelajahi produk fashion UMKM dengan preview 3D interaktif.
 </p>
 </div>
 <div className="flex flex-col gap-2 sm:flex-row">
 <input
 type="search"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Cari produk..."
 aria-label="Cari produk"
 className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
 />
 <select
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 aria-label="Filter kategori"
 className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
 >
 <option value="ALL">Semua Kategori</option>
 {categories.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 </div>
 </div>

 <p className="mb-4 text-sm text-zinc-500">
 Menampilkan {filtered.length} dari {products.length} produk
 </p>

 <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
 {filtered.length > 0 ? (
 filtered.map((product, index) => (
 <ProductCard
 key={product.id}
 product={product}
 priority={index < 3}
 showPrice={settings.show_product_price}
 />
 ))
 ) : (
 <div className="col-span-full py-20 text-center">
 <h3 className="mb-2 text-lg font-bold text-foreground">
 {products.length === 0
 ? "Belum ada produk tersedia"
 : "Produk tidak ditemukan"}
 </h3>
 <p className="text-zinc-500">
 {products.length === 0
 ? "Katalog produk akan segera ditambahkan."
 : "Coba ubah kata kunci atau filter kategori."}
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function ProductCard({
 product,
 priority = false,
 showPrice = true,
}: {
 product: Product;
 priority?: boolean;
 showPrice?: boolean;
}) {
 return (
 <Link
 href={`/produk/${product.slug}`}
 className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-200 hover:shadow-xl"
 >
 <div className="relative h-28 overflow-hidden bg-zinc-100 sm:h-48">
 {product.thumbnail_url ? (
 <Image
 src={product.thumbnail_url}
 alt={product.name}
 fill
 priority={priority}
 loading={priority ? undefined : "lazy"}
 quality={85}
 className="object-cover transition-transform duration-300 group-hover:scale-105"
 sizes="(max-width: 768px) 100vw, 33vw"
 />
 ) : (
 <ImagePlaceholder label={product.name} />
 )}
 <span className="absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold sm:left-2 sm:top-2 sm:max-w-none sm:px-2 sm:py-1 sm:text-xs text-zinc-800 backdrop-blur">
 {product.category}
 </span>
 </div>
 <div className="p-2 sm:p-4">
 <h3 className="mb-1 line-clamp-2 text-xs font-bold leading-tight transition-colors sm:text-lg sm:leading-normal group-hover:text-primary">
 {product.name}
 </h3>
 {product.description && (
 <p className="mb-3 hidden line-clamp-2 text-sm text-zinc-500 sm:block">
 {product.description}
 </p>
 )}
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11px] font-medium text-foreground sm:text-base">
 {displayPrice(product.base_price, showPrice)}
 </span>
 <span className="hidden text-sm font-medium text-primary sm:inline">Lihat 3D</span>
 </div>
 </div>
 </Link>
 );
}
