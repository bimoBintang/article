"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/use-settings";
import Link from "next/link";
import { Plus, Trash2, Edit3, X } from "lucide-react";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Alert } from "@/components/ui/alert";
import {
  uploadToStorage,
  pickFile as pickFileDialog,
} from "@/lib/upload-client";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";
import { CardStack } from "@/components/ui/card-stack";
import { ProductPreview } from "@/components/admin/product-preview";
import {
  AnimatedTableBody,
  AnimatedTableRow,
} from "@/components/ui/animated-table";
import { LayoutGrid, List } from "lucide-react";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";

type Talent = {
  id: string;
  name: string;
  photo_url: string | null;
  height_cm: number | null;
  size: string | null;
  style: string | null;
  additional_fee: number;
  consent_ref: string | null;
  is_available: boolean;
};

export default function AdminModels() {
  const { settings } = useSettings(true);
  const { preview, openPreview, closePreview } = useTablePreview();
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    photo_url: "",
    height_cm: "",
    size: "",
    style: "",
    additional_fee: "0",
    consent_ref: "",
    is_available: true,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    loadTalents();
  }, []);

  function previewTalent(talent: Talent) {
    openPreview({
      title: talent.name,
      subtitle:
        [talent.style, talent.size].filter(Boolean).join(" • ") || undefined,
      images: talent.photo_url
        ? [{ url: talent.photo_url, alt: talent.name }]
        : [],
      meta: [
        {
          label: "Tinggi",
          value: talent.height_cm ? `${talent.height_cm} cm` : "-",
        },
        { label: "Ukuran", value: talent.size || "-" },
        { label: "Gaya", value: talent.style || "-" },
        {
          label: "Tarif Tambahan",
          value: talent.additional_fee
            ? `Rp ${talent.additional_fee.toLocaleString("id-ID")}`
            : "-",
        },
        {
          label: "Status",
          value: talent.is_available ? "Tersedia" : "Tidak Tersedia",
        },
      ],
    });
  }

  async function loadTalents() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/talents");
      if (!res.ok) throw new Error("Gagal memuat model");
      const data = await res.json();
      setTalents(data.talents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat model");
      setTalents([]);
    } finally {
      setLoading(false);
    }
  }

  async function createTalent() {
    setError("");
    try {
      const res = await fetch("/api/admin/talents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          photo_url: form.photo_url || null,
          height_cm: form.height_cm ? parseInt(form.height_cm) : null,
          size: form.size || null,
          style: form.style || null,
          additional_fee: form.additional_fee ? parseInt(form.additional_fee) : 0,
          consent_ref: form.consent_ref || null,
          is_available: form.is_available,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal menambah model");
      }

      setOpen(false);
      setForm({
        name: "", photo_url: "", height_cm: "", size: "", style: "",
        additional_fee: "0", consent_ref: "", is_available: true,
      });
      setEditingId(null);
      setSuccess("Model berhasil ditambahkan");
      setTimeout(() => setSuccess(""), 4000);
      loadTalents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah model");
    }
  }

  async function updateTalent() {
    setError("");
    if (!editingId) return;
    try {
      const res = await fetch(`/api/admin/talents/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          photo_url: form.photo_url || null,
          height_cm: form.height_cm ? parseInt(form.height_cm) : null,
          size: form.size || null,
          style: form.style || null,
          additional_fee: form.additional_fee ? parseInt(form.additional_fee) : 0,
          consent_ref: form.consent_ref || null,
          is_available: form.is_available,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal memperbarui model");
      }

      setOpen(false);
      setEditingId(null);
      setSuccess("Model berhasil diperbarui");
      setTimeout(() => setSuccess(""), 4000);
      loadTalents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui model");
    }
  }

  async function deleteTalent(id: string) {
    if (!confirm("Hapus model ini?")) return;
    try {
      const res = await fetch(`/api/admin/talents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus model");
      loadTalents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus model");
    }
  }

  // Upload foto model ke object storage
  async function pickFile() {
    const file = await pickFileDialog(".jpg,.jpeg,.png,.webp");
    if (!file) return;
    try {
      const { url } = await uploadToStorage(file, "model-photo");
      setPhotoPreview(url);
      setForm({ ...form, photo_url: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah foto");
    }
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
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Kelola Model</h1>
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
            onClick={() => {
              setForm({
                name: "", photo_url: "", height_cm: "", size: "", style: "",
                additional_fee: "0", consent_ref: "", is_available: true,
              });
              setPhotoPreview(null);
              setEditingId(null);
              setOpen(true);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 sm:flex-none"
          >
            <Plus className="w-4 h-4" /> Tambah Model
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Model</th>
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Detail</th>
              {settings.show_additional_fee && (
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Tarif Tambahan</th>
              )}
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Tersedia</th>
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <AnimatedTableBody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {talents.length > 0 ? (
              talents.map((t, i) => (
                <AnimatedTableRow
                  key={t.id}
                  index={i}
                  onDoubleClick={() => previewTalent(t)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <ProductPreview
                        product={{
                          id: t.id,
                          name: t.name,
                          thumbnail_url: t.photo_url,
                          gallery: t.photo_url ? [t.photo_url] : [],
                        }}
                        onPreview={() => previewTalent(t)}
                        className="rounded-full"
                      />
                      <div className="font-medium text-foreground">{t.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {t.height_cm ? `${t.height_cm} cm` : "-"} • {t.size || "-"} • {t.style || "-"}
                  </td>
                  {settings.show_additional_fee && (
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                      {t.additional_fee ? `Rp ${t.additional_fee.toLocaleString("id-ID")}` : "-"}
                    </td>
                  )}
                  <td className="px-4 py-4 sm:px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.is_available ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                      {t.is_available ? "Tersedia" : "Tidak Tersedia"}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-right">
                    <button
                      onClick={() => {
                        setForm({
                          name: t.name,
                          photo_url: t.photo_url || "",
                          height_cm: t.height_cm?.toString() || "",
                          size: t.size || "",
                          style: t.style || "",
                          additional_fee: t.additional_fee?.toString() || "0",
                          consent_ref: t.consent_ref || "",
                          is_available: t.is_available,
                        });
                        setPhotoPreview(t.photo_url || null);
                        setEditingId(t.id);
                        setOpen(true);
                      }}
                      className="text-xs text-primary hover:underline mr-4"
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => deleteTalent(t.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" /> Hapus
                    </button>
                  </td>
                </AnimatedTableRow>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Belum ada model.
                </td>
              </tr>
            )}
          </AnimatedTableBody>
        </table>
      </div>
      ) : (
        <CardStack
          items={talents}
          getKey={(t) => t.id}
          overlap={14}
          renderTitle={(t) => t.name}
          renderSubtitle={(t) =>
            [
              t.height_cm ? `${t.height_cm} cm` : null,
              t.size,
              t.style,
            ]
              .filter(Boolean)
              .join(" • ") || "Detail belum diisi"
          }
          renderMedia={(t) =>
            t.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.photo_url}
                alt={t.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12">
                <ImagePlaceholder label={t.name} rounded />
              </div>
            )
          }
          renderExpanded={(t) => (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Tinggi:{" "}
                  <span className="text-foreground">
                    {t.height_cm ? `${t.height_cm} cm` : "-"}
                  </span>
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Ukuran:{" "}
                  <span className="text-foreground">{t.size || "-"}</span>
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Gaya:{" "}
                  <span className="text-foreground">{t.style || "-"}</span>
                </span>
                {settings.show_additional_fee && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Tarif:{" "}
                    <span className="text-foreground">
                      {t.additional_fee
                        ? `Rp ${t.additional_fee.toLocaleString("id-ID")}`
                        : "-"}
                    </span>
                  </span>
                )}
                <span className="text-zinc-500 dark:text-zinc-400">
                  Status:{" "}
                  <span className="text-foreground">
                    {t.is_available ? "Tersedia" : "Tidak Tersedia"}
                  </span>
                </span>
              </div>
              {t.consent_ref && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Persetujuan penggunaan foto: {t.consent_ref}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => {
                    setForm({
                      name: t.name,
                      photo_url: t.photo_url || "",
                      height_cm: t.height_cm?.toString() || "",
                      size: t.size || "",
                      style: t.style || "",
                      additional_fee: t.additional_fee?.toString() || "0",
                      consent_ref: t.consent_ref || "",
                      is_available: t.is_available,
                    });
                    setPhotoPreview(t.photo_url || null);
                    setEditingId(t.id);
                    setOpen(true);
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 dark:border-zinc-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTalent(t.id)}
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

      {/* Modal form */}
      <div className={`fixed inset-0 z-50 ${open ? "flex" : "hidden"} items-center justify-center overflow-y-auto p-4`}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-foreground">
              {editingId ? "Edit Model" : "Tambah Model"}
            </h3>
            <button onClick={() => { setPhotoPreview(null); setOpen(false); }} aria-label="Tutup" className="text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); editingId ? updateTalent() : createTalent(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Nama Model</label>
              <input
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Foto URL</label>
              <div className="relative">
                <input
                  value={form.photo_url}
                  onChange={(e) => setForm({...form, photo_url: e.target.value})}
                  className="w-full pr-12 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await pickFile();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                >
                  Pilih File
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                URL atau path file foto model. JPG, JPEG, dan PNG otomatis
                dikonversi ke WebP saat diunggah.
              </p>
              {photoPreview && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-lg object-cover border border-zinc-300 dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      setForm({...form, photo_url: ""});
                    }}
                    className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Tinggi (cm)</label>
                <input type="number" value={form.height_cm} onChange={(e) => setForm({...form, height_cm: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Ukuran</label>
                <input value={form.size} onChange={(e) => setForm({...form, size: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Gaya</label>
              <input value={form.style} onChange={(e) => setForm({...form, style: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Tarif Tambahan (Rp)</label>
              <input type="number" value={form.additional_fee} onChange={(e) => setForm({...form, additional_fee: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({...form, is_available: e.target.checked})} />
              <label className="text-sm text-zinc-700 dark:text-zinc-300">Tersedia untuk booking</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground">Batal</button>
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                {editingId ? "Perbarui" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


