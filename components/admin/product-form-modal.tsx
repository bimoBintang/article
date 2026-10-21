"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Box,
  Images,
  Trash2,
  Rotate3D,
  Camera,
  ArrowUp,
  ArrowDown,
  Upload,
  Save,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import {
  uploadToStorage,
  pickFile as pickFileDialog,
  pickFiles,
  formatFileSize,
} from "@/lib/upload-client";
import type { Viewer3DApi } from "@/components/viewer3d";

const Viewer3D = dynamic(
  () => import("@/components/viewer3d").then((mod) => mod.Viewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
        <span className="text-sm text-zinc-500">Memuat preview 3D...</span>
      </div>
    ),
  }
);

const MAX_GLB_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price: number | null;
  is_published: boolean;
};

type ModelAsset = {
  id: string;
  file_url: string;
  poster_url: string | null;
  size_bytes: number | null;
  optimization_status: string | null;
};

type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
};

type FormState = {
  name: string;
  slug: string;
  category: string;
  description: string;
  base_price: string;
  is_published: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  category: "",
  description: "",
  base_price: "",
  is_published: false,
};

const EMPTY_FORM_ERRORS: Partial<Record<keyof FormState, string>> = {};

/**
 * Ubah data URL (hasil snapshot canvas) menjadi File agar bisa diunggah.
 */
