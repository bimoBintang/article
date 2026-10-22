"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TrashBin, type TrashPhase } from "@/components/cart/trash-bin";
import { Trash2, Plus, Minus, ChevronRight } from "lucide-react";
import type { CartItem, Package } from "@/types";
import { modelGenderLabel } from "@/lib/model-gender";
import type { PublicSettings } from "@/lib/settings";
import { displayPrice } from "@/lib/price";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

/** Item "Sesuai kebutuhan": tanpa paket, jumlah look dan foto ditentukan client. */
function isCustomItem(item: CartItem): boolean {
  return (
    !item.packageId &&
    item.customLookCount != null &&
    item.customPhotoCount != null
  );
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  // Kunci stabil per item (paralel dengan `cart`) supaya item yang dibuang bisa dianimasikan keluar
  const [keys, setKeys] = useState<string[]>([]);
  const reduceMotion = useReducedMotion();
  const binRef = useRef<HTMLDivElement>(null);
  const [binPhase, setBinPhase] = useState<TrashPhase>("hidden");
  const [exitVec, setExitVec] = useState({ dx: 0, dy: 0 });
  // true selama ada kartu yang masih terbang ke tong (menunda tampilan "Keranjang Kosong")
  const [pendingExit, setPendingExit] = useState(false);
  const binTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => binTimers.current.forEach(clearTimeout), []);
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
        const parsed: CartItem[] = JSON.parse(saved);
        setCart(parsed);
        setKeys(parsed.map(() => crypto.randomUUID()));
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

  function removeItem(index: number, card: HTMLElement | null) {
    const next = [...cart];
    next.splice(index, 1);
    localStorage.setItem("ekatalog_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("ekatalog:cart-change"));

    // Kartu terbang ke tong sampah di tengah bawah layar (kecuali mengurangi gerak)
    const bin = binRef.current?.getBoundingClientRect();
    if (!reduceMotion && card && bin) {
      const r = card.getBoundingClientRect();
      setExitVec({
        dx: bin.left + bin.width / 2 - (r.left + r.width / 2),
        dy: bin.top + bin.height * 0.35 - (r.top + r.height / 2),
      });
      setPendingExit(true);
      // tong naik dan tutup terbuka; menutup saat kartu tiba; lalu turun
      binTimers.current.forEach(clearTimeout);
      setBinPhase("open");
      binTimers.current = [
        setTimeout(() => setBinPhase("closed"), 520),
        setTimeout(() => setBinPhase("hidden"), 1050),
      ];
    }

    setCart(next);
    setKeys((k) => k.filter((_, i) => i !== index));
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
      // Harga "Sesuai kebutuhan" disepakati admin; jangan jatuh ke harga produk
      if (isCustomItem(item)) return;
      const prod = products[item.productId];
      const pkg = packages[item.packageId || ""];
      const price = pkg?.base_price || prod?.base_price || 0;
      total += price * item.quantity;
    });
    return total;
  }

  // Halaman kosong baru tampil setelah kartu terakhir selesai terbang ke tong
  if (cart.length === 0 && !pendingExit) {
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
      {!reduceMotion && <TrashBin ref={binRef} phase={binPhase} />}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-8">Keranjang Pemotretan</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="relative min-w-0 space-y-4 lg:col-span-2">
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={exitVec}
              onExitComplete={() => setPendingExit(false)}
            >
            {cart.map((item, index) => {
              const prod = products[item.productId];
              const pkg = packages[item.packageId || ""];
              const custom = isCustomItem(item);
              const name = prod?.name || "Produk";
              const pkgName = custom ? "Sesuai kebutuhan" : pkg?.name || "Paket";
              const modelLabel = modelGenderLabel(item.modelGender);
              const price = pkg?.base_price || prod?.base_price || 0;
              // Harga paket mengikuti switch paket, harga produk mengikuti switch produk
              const showItemPrice = pkg
                ? settings.show_package_price
                : settings.show_product_price;
              const image = prod?.thumbnail_url;

              return (
                <motion.div
                  key={keys[index] ?? index}
                  data-cart-card
                  layout={!reduceMotion}
                  custom={exitVec}
                  variants={{
                    exit: (v: { dx: number; dy: number }) =>
                      reduceMotion
                        ? { opacity: 0, transition: { duration: 0 } }
                        : {
                            x: v.dx,
                            y: v.dy,
                            scale: 0.15,
                            rotate: -14,
                            opacity: [1, 1, 0.6],
                            transition: { duration: 0.55, ease: [0.5, 0, 0.75, 0.4] },
                          },
                  }}
                  exit="exit"
                  className="bg-white rounded-xl border border-zinc-200 p-4 flex gap-4"
                >
                  <div className="relative w-20 h-20 flex-shrink-0 rounded-lg bg-zinc-100 overflow-hidden">
                    {image ? (
                      <Image src={image} alt={name} fill quality={85} className="object-cover" sizes="100px" />
                    ) : (
                      <ImagePlaceholder label={name} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-zinc-500">{pkgName}</div>
                    {custom && (
                      <div className="text-xs text-zinc-500">
                        {item.customLookCount} look • {item.customPhotoCount} foto
                      </div>
                    )}
                    {/* talentId: keranjang lama dari sebelum pilihan jenis model */}
                    {(modelLabel || item.talentId) && (
                      <div className="mt-1 text-xs text-zinc-500">
                        Model: {modelLabel ?? "dipilih"}
                      </div>
                    )}
                    {item.modelNotes && (
                      <div className="mt-0.5 line-clamp-2 break-words text-xs text-zinc-400">
                        Catatan: {item.modelNotes}
                      </div>
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
                        onClick={(e) =>
                          removeItem(index, e.currentTarget.closest<HTMLElement>("[data-cart-card]"))
                        }
                        aria-label="Hapus item"
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {custom ? "Disepakati admin" : displayPrice(price, showItemPrice)}
                    </div>
                    <div className="text-sm text-zinc-500">x {item.quantity}</div>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>

          <div className="min-w-0 lg:col-span-1">
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
                  {cart.some(isCustomItem) && (
                    <> Item &ldquo;Sesuai kebutuhan&rdquo; tidak termasuk total estimasi.</>
                  )}
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
