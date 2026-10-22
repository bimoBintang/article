"use client";

import { useEffect, useState } from "react";

/**
 * Nilai yang baru ikut berubah setelah `value` berhenti berubah selama `delay` ms.
 * Dipakai untuk kolom pencarian agar filter/API tidak dipanggil di setiap huruf.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
