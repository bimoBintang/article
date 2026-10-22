"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";
import type { Testimonial } from "@/types";

type FormState = {
  quote: string;
  name: string;
  title: string;
  /** Kosong = otomatis di paling akhir (hanya saat menambah) */
  sort_order: string;
  is_published: boolean;
};

const EMPTY_FORM: FormState = {
  quote: "",
  name: "",
  title: "",
  sort_order: "",
  is_published: true,
};

const QUOTE_MAX = 400;

const inputClass =
  "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-zinc-900 text-foreground";
const labelClass =
  "block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300";
const thClass =
  "whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:px-6";

async function fetchTestimonials(): Promise<Testimonial[]> {
  const res = await fetch("/api/admin/testimonials");
  if (!res.ok) throw new Error("Gagal memuat testimoni");
  const data = await res.json();
  return data.testimonials ?? [];
}

export default function AdminTestimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // `active` mencegah state diisi setelah halaman ditinggalkan
    let active = true;
    fetchTestimonials()
      .then((rows) => active && setItems(rows))
      .catch(
        (err) =>
          active &&
          setError(err instanceof Error ? err.message : "Gagal memuat testimoni")
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function reload() {
    try {
      setItems(await fetchTestimonials());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat testimoni");
    }
  }

  function notify(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 4000);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
    setOpen(true);
  }

  function openEdit(t: Testimonial) {
    setForm({
      quote: t.quote,
      name: t.name,
      title: t.title ?? "",
      sort_order: String(t.sort_order),
      is_published: t.is_published,
    });
    setEditingId(t.id);
    setFormError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const payload = {
        quote: form.quote,
        name: form.name,
        title: form.title.trim() || null,
        is_published: form.is_published,
        ...(form.sort_order.trim() !== ""
          ? { sort_order: Number(form.sort_order) }
          : {}),
      };

      const res = await fetch(
        editingId
          ? `/api/admin/testimonials/${editingId}`
          : "/api/admin/testimonials",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan testimoni");
      }

      setOpen(false);
      notify(editingId ? "Testimoni diperbarui" : "Testimoni ditambahkan");
      setEditingId(null);
      await reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan testimoni"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(t: Testimonial) {
    setError("");
    try {
      const res = await fetch(`/api/admin/testimonials/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !t.is_published }),
      });
      if (!res.ok) throw new Error("Gagal mengubah status testimoni");
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengubah status testimoni"
      );
    }
  }

  async function remove(t: Testimonial) {
    if (!confirm(`Hapus testimoni dari ${t.name}?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/testimonials/${t.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus testimoni");
      notify("Testimoni dihapus");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus testimoni");
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
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Kelola Testimoni
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tampil sebagai kartu bergerak di beranda. Berurutan dari angka
            terkecil.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Tambah Testimoni
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className={thClass}>Urutan</th>
              <th className={thClass}>Kutipan</th>
              <th className={thClass}>Nama</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.length > 0 ? (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <td className="px-4 py-4 font-mono text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                    {t.sort_order}
                  </td>
                  <td className="max-w-md px-4 py-4 sm:px-6">
                    <p className="line-clamp-2 text-sm text-foreground">
                      {t.quote}
                    </p>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm font-medium text-foreground">
                      {t.name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t.title || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        t.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {t.is_published ? "Tampil" : "Disembunyikan"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                    <button
                      onClick={() => togglePublished(t)}
                      className="mr-4 text-xs text-zinc-600 hover:underline dark:text-zinc-300"
                    >
                      {t.is_published ? "Sembunyikan" : "Tampilkan"}
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="mr-4 text-xs text-primary hover:underline"
                    >
                      <Edit3 className="mr-1 inline h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => remove(t)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" /> Hapus
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  Belum ada testimoni. Bagian ini tersembunyi di beranda sampai
                  ada yang tampil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      <div
        className={`fixed inset-0 z-50 ${open ? "flex" : "hidden"} items-center justify-center overflow-y-auto p-4`}
      >
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit testimoni" : "Tambah testimoni"}
          className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-800"
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">
              {editingId ? "Edit Testimoni" : "Tambah Testimoni"}
            </h3>
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={save} className="space-y-4">
            {formError && (
              <Alert variant="error" title="Gagal">
                {formError}
              </Alert>
            )}

            <div>
              <label htmlFor="t-quote" className={labelClass}>
                Kutipan
              </label>
              <textarea
                id="t-quote"
                value={form.quote}
                onChange={(e) => setForm({ ...form, quote: e.target.value })}
                rows={4}
                maxLength={QUOTE_MAX}
                required
                className={inputClass}
              />
              <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                {form.quote.length}/{QUOTE_MAX}
              </p>
            </div>

            <div>
              <label htmlFor="t-name" className={labelClass}>
                Nama
              </label>
              <input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="t-title" className={labelClass}>
                Brand / jabatan (opsional)
              </label>
              <input
                id="t-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="t-order" className={labelClass}>
                Urutan
              </label>
              <input
                id="t-order"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: e.target.value })
                }
                placeholder={editingId ? "" : "Kosongkan untuk paling akhir"}
                className={inputClass}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="t-published"
                type="checkbox"
                checked={form.is_published}
                onChange={(e) =>
                  setForm({ ...form, is_published: e.target.checked })
                }
              />
              <label
                htmlFor="t-published"
                className="text-sm text-zinc-700 dark:text-zinc-300"
              >
                Tampilkan di beranda
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-foreground hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : editingId ? "Perbarui" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