function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header?.match(/data:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/**
 * Modal gabungan untuk menambah & mengedit produk.
 *
 * Berisi satu form yang menggabungkan:
 *  1. Info dasar (nama, slug, kategori, deskripsi, harga, publikasi)
 *  2. Model 3D 360° dengan preview langsung + snapshot untuk thumbnail
 *  3. Galeri foto multi sudut (upload, ubah urutan, hapus)
 *  4. Thumbnail — otomatis memakai poster/snapshot model 3D
 *
 * File 3D & galeri "di-stage" di browser lebih dulu, lalu diunggah
 * setelah produk dibuat/diupdate (butuh product id).
 */
export function ProductFormModal({
  open,
  product,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  product: AdminProduct | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (type: "success" | "error", text: string) => void;
}) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>(EMPTY_FORM_ERRORS);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  // --- Model 3D ---
  const [modelAsset, setModelAsset] = useState<ModelAsset | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [glbPreviewUrl, setGlbPreviewUrl] = useState<string | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelMessage, setModelMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const viewerApiRef = useRef<Viewer3DApi | null>(null);

  // --- Galeri ---
  const [images, setImages] = useState<ProductImage[]>([]);
  const [stagedImages, setStagedImages] = useState<File[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryMessage, setGalleryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // --- Thumbnail ---
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [pendingPosterIsThumb, setPendingPosterIsThumb] = useState(false);

  // Object URL untuk foto galeri yang baru dipilih (dibuat sekali per file)
  const stagedImageUrls = useMemo(
    () => stagedImages.map((file) => URL.createObjectURL(file)),
    [stagedImages]
  );

  /* ------------------------------------------------------------------ *
   * Reset state saat modal dibuka
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!open) return;

    setFormErrors(EMPTY_FORM_ERRORS);
    setLoadError("");
    setModelMessage(null);
    setGalleryMessage(null);
    setGlbFile(null);
    setPosterFile(null);
    setGlbPreviewUrl(null);
    setPosterPreviewUrl(null);
    setStagedImages([]);
    setThumbnailDataUrl(null);
    viewerApiRef.current = null;

    if (product) {
      setForm({
        name: product.name,
        slug: product.slug,
        category: product.category,
        description: product.description || "",
        base_price: product.base_price?.toString() || "",
        is_published: product.is_published,
      });
      setThumbnailUrl(product.thumbnail_url);
      loadAssets(product.id);
    } else {
      setForm(EMPTY_FORM);
      setThumbnailUrl(null);
      setModelAsset(null);
      setImages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  /* ------------------------------------------------------------------ *
   * Muat aset 3D & galeri dari server
   * ------------------------------------------------------------------ */
  async function loadAssets(productId: string) {
    try {
      const [modelRes, imageRes] = await Promise.all([
        fetch(`/api/admin/products/${productId}/model-asset`),
        fetch(`/api/admin/products/${productId}/images`),
      ]);

      if (modelRes.ok) {
        const data = await modelRes.json();
        const asset = (data.assets || [])[0] || null;
        setModelAsset(asset);
      }

      if (imageRes.ok) {
        const data = await imageRes.json();
        setImages(data.images || []);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Gagal memuat aset produk"
      );
    }
  }

  /* ------------------------------------------------------------------ *
   * Model 3D
   * ------------------------------------------------------------------ */
  async function handlePickModel() {
    const file = await pickFileDialog(".glb,.gltf");
    if (!file) return;

    if (file.size > MAX_GLB_SIZE) {
      setModelMessage({
        type: "error",
        text: `Ukuran file 3D maksimal 50 MB (file Anda: ${formatFileSize(file.size)})`,
      });
      return;
    }

    setModelMessage(null);
    setGlbFile(file);
    setPosterFile(null);
    setPosterPreviewUrl(null);

    if (glbPreviewUrl) URL.revokeObjectURL(glbPreviewUrl);
    setGlbPreviewUrl(URL.createObjectURL(file));
  }

  async function handlePickPoster() {
    const file = await pickFileDialog(".jpg,.jpeg,.png,.webp");
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setModelMessage({
        type: "error",
        text: `Ukuran poster maksimal 5 MB (file Anda: ${formatFileSize(file.size)})`,
      });
      return;
    }

    setModelMessage(null);
    setPosterFile(file);
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
    setPosterPreviewUrl(URL.createObjectURL(file));

    // Poster otomatis dipakai sebagai thumbnail
    setThumbnailDataUrl(null);
    setThumbnailUrl(null);
    setPendingPosterIsThumb(true);
  }

  /**
   * Hapus model 3D.
   * - Jika ada file baru (staged), cukup buang dari state.
   * - Jika model sudah tersimpan di server, hapus juga dari server.
   */
  async function handleRemoveModel() {
    if (glbPreviewUrl) URL.revokeObjectURL(glbPreviewUrl);
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
    setGlbFile(null);
    setPosterFile(null);
    setGlbPreviewUrl(null);
    setPosterPreviewUrl(null);
    setModelMessage(null);
    setPendingPosterIsThumb(false);
    viewerApiRef.current = null;

    if (modelAsset && product) {
      try {
        const res = await fetch(
          `/api/admin/products/${product.id}/model-asset?assetId=${modelAsset.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Gagal menghapus aset 3D");
        setModelAsset(null);
        setModelMessage({ type: "success", text: "Model 3D berhasil dihapus" });
      } catch (err) {
        setModelMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Gagal menghapus aset 3D",
        });
      }
    }
  }

  /** Snapshot model 3D yang sedang tampil → dipakai sebagai thumbnail. */
  const handleCaptureThumbnail = useCallback(() => {
    const dataUrl = viewerApiRef.current?.capture();
    if (!dataUrl) {
      setModelMessage({
        type: "error",
        text: "Preview 3D belum siap. Tunggu model selesai dimuat lalu coba lagi.",
      });
      return;
    }
    setThumbnailDataUrl(dataUrl);
    setThumbnailUrl(null);
    setPendingPosterIsThumb(false);
    setModelMessage({
      type: "success",
      text: "Thumbnail diambil dari preview 3D. Klik Simpan untuk menyimpan.",
    });
  }, []);

  /* ------------------------------------------------------------------ *
   * Galeri
   * ------------------------------------------------------------------ */
  async function handlePickGallery() {
    const files = await pickFiles(".jpg,.jpeg,.png,.webp");
    if (files.length === 0) return;

    const tooBig = files.find((f) => f.size > MAX_IMAGE_SIZE);
    if (tooBig) {
      setGalleryMessage({
        type: "error",
        text: `Ukuran maksimal 5 MB per foto. "${tooBig.name}" terlalu besar (${formatFileSize(tooBig.size)}).`,
      });
      return;
    }

    setGalleryMessage(null);
    setStagedImages((prev) => [...prev, ...files]);
  }

  function removeStagedImage(index: number) {
    setStagedImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function deleteGalleryImage(imageId: string) {
    if (!product) return;
    setGalleryBusy(true);
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/images?imageId=${imageId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Gagal menghapus foto");
      setGalleryMessage({ type: "success", text: "Foto berhasil dihapus" });
      await loadAssets(product.id);
    } catch (err) {
      setGalleryMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus foto",
      });
    } finally {
      setGalleryBusy(false);
    }
  }

  async function moveGalleryImage(index: number, direction: -1 | 1) {
    if (!product) return;
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    setImages(next); // optimistic update

    try {
      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: next.map((i) => i.id) }),
      });
      if (!res.ok) throw new Error("Gagal mengubah urutan");
      await loadAssets(product.id);
    } catch (err) {
      setGalleryMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengubah urutan",
      });
      await loadAssets(product.id);
    }
  }

  /* ------------------------------------------------------------------ *
   * Simpan
   * ------------------------------------------------------------------ */
  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = "Nama produk wajib diisi";
    if (!form.slug.trim()) errs.slug = "Slug wajib diisi";
    if (!form.category.trim()) errs.category = "Kategori wajib diisi";
    if (form.description.length > 2000)
      errs.description = "Deskripsi maksimal 2000 karakter";
    if (form.base_price && Number(form.base_price) < 0)
      errs.base_price = "Harga tidak boleh negatif";

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    setLoadError("");

    try {
      /* --- 1. Buat / perbarui produk --- */
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        base_price: form.base_price ? parseInt(form.base_price) : null,
        is_published: form.is_published,
      };

      let productId = product?.id ?? null;

      if (productId) {
        const res = await fetch(`/api/admin/products/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Gagal memperbarui produk");
        }
      } else {
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Gagal menambah produk");
        }
        const data = await res.json();
        productId = data.product?.id;
      }

      if (!productId) throw new Error("Produk tidak tersimpan");

      /* --- 2. Unggah model 3D --- */
      let uploadedPosterUrl: string | null = null;

      if (glbFile) {
        setModelBusy(true);
        const model = await uploadToStorage(glbFile, "model");
        let posterUrl: string | null = null;

        if (posterFile) {
          const poster = await uploadToStorage(posterFile, "poster");
          posterUrl = poster.url;
          uploadedPosterUrl = poster.url;
        }

        const res = await fetch(`/api/admin/products/${productId}/model-asset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_url: model.url,
            poster_url: posterUrl,
            size_bytes: model.sizeBytes,
            optimization_status: "optimized",
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Gagal menyimpan aset 3D");
        }
        setModelBusy(false);
      } else if (posterFile) {
        // Poster dipilih tanpa model 3D -> tetap unggah (dipakai sebagai thumbnail)
        setModelBusy(true);
        const poster = await uploadToStorage(posterFile, "poster");
        uploadedPosterUrl = poster.url;
        setModelBusy(false);
      }

      /* --- 3. Unggah foto galeri --- */
      if (stagedImages.length > 0) {
        setGalleryBusy(true);
        for (const file of stagedImages) {
          const { url } = await uploadToStorage(file, "product");
          const res = await fetch(`/api/admin/products/${productId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: url, alt_text: null }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Gagal menyimpan foto");
          }
        }
        setGalleryBusy(false);
        setStagedImages([]);
      }

      /* --- 4. Thumbnail --- */
      let finalThumbnail = thumbnailUrl;

      if (thumbnailDataUrl) {
        // Snapshot dari preview 3D
        const file = dataUrlToFile(thumbnailDataUrl, `thumbnail-${Date.now()}.png`);
        const { url } = await uploadToStorage(file, "thumb");
        finalThumbnail = url;
      } else if (pendingPosterIsThumb && uploadedPosterUrl) {
        // Poster model 3D dipakai sebagai thumbnail
        finalThumbnail = uploadedPosterUrl;
      }

      if (finalThumbnail !== (product?.thumbnail_url ?? null)) {
        const res = await fetch(`/api/admin/products/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thumbnail_url: finalThumbnail }),
        });
        if (!res.ok) throw new Error("Gagal menyimpan thumbnail");
      }

      notify("success", "Produk berhasil disimpan");
      onSaved();
      onClose();
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Gagal menyimpan produk"
      );
    } finally {
      setSaving(false);
      setModelBusy(false);
      setGalleryBusy(false);
    }
  }

  if (!open) return null;

  const previewModelUrl = glbPreviewUrl || modelAsset?.file_url || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isEdit ? "Edit Produk" : "Tambah Produk"}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Isi info dasar, model 3D 360°, dan galeri foto dalam satu tempat.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadError && (
          <div className="mb-4">
            <Alert variant="error" title="Gagal">
              {loadError}
            </Alert>
          </div>
        )}

        <div className="space-y-6">
          {/* ============ 1. INFO DASAR ============ */}
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Info Dasar
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Produk" error={formErrors.name} required>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug:
                        form.slug ||
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/(^-|-$)/g, ""),
                    })
                  }
                  aria-invalid={Boolean(formErrors.name)}
                  className={inputClass(formErrors.name)}
                  placeholder="Contoh: Kemeja Linen Premium"
                />
              </Field>

              <Field label="Slug" error={formErrors.slug} required>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  aria-invalid={Boolean(formErrors.slug)}
                  className={inputClass(formErrors.slug)}
                  placeholder="kemeja-linen-premium"
                />
              </Field>

              <Field label="Kategori" error={formErrors.category} required>
                <input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  aria-invalid={Boolean(formErrors.category)}
                  className={inputClass(formErrors.category)}
                  placeholder="Contoh: Kemeja"
                />
              </Field>

              <Field label="Harga Dasar (Rp)" error={formErrors.base_price}>
                <input
                  type="number"
                  value={form.base_price}
                  onChange={(e) =>
                    setForm({ ...form, base_price: e.target.value })
                  }
                  aria-invalid={Boolean(formErrors.base_price)}
                  className={inputClass(formErrors.base_price)}
                  placeholder="160000"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Deskripsi Produk" error={formErrors.description}>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value.slice(0, 2000),
                    })
                  }
                  rows={5}
                  maxLength={2000}
                  aria-invalid={Boolean(formErrors.description)}
                  className={`${inputClass(formErrors.description)} resize-y`}
                  placeholder="Jelaskan detail produk: bahan, ukuran, warna tersedia, fitur khusus, kondisi, dll."
                />
                <p className="mt-1 text-right text-xs text-zinc-400">
                  {form.description.length}/2000
                </p>
              </Field>
            </div>

            <label className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) =>
                  setForm({ ...form, is_published: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Dipublikasikan (tampil di katalog)
              </span>
            </label>
          </section>

          {/* ============ 2. MODEL 3D 360° ============ */}
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Box className="h-4 w-4 text-primary" />
                Model 3D 360°
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePickModel}
                  disabled={modelBusy || saving}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {glbFile ? "Ganti .glb" : "Pilih .glb"}
                </button>
                <button
                  type="button"
                  onClick={handlePickPoster}
                  disabled={modelBusy || saving}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {posterFile ? "Ganti poster" : "Pilih poster"}
                </button>
                {(glbFile || modelAsset) && (
                  <button
                    type="button"
                    onClick={handleRemoveModel}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus model
                  </button>
                )}
              </div>
            </div>

            {modelMessage && (
              <div className="mb-3">
                <Alert
                  variant={modelMessage.type === "success" ? "success" : "error"}
                  title={modelMessage.type === "success" ? "Berhasil" : "Gagal"}
                >
                  {modelMessage.text}
                </Alert>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              {/* Preview 3D */}
              <div>
                {previewModelUrl ? (
                  <div className="relative">
                    <Viewer3D
                      key={previewModelUrl}
                      glbUrl={previewModelUrl}
                      className="h-64 w-full"
                      onReady={(api) => {
                        viewerApiRef.current = api;
                      }}
                      onError={(msg) =>
                        setModelMessage({ type: "error", text: msg })
                      }
                    />
                    <button
                      type="button"
                      onClick={handleCaptureThumbnail}
                      className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/85"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Jadikan Thumbnail
                    </button>
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 text-center dark:border-zinc-700">
                    <Rotate3D className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Belum ada model 3D
                    </p>
                    <p className="max-w-xs px-4 text-xs text-zinc-400">
                      Pilih file .glb untuk melihat preview langsung di sini.
                    </p>
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {glbFile
                    ? `File baru: ${glbFile.name} (${formatFileSize(glbFile.size)}) — belum diunggah.`
                    : modelAsset
                      ? `Tersimpan: ${modelAsset.file_url.split("/").pop()}${
                          modelAsset.size_bytes
                            ? ` (${formatFileSize(modelAsset.size_bytes)})`
                            : ""
                        }`
                      : "Ukuran maksimal 50 MB."}
                </p>
              </div>

              {/* Poster */}
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Poster (opsional)
                </p>
                <div className="relative h-32 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                  {posterPreviewUrl || modelAsset?.poster_url ? (
                    <Image
                      src={posterPreviewUrl || modelAsset!.poster_url!}
                      alt="Poster model 3D"
                      fill
                      className="object-contain"
                      sizes="200px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                      Tanpa poster
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Poster otomatis dipakai sebagai thumbnail. JPG/PNG
                  otomatis dikonversi ke WebP.
                </p>
              </div>
            </div>
          </section>

          {/* ============ 3. GALERI FOTO ============ */}
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Images className="h-4 w-4 text-primary" />
                Galeri Foto
              </h3>
              <button
                type="button"
                onClick={handlePickGallery}
                disabled={galleryBusy || saving}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                <Upload className="h-3.5 w-3.5" />
                Tambah foto
              </button>
            </div>

            {galleryMessage && (
              <div className="mb-3">
                <Alert
                  variant={
                    galleryMessage.type === "success" ? "success" : "error"
                  }
                  title={galleryMessage.type === "success" ? "Berhasil" : "Gagal"}
                >
                  {galleryMessage.text}
                </Alert>
              </div>
            )}

            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              JPG, JPEG, dan PNG otomatis dikonversi ke WebP (maks. 1600px)
              agar halaman lebih ringan. Maksimal 5 MB per foto.
            </p>

            {images.length === 0 && stagedImages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                Belum ada foto. Tambahkan beberapa foto agar pelanggan bisa
                melihat produk dari berbagai sudut.
              </p>
            ) : (
              <ul className="space-y-2">
                {/* Foto tersimpan */}
                {images.map((img, index) => (
                  <li
                    key={img.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <Image
                        src={img.image_url}
                        alt={img.alt_text || `Foto ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Foto {index + 1}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Urutan {index + 1} •{" "}
                        {new Date(img.created_at).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailUrl(img.image_url);
                          setThumbnailDataUrl(null);
                        }}
                        title="Jadikan thumbnail"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-400"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGalleryImage(index, -1)}
                        disabled={index === 0}
                        aria-label="Geser ke atas"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 disabled:opacity-30 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGalleryImage(index, 1)}
                        disabled={index === images.length - 1}
                        aria-label="Geser ke bawah"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 disabled:opacity-30 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGalleryImage(img.id)}
                        disabled={galleryBusy}
                        aria-label="Hapus foto"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}

                {/* Foto baru (staged) */}
                {stagedImages.map((file, index) => (
                  <li
                    key={`staged-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <Image
                        src={stagedImageUrls[index]}
                        alt={`Foto baru ${index + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Foto baru {index + 1}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {file.name} • {formatFileSize(file.size)} — belum diunggah
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStagedImage(index)}
                      aria-label="Hapus foto"
                      className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ============ 4. THUMBNAIL ============ */}
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Star className="h-4 w-4 text-primary" />
              Thumbnail Produk
            </h3>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                {thumbnailDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailDataUrl}
                    alt="Thumbnail"
                    className="h-full w-full object-cover"
                  />
                ) : thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                    Belum ada
                  </div>
                )}
                {thumbnailDataUrl && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Dari preview 3D
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Thumbnail memakai model 3D 360°: pilih poster saat mengunggah
                  .glb, atau tekan{" "}
                  <strong>Jadikan Thumbnail</strong> di area preview. Foto
                  galeri juga bisa dijadikan thumbnail.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureThumbnail}
                    disabled={!previewModelUrl}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Ambil dari preview 3D
                  </button>
                  {(thumbnailUrl || thumbnailDataUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailUrl(null);
                        setThumbnailDataUrl(null);
                        setPendingPosterIsThumb(false);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus thumbnail
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            {isEdit
              ? "Perubahan langsung tersimpan ke katalog."
              : "Produk dibuat dulu, lalu model 3D & galeri ikut tersimpan."}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || modelBusy || galleryBusy}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan Produk
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helper UI                                                           */
/* ------------------------------------------------------------------ */

function inputClass(hasError?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-950 ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-zinc-300 dark:border-zinc-700"
  }`;
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
