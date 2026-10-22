"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
 ChevronLeft,
 ChevronRight,
 Maximize2,
 Minimize2,
 X,
} from "lucide-react";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

export type GalleryImage = {
 id: string;
 image_url: string;
 alt_text: string | null;
};

export function ProductGallery({
 images,
 fallbackUrl,
 productName,
}: {
 images: GalleryImage[];
 fallbackUrl?: string | null;
 productName: string;
}) {
 // Gabungkan foto galeri dengan thumbnail utama (jika belum ada di galeri)
 const all: GalleryImage[] = [
 ...images,
 ...(fallbackUrl && !images.some((i) => i.image_url === fallbackUrl)
 ? [
 {
 id: "thumb",
 image_url: fallbackUrl,
 alt_text: productName,
 },
 ]
 : []),
 ];

 const [activeIndex, setActiveIndex] = useState(0);
 const [isFullscreen, setIsFullscreen] = useState(false);
 const active = all[activeIndex];

 const go = useCallback(
 (delta: number) => {
 setActiveIndex((prev) => (prev + delta + all.length) % all.length);
 },
 [all.length]
 );

 const close = useCallback(() => setIsFullscreen(false), []);

 // Kontrol keyboard + lock scroll body saat fullscreen aktif
 useEffect(() => {
 if (!isFullscreen) return;

 const onKeyDown = (e: KeyboardEvent) => {
 if (e.key === "Escape") {
 e.preventDefault();
 close();
 } else if (e.key === "ArrowLeft") {
 e.preventDefault();
 go(-1);
 } else if (e.key === "ArrowRight") {
 e.preventDefault();
 go(1);
 }
 };

 document.addEventListener("keydown", onKeyDown);
 const originalOverflow = document.body.style.overflow;
 document.body.style.overflow = "hidden";

 return () => {
 document.removeEventListener("keydown", onKeyDown);
 document.body.style.overflow = originalOverflow;
 };
 }, [isFullscreen, go, close]);

 if (all.length === 0) {
 return (
 <div className="h-[500px] overflow-hidden rounded-xl">
 <ImagePlaceholder label={productName} />
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {/* Foto utama */}
 <div className="group relative h-[500px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
 <button
 onClick={() => setIsFullscreen(true)}
 aria-label="Lihat foto layar penuh"
 className="absolute inset-0 z-10 cursor-zoom-in"
 >
 <span className="sr-only">Perbesar foto</span>
 </button>

 <Image
 key={active.id}
 src={active.image_url}
 alt={active.alt_text || productName}
 fill
 priority
 quality={90}
 className="object-contain p-4"
 sizes="(max-width: 1024px) 100vw, 60vw"
 />

 {/* Tombol fullscreen */}
 <button
 onClick={() => setIsFullscreen(true)}
 aria-label="Lihat foto layar penuh"
 className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100"
 >
 <Maximize2 className="h-4 w-4" />
 </button>

 {all.length > 1 && (
 <>
 <button
 onClick={() => go(-1)}
 aria-label="Foto sebelumnya"
 className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100"
 >
 <ChevronLeft className="h-5 w-5" />
 </button>
 <button
 onClick={() => go(1)}
 aria-label="Foto berikutnya"
 className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100"
 >
 <ChevronRight className="h-5 w-5" />
 </button>

 <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
 {activeIndex + 1} / {all.length}
 </div>
 </>
 )}
 </div>

 {/* Strip thumbnail */}
 {all.length > 1 && (
 <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-8">
 {all.map((img, i) => (
 <button
 key={img.id}
 onClick={() => setActiveIndex(i)}
 aria-label={`Lihat foto ${i + 1}`}
 aria-current={i === activeIndex}
 className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
 i === activeIndex
 ? "border-primary"
 : "border-zinc-200 hover:border-zinc-400 "
 }`}
 >
 <Image
 src={img.image_url}
 alt={img.alt_text || `${productName} ${i + 1}`}
 fill
 className="object-cover"
 sizes="100px"
 />
 </button>
 ))}
 </div>
 )}

 {/* Lightbox fullscreen */}
 {isFullscreen && (
 <div
 role="dialog"
 aria-modal="true"
 aria-label={`Foto ${activeIndex + 1} dari ${all.length}`}
 className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
 >
 {/* Header */}
 <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
 <span className="text-sm font-medium">
 {activeIndex + 1} / {all.length}
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setIsFullscreen(false)}
 aria-label="Kembali ke tampilan normal"
 className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
 >
 <Minimize2 className="h-4 w-4" />
 </button>
 <button
 onClick={close}
 aria-label="Tutup tampilan penuh"
 className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
 >
 <X className="h-5 w-5" />
 </button>
 </div>
 </div>

 {/* Foto besar */}
 <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
 <Image
 key={active.id}
 src={active.image_url}
 alt={active.alt_text || productName}
 fill
 priority
 quality={90}
 className="object-contain"
 sizes="100vw"
 />

 {all.length > 1 && (
 <>
 <button
 onClick={() => go(-1)}
 aria-label="Foto sebelumnya"
 className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
 >
 <ChevronLeft className="h-6 w-6" />
 </button>
 <button
 onClick={() => go(1)}
 aria-label="Foto berikutnya"
 className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
 >
 <ChevronRight className="h-6 w-6" />
 </button>
 </>
 )}
 </div>

 {/* Strip thumbnail */}
 {all.length > 1 && (
 <div className="shrink-0 overflow-x-auto px-4 pb-4">
 <div className="mx-auto flex max-w-3xl gap-2">
 {all.map((img, i) => (
 <button
 key={img.id}
 onClick={() => setActiveIndex(i)}
 aria-label={`Foto ${i + 1}`}
 aria-current={i === activeIndex}
 className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
 i === activeIndex
 ? "border-white"
 : "border-white/20 opacity-60 hover:opacity-100"
 }`}
 >
 <Image
 src={img.image_url}
 alt={img.alt_text || `${productName} ${i + 1}`}
 fill
 className="object-cover"
 sizes="56px"
 />
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
