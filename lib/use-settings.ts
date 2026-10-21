"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSettings } from "./settings";

const FALLBACK: PublicSettings = {
  show_product_price: true,
  show_package_price: true,
  show_additional_fee: true,
};

/**
 * Hook pengaturan tampilan harga.
 *
 * Menyediakan pembacaan (untuk halaman admin) dan penyimpanan
 * (untuk halaman Pengaturan).
 *
 * Penting: ada `versionRef` sebagai penanda. Tanpa itu, respons GET
 * yang lambat bisa tiba SETELAH pengguna men-toggle switch dan
 * menimpa perubahan tersebut dengan nilai lama.
 */
export function useSettings(admin = false) {
  const [settings, setSettings] = useState<PublicSettings>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /** naik setiap ada perubahan lokal */
  const versionRef = useRef(0);
  /** Always-latest settings, untuk rollback yang aman */
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const load = useCallback(async () => {
    const version = versionRef.current;
    try {
      const res = await fetch(
        admin ? "/api/admin/settings" : "/api/public/settings"
      );
      if (!res.ok) throw new Error("Gagal memuat pengaturan");
      const data = await res.json();
      // Abaikan respons lama bila sudah ada perubahan lokal setelah request
      if (versionRef.current === version && data?.settings) {
        setSettings(data.settings);
      }
    } catch {
      /* biarkan nilai default */
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Ubah satu pengaturan: update optimistis lalu simpan ke server.
   * Bila gagal, nilai sebelumnya dikembalikan.
   */
  const update = useCallback(
    async (key: keyof PublicSettings, value: boolean) => {
      // Batalkan respons GET yang masih berjalan supaya tidak menimpa
      versionRef.current += 1;

      const previous = settingsRef.current;
      setSettings({ ...previous, [key]: value });
      setSavingKey(key);
      setError("");
      setSuccess("");

      try {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { [key]: value } }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Gagal menyimpan pengaturan");
        }

        const data = await res.json();
        if (data?.settings) setSettings(data.settings);
        setSuccess("Pengaturan berhasil disimpan");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setSettings(previous);
        setError(
          err instanceof Error ? err.message : "Gagal menyimpan pengaturan"
        );
      } finally {
        setSavingKey(null);
      }
    },
    []
  );

  return {
    settings,
    loading,
    savingKey,
    error,
    success,
    update,
    reload: load,
  };
}
