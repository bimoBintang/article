"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/use-settings";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Edit3,
  Eye,
  LayoutGrid,
  List,
  Box,
  Images,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";
import { CardStack } from "@/components/ui/card-stack";
import { ProductPreview } from "@/components/admin/product-preview";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import {
  AnimatedTableBody,
  AnimatedTableRow,
} from "@/components/ui/animated-table";
import {
  ProductFormModal,
  type AdminProduct,
} from "@/components/admin/product-form-modal";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";

type Product = AdminProduct & {
  gallery?: string[];
  has_3d?: boolean;
};

export default function AdminProducts() {
  const { settings } = useSettings(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const { preview, openPreview, closePreview } = useTablePreview();

  // Modal gabungan tambah / edit produk
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Gagal memuat produk");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat produk");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function notify(type: "success" | "error", text: string) {
    if (type === "success") {
      setSuccess(text);
      setTimeout(() => setSuccess(""), 4000);
    } else {
      setError(text);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Hapus produk ini?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus produk");
      setSuccess("Produk berhasil dihapus");
      setTimeout(() => setSuccess(""), 4000);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus produk");
    }
  }

  /** Buka preview lightbox untuk sebuah produk. */
  function previewProduct(product: Product) {
    const images = [
      ...(product.gallery || []),
      ...(product.thumbnail_url &&
      !(product.gallery || []).includes(product.thumbnail_url)
        ? [product.thumbnail_url]
        : []),
    ].map((url) => ({ url, alt: product.name }));

    openPreview({
      title: product.name,
      subtitle: [product.category, product.slug].filter(Boolean).join(" • "),
      images,
      meta: [
        { label: "Kategori", value: product.category || "-" },
        {
          label: "Harga Dasar",
          value: product.base_price
            ? `Rp ${product.base_price.toLocaleString("id-ID")}`
            : "-",
        },
        { label: "Status", value: product.is_published ? "Dipublikasikan" : "Draft" },
        { label: "Foto galeri", value: `${product.gallery?.length ?? 0} foto` },
      ],
    });
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setModalOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonPageHeader />
        <SkeletonTable columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" title="Gagal">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" title="Berhasil">
          {success}
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Kelola Produk
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Info dasar, model 3D 360°, dan galeri dikelola dalam satu form.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Toggle tampilan tabel / card stack */}
          <div className="flex shrink-0 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
            <button
              onClick={() => setViewMode("table")}
              aria-label="Tampilan tabel"
              aria-pressed={viewMode === "table"}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-primary text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              aria-label="Tampilan card stack"
              aria-pressed={viewMode === "cards"}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                viewMode === "cards"
                  ? "bg-primary text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={openCreate}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 sm:flex-none"
          >
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">
                  Produk
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">
                  Kategori
                </th>
                {settings.show_product_price && (
                  <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">
                    Harga Dasar
                  </th>
                )}
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">
                  Status
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">
                  Aksi
                </th>
              </tr>
            </thead>
            <AnimatedTableBody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {products.length > 0 ? (
                products.map((p, i) => (
                  <AnimatedTableRow
                    key={p.id}
                    index={i}
                    onDoubleClick={() => previewProduct(p)}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <ProductPreview
                          product={p}
                          onPreview={() => previewProduct(p)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {p.name}
                            </span>
                            {p.has_3d && (
                              <span
                                title="Punya model 3D 360°"
                                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                              >
                                <Box className="h-3 w-3" />3D
                              </span>
                            )}
                            {(p.gallery?.length ?? 0) > 0 && (
                              <span
                                title={`${p.gallery!.length} foto galeri`}
                                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              >
                                <Images className="h-3 w-3" />
                                {p.gallery!.length}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {p.slug}
                          </div>
                          {p.description && (
                            <p
                              title={p.description}
                              className="mt-1 max-w-xs truncate text-xs text-zinc-400 dark:text-zinc-500"
                            >
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                      {p.category}
                    </td>
                    {settings.show_product_price && (
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                        {p.base_price
                          ? `Rp ${p.base_price.toLocaleString("id-ID")}`
                          : "-"}
                      </td>
                    )}
                    <td className="px-4 py-4 sm:px-6">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          p.is_published
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {p.is_published ? "Dipublikasikan" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right sm:px-6">
                      <Link
                        href={`/produk/${p.slug}`}
                        className="text-xs text-primary hover:underline"
                      >
                        <Eye className="w-3 h-3 inline mr-1" /> Lihat
                      </Link>
                      <button
                        onClick={() => openEdit(p)}
                        title="Edit produk, model 3D, dan galeri"
                        className="ml-4 text-xs text-primary hover:underline"
                      >
                        <Edit3 className="w-3 h-3 inline mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="ml-4 text-xs text-red-600 hover:underline"
                      >
                        <Trash2 className="w-3 h-3 inline mr-1" /> Hapus
                      </button>
                    </td>
                  </AnimatedTableRow>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={settings.show_product_price ? 5 : 4}
                    className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    Belum ada produk. Tambahkan produk pertama.
                  </td>
                </tr>
              )}
            </AnimatedTableBody>
          </table>
        </div>
      ) : (
        <CardStack
          items={products}
          getKey={(p) => p.id}
          overlap={14}
          renderTitle={(p) => (
            <span className="flex items-center gap-2">
              {p.name}
              {p.has_3d && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <Box className="h-3 w-3" />3D
                </span>
              )}
            </span>
          )}
          renderSubtitle={(p) => `${p.category} • ${p.slug}`}
          renderMedia={(p) =>
            p.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.thumbnail_url}
                alt={p.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-12 overflow-hidden rounded-lg">
                <ImagePlaceholder label={p.name} />
              </div>
            )
          }
          renderExpanded={(p) => (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Kategori:{" "}
                  <span className="text-foreground">{p.category}</span>
                </span>
                {settings.show_product_price && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Harga:{" "}
                    <span className="text-foreground">
                      {p.base_price
                        ? `Rp ${p.base_price.toLocaleString("id-ID")}`
                        : "-"}
                    </span>
                  </span>
                )}
                <span className="text-zinc-500 dark:text-zinc-400">
                  Status:{" "}
                  <span className="text-foreground">
                    {p.is_published ? "Dipublikasikan" : "Draft"}
                  </span>
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Aset:{" "}
                  <span className="text-foreground">
                    {p.has_3d ? "Ada 3D" : "Tanpa 3D"} ·{" "}
                    {p.gallery?.length ?? 0} foto
                  </span>
                </span>
              </div>
              {p.description && (
                <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {p.description}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href={`/produk/${p.slug}`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Lihat
                </Link>
                <button
                  onClick={() => openEdit(p)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 dark:border-zinc-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                >
                  Hapus
                </button>
              </div>
            </div>
          )}
        />
      )}

      {/* Preview double-click */}
      <TablePreview
        open={Boolean(preview)}
        onClose={closePreview}
        title={preview?.title}
        subtitle={preview?.subtitle}
        images={preview?.images}
        meta={preview?.meta}
      />

      {/* Modal gabungan: info dasar + model 3D 360° + galeri + thumbnail */}
      <ProductFormModal
        open={modalOpen}
        product={editing}
        onClose={() => setModalOpen(false)}
        onSaved={loadProducts}
        notify={notify}
      />
    </div>
  );
}
