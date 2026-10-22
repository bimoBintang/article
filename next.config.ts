import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** Origin (skema + host) dari sebuah URL; null bila kosong atau tidak valid. */
function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const unique = (items: Array<string | null>) => [...new Set(items.filter((i): i is string => Boolean(i)))];

// Object storage (gambar produk, model 3D, unggahan presigned) dan gambar QR dari Midtrans
const storageOrigins = unique([
  "https://*.neon.tech",
  originOf(process.env.OBJECT_STORAGE_ENDPOINT),
  originOf(process.env.OBJECT_STORAGE_PUBLIC_URL),
]);
const midtransOrigins = unique([
  "https://api.midtrans.com",
  "https://api.sandbox.midtrans.com",
  "https://simulator.sandbox.midtrans.com",
  originOf(process.env.MIDTRANS_API_BASE),
]);

/**
 * Content-Security-Policy dasar tanpa nonce (nonce butuh render dinamis dan akan
 * mematikan ISR). Skrip inline masih diizinkan (tema admin, JSON-LD, Next), tetapi
 * skrip dan sumber dari domain lain diblokir, plugin dimatikan, dan penyematan
 * dibatasi. Isi CSP_REPORT_ONLY=true untuk hanya melaporkan pelanggaran di konsol
 * browser tanpa memblokir (jalan keluar bila ada fitur yang terblokir di production).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${["'self'", "data:", "blob:", ...storageOrigins, ...midtransOrigins].join(" ")}`,
  "font-src 'self' data:",
  `connect-src ${["'self'", "blob:", "data:", ...storageOrigins].join(" ")}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** Header keamanan untuk semua halaman. */
const securityHeaders = [
  {
    key: process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    value: csp,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Next 16 hanya mengizinkan kualitas dari daftar ini (bawaan [75]); tanpa ini semua gambar
    // dikompres ulang ke 75. 85 dan 90 dipakai untuk foto produk (lihat prop `quality`).
    qualities: [75, 85, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.neon.tech",
        pathname: "/uploads/**",
      },
    ],
  },
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
