import type { Metadata } from "next";
import Script from "next/script";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { buildMetadata, SITE_VERIFICATION } from "@/lib/seo";
import { themeScript, ThemeModeWatcher } from "@/components/theme-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Grotesk tebal untuk judul halaman publik; karakternya dekat dengan
// wordmark brand (huruf tegas dan rapat)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = buildMetadata({
  verification: {
    google: SITE_VERIFICATION.google || undefined,
    yandex: SITE_VERIFICATION.bing || undefined,
  },
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <head>
        {/* Terapkan tema sebelum paint: gelap hanya di area admin */}
        <Script id="theme-mode" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeModeWatcher />
        {children}
      </body>
    </html>
  );
}
