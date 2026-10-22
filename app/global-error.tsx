"use client";

/** Cadangan terakhir bila root layout sendiri gagal: harus memuat <html> dan <body> sendiri. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f5", color: "#0a0a0a" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px" }}>
          <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: 0 }}>Terjadi kesalahan.</h1>
          <p style={{ color: "#666", lineHeight: 1.6 }}>Situs sedang bermasalah. Coba muat ulang beberapa saat lagi.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#0a0a0a", color: "#f5f5f5", border: 0, padding: "14px 28px", fontSize: 14, cursor: "pointer" }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
