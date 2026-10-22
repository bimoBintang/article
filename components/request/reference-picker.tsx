"use client";

import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import { uploadPublicImage, formatFileSize } from "@/lib/upload-client";
import {
  MAX_REFERENCE_IMAGES,
  MAX_REFERENCE_LINKS,
  PUBLIC_UPLOAD_MAX_BYTES,
  PUBLIC_UPLOAD_TYPES,
} from "@/lib/public-upload";

export type RefImage = {
  id: string;
  name: string;
  /** pratinjau lokal (object URL) */
  preview: string;
  status: "uploading" | "done" | "error";
  /** URL publik setelah unggahan berhasil */
  url?: string;
  error?: string;
};

/** Alamat http(s) yang valid. */
export function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Referensi permintaan Customize: unggah gambar (langsung ke storage lewat
 * endpoint publik terbatas) dan/atau tempel tautan.
 */
export function ReferencePicker({
  images,
  setImages,
  links,
  setLinks,
  error,
}: {
  images: RefImage[];
  setImages: Dispatch<SetStateAction<RefImage[]>>;
  links: string[];
  setLinks: Dispatch<SetStateAction<string[]>>;
  error?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [pickError, setPickError] = useState("");

  function pickFiles(files: FileList | null) {
    setPickError("");
    if (!files) return;
    const room = MAX_REFERENCE_IMAGES - images.length;
    const chosen = Array.from(files);
    if (chosen.length > room) {
      setPickError(`Maksimal ${MAX_REFERENCE_IMAGES} gambar; sisa slot ${Math.max(room, 0)}.`);
    }
    for (const file of chosen.slice(0, Math.max(room, 0))) {
      if (!(file.type in PUBLIC_UPLOAD_TYPES)) {
        setPickError(`${file.name}: hanya JPG, PNG, atau WebP.`);
        continue;
      }
      // Batas ini dicek lagi setelah kompresi; file mentah yang sangat besar tetap ditolak lebih awal
      if (file.size > PUBLIC_UPLOAD_MAX_BYTES * 8) {
        setPickError(`${file.name}: ukuran terlalu besar (${formatFileSize(file.size)}).`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: RefImage = {
        id,
        name: file.name,
        preview: URL.createObjectURL(file),
        status: "uploading",
      };
      setImages((prev) => [...prev, entry]);
      uploadPublicImage(file)
        .then((url) =>
          setImages((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status: "done", url } : i))
          )
        )
        .catch((err) =>
          setImages((prev) =>
            prev.map((i) =>
              i.id === id
                ? { ...i, status: "error", error: err instanceof Error ? err.message : "Unggahan gagal" }
                : i
            )
          )
        );
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  function addLink() {
    const value = linkInput.trim();
    if (!value) return;
    if (!isHttpUrl(value)) {
      setLinkError("Tautan harus diawali http:// atau https://");
      return;
    }
    if (links.includes(value)) {
      setLinkError("Tautan itu sudah ditambahkan.");
      return;
    }
    if (links.length >= MAX_REFERENCE_LINKS) {
      setLinkError(`Maksimal ${MAX_REFERENCE_LINKS} tautan.`);
      return;
    }
    setLinks((prev) => [...prev, value]);
    setLinkInput("");
    setLinkError("");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Referensi gambar
        </label>
        <p className="mb-2 text-xs text-zinc-500">
          JPG, PNG, atau WebP, maksimal {MAX_REFERENCE_IMAGES} gambar
          (otomatis dikecilkan, maks. 5 MB per gambar).
        </p>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt={img.name}
                className={`h-20 w-20 rounded-lg border object-cover ${
                  img.status === "error" ? "border-red-400" : "border-zinc-200"
                } ${img.status === "uploading" ? "opacity-50" : ""}`}
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                aria-label={`Hapus ${img.name}`}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="mt-1 block w-20 text-center text-[10px] text-zinc-500">
                {img.status === "uploading" && "Mengunggah..."}
                {img.status === "done" && "Terunggah"}
                {img.status === "error" && (
                  <span className="text-red-600" title={img.error}>
                    Gagal
                  </span>
                )}
              </span>
            </div>
          ))}
          {images.length < MAX_REFERENCE_IMAGES && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-zinc-400"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          data-testid="reference-file"
          onChange={(e) => pickFiles(e.target.files)}
        />
        {pickError && <p className="mt-2 text-xs text-red-600">{pickError}</p>}
        {images.some((i) => i.status === "error") && (
          <p className="mt-2 text-xs text-red-600">
            Hapus gambar yang gagal diunggah, lalu coba lagi.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="reference-link" className="mb-1 block text-sm font-medium text-zinc-700">
          Referensi tautan
        </label>
        <p className="mb-2 text-xs text-zinc-500">
          Mis. Pinterest, Instagram, atau Google Drive. Maksimal {MAX_REFERENCE_LINKS} tautan.
        </p>
        <div className="flex gap-2">
          <input
            id="reference-link"
            type="url"
            value={linkInput}
            onChange={(e) => {
              setLinkInput(e.target.value);
              setLinkError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="https://..."
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={addLink}
            className="shrink-0 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Tambah
          </button>
        </div>
        {linkError && <p className="mt-1 text-xs text-red-600">{linkError}</p>}
        {links.length > 0 && (
          <ul className="mt-2 space-y-1">
            {links.map((l) => (
              <li
                key={l}
                className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-sm"
              >
                <span className="min-w-0 break-all text-zinc-700">{l}</span>
                <button
                  type="button"
                  onClick={() => setLinks((prev) => prev.filter((x) => x !== l))}
                  aria-label={`Hapus tautan ${l}`}
                  className="shrink-0 text-zinc-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
