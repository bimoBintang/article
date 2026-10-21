"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Trash2, Plus, Minus, ChevronRight } from "lucide-react";
import { Package } from "@/types";
import type { PublicSettings } from "@/lib/settings";
import { displayPrice } from "@/lib/price";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

type CartItem = {
  productId: string;
  packageId?: string;
  talentId?: string;
  quantity: number;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, any>>({});
  const [packages, setPackages] = useState<Record<string, Package>>({});
  const [settings, setSettings] = useState<PublicSettings>({
    show_product_price: true,
    show_package_price: true,
    show_additional_fee: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem("ekatalog_cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        setCart([]);
      }
    }
  }, []);

  // Ambil pengaturan tampilan harga dari server
  useEffect(() => {
    fetch("/api/public/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => {
        /* biarkan nilai default */
      });
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    const productIds = cart.map((item) => item.productId).filter(Boolean);
    const packageIds = cart
      .map((item) => item.packageId)
      .filter((id): id is string => Boolean(id));
    loadCatalog(productIds, packageIds);
  }, [cart]);

  async function loadCatalog(
    productIds: string[],
    packageIds: string[]
  ) {
    try {
      const res = await fetch("/api/public/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, packageIds }),
      });
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();

      const productMap: Record<string, any> = {};
      (data.products || []).forEach((r: any) => (productMap[r.id] = r));
      setProducts(productMap);

      const packageMap: Record<string, Package> = {};
      (data.packages || []).forEach((r: any) => (packageMap[r.id] = r));
      setPackages(packageMap);
    } catch {
      // ignore - tampilkan item tanpa detail
    }
  }

  function removeItem(index: number) {
    const next = [...cart];
    next.splice(index, 1);
    localStorage.setItem("ekatalog_cart", JSON.stringify(next));
    setCart(next);
  }

  function changeQuantity(index: number, delta: number) {
    const next = [...cart];
    next[index].quantity = Math.max(1, next[index].quantity + delta);
    localStorage.setItem("ekatalog_cart", JSON.stringify(next));
    setCart(next);
  }

  // Total hanya bisa ditampilkan bila seluruh harga yang dipakai terlihat
  const showTotalPrice =
    settings.show_package_price && settings.show_product_price;

  function getTotal() {
    let total = 0;
    cart.forEach((item) => {
      const prod = products[item.productId];
      const pkg = packages[item.packageId || ""];
      const price = pkg?.base_price || prod?.base_price || 0;
      total += price * item.quantity;
    });
    return total;
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center">
            <h1 className="font-bold text-lg mb-2">Keranjang Kosong</h1>
            <p className="text-zinc-500">Belum ada produk yang ditambahkan ke keranjang.</p>
            <Link
              href="/katalog"
              className="mt-6 inline-block px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Jelajahi Katalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-8">Keranjang Pemotretan</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, index) => {
              const prod = products[item.productId];
              const pkg = packages[item.packageId || ""];
              const name = prod?.name || "Produk";
              const pkgName = pkg?.name || "Paket";
              const price = pkg?.base_price || prod?.base_price || 0;
              // Harga paket mengikuti switch paket, harga produk mengikuti switch produk
              const showItemPrice = pkg
                ? settings.show_package_price
                : settings.show_product_price;
              const image = prod?.thumbnail_url;

              return (
                <div key={index} className="bg-white rounded-xl border border-zinc-200 p-4 flex gap-4">
                  <div className="relative w-20 h-20 flex-shrink-0 rounded-lg bg-zinc-100 overflow-hidden">
                    {image ? (
                      <Image src={image} alt={name} fill className="object-cover" sizes="100px" />
                    ) : (
                      <ImagePlaceholder label={name} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-zinc-500">{pkgName}</div>
                    {item.talentId && (
                      <div className="text-xs text-zinc-400 mt-1">Model dipilih</div>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => changeQuantity(index, -1)}
                        className="w-8 h-8 rounded-lg border border-zinc-300 flex items-center justify-center hover:bg-zinc-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(index, 1)}
                        className="w-8 h-8 rounded-lg border border-zinc-300 flex items-center justify-center hover:bg-zinc-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {displayPrice(price, showItemPrice)}
                    </div>
                    <div className="text-sm text-zinc-500">x {item.quantity}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm sticky top-24">
              <h2 className="font-bold text-lg mb-4">Ringkasan</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Jumlah Item</span>
                  <span className="font-medium">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Total Estimasi</span>
                  <span className="font-medium">
                    {showTotalPrice
                      ? `Rp ${getTotal().toLocaleString("id-ID")}`
                      : "Hubungi admin"}
                  </span>
                </div>
                <div className="border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  Harga bersifat estimasi hingga disepakati dengan admin.
                </div>
              </div>

              <Link
                href="/request"
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                Ajukan Permintaan
              </Link>

              <p className="mt-4 text-xs text-zinc-500 text-center">
                Setelah mengajukan, Anda akan menerima email konfirmasi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
