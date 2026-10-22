"use client";

import { useState, useEffect } from "react";
import {
  TablePreview,
  useTablePreview,
} from "@/components/admin/table-preview";
import { useSettings } from "@/lib/use-settings";
import Link from "next/link";
import { Plus, Trash2, Edit3, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

type Package = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  look_count: number | null;
  photo_count: number | null;
  is_active: boolean;
};

export default function AdminPackages() {
  const { settings } = useSettings(true);
  const { preview, openPreview, closePreview } = useTablePreview();

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    base_price: "0",
    look_count: "",
    photo_count: "",
    is_active: true,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadPackages();
  }, []);

  function previewPackage(pkg: Package) {
    openPreview({
      title: pkg.name,
      subtitle: pkg.description || undefined,
      meta: [
        {
          label: "Harga",
          value: `Rp ${pkg.base_price.toLocaleString("id-ID")}`,
        },
        { label: "Look", value: pkg.look_count ?? "-" },
        { label: "Foto", value: pkg.photo_count ?? "-" },
        { label: "Status", value: pkg.is_active ? "Aktif" : "Tidak Aktif" },
      ],
    });
  }

  async function loadPackages() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/packages");
      if (!res.ok) throw new Error("Gagal memuat paket");
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat paket");
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }

  async function savePackage() {
    setError("");
    try {
      if (editingId) {
        await updatePackage();
      } else {
        await createPackage();
      }
    } catch {
      // error already set
    }
  }

  async function createPackage() {
    const res = await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        base_price: form.base_price ? parseInt(form.base_price) : 0,
        look_count: form.look_count ? parseInt(form.look_count) : null,
        photo_count: form.photo_count ? parseInt(form.photo_count) : null,
        is_active: form.is_active,
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Gagal menambah paket");
    }

    setOpen(false);
    setEditingId(null);
    setForm({
      name: "", description: "", base_price: "0", look_count: "",
      photo_count: "", is_active: true,
    });
    setSuccess("Paket berhasil ditambahkan");
    setTimeout(() => setSuccess(""), 4000);
    loadPackages();
  }

  async function updatePackage() {
    if (!editingId) return;
    const res = await fetch(`/api/admin/packages/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        base_price: form.base_price ? parseInt(form.base_price) : 0,
        look_count: form.look_count ? parseInt(form.look_count) : null,
        photo_count: form.photo_count ? parseInt(form.photo_count) : null,
        is_active: form.is_active,
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Gagal memperbarui paket");
    }

    setOpen(false);
    setEditingId(null);
    setSuccess("Paket berhasil diperbarui");
    setTimeout(() => setSuccess(""), 4000);
    loadPackages();
  }

  async function deletePackage(id: string) {
    if (!confirm("Hapus paket ini?")) return;
    try {
      const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus paket");
      loadPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus paket");
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
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Kelola Paket</h1>
        <button
          onClick={() => {
            setForm({
              name: "", description: "", base_price: "0", look_count: "",
              photo_count: "", is_active: true,
            });
            setEditingId(null);
            setOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Tambah Paket
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Paket</th>
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Detail</th>
              {settings.show_package_price && (
                <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Harga</th>
              )}
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Aktif</th>
              <th className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {packages.length > 0 ? (
              packages.map((p) => (
                <tr
                  key={p.id}
                  onDoubleClick={() => previewPackage(p)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-4 sm:px-6 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-4 sm:px-6 text-sm text-zinc-600 dark:text-zinc-400">{p.description || "-"}</td>
                  {settings.show_package_price && (
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                      Rp {p.base_price.toLocaleString("id-ID")}
                    </td>
                  )}
                  <td className="px-4 py-4 sm:px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                      {p.is_active ? "Aktif" : "Tidak Aktif"}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6 text-right">
                    <button
                      onClick={() => {
                        setForm({
                          name: p.name,
                          description: p.description || "",
                          base_price: p.base_price?.toString() || "0",
                          look_count: p.look_count?.toString() || "",
                          photo_count: p.photo_count?.toString() || "",
                          is_active: p.is_active,
                        });
                        setEditingId(p.id);
                        setOpen(true);
                      }}
                      className="text-xs text-primary hover:underline mr-4"
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => deletePackage(p.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" /> Hapus
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Belum ada paket.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview double-click */}
      <TablePreview
        open={Boolean(preview)}
        onClose={closePreview}
        title={preview?.title}
        subtitle={preview?.subtitle}
        images={preview?.images}
        meta={preview?.meta}
      />

      {/* Package form modal */}
      <div className={`fixed inset-0 z-50 ${open ? "flex" : "hidden"} items-center justify-center overflow-y-auto p-4`}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-foreground">
              {editingId ? "Edit Paket" : "Tambah Paket"}
            </h3>
            <button onClick={() => setOpen(false)} aria-label="Tutup" className="text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); savePackage(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Nama Paket</label>
              <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Deskripsi</label>
              <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Harga Dasar (Rp)</label>
                <input type="number" value={form.base_price} onChange={(e) => setForm({...form, base_price: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Jumlah Look</label>
                <input type="number" value={form.look_count} onChange={(e) => setForm({...form, look_count: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Foto Hasil</label>
                <input type="number" value={form.photo_count} onChange={(e) => setForm({...form, photo_count: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} />
              <label className="text-sm text-zinc-700 dark:text-zinc-300">Aktif</label>
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
