"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  ADMIN_THEME_EVENT,
  getAdminTheme,
  setAdminTheme,
  type AdminTheme,
} from "@/components/theme-mode";

/**
 * Tombol ganti tema terang/gelap untuk area admin. Tema awal baru dibaca
 * setelah mount karena bergantung pada localStorage dan setelan sistem.
 */
export function ThemeToggle({
  className = "",
  withLabel = false,
}: {
  className?: string;
  withLabel?: boolean;
}) {
  const [theme, setTheme] = useState<AdminTheme | null>(null);

  useEffect(() => {
    const sync = () => setTheme(getAdminTheme());
    sync();
    window.addEventListener(ADMIN_THEME_EVENT, sync);
    return () => window.removeEventListener(ADMIN_THEME_EVENT, sync);
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? "Ganti ke tema terang" : "Ganti ke tema gelap";

  return (
    <button
      type="button"
      onClick={() => setAdminTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      disabled={theme === null}
      className={className}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {withLabel && <span>{isDark ? "Tema terang" : "Tema gelap"}</span>}
    </button>
  );
}
