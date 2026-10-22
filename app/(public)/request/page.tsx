"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { z } from "zod";
import type { Package } from "@/types";
import type { PublicSettings } from "@/lib/settings";
import {
 EMPTY_MODEL_SELECTION,
 ModelPicker,
 type ModelSelection,
} from "@/components/request/model-picker";
import {
 EMPTY_PACKAGE_SELECTION,
 PackagePicker,
 resolvePackageSelection,
 type PackageSelection,
} from "@/components/request/package-picker";
import {
 ReferencePicker,
 type RefImage,
} from "@/components/request/reference-picker";

// CSP melarang eval: matikan kompilasi JIT zod supaya browser tidak mencatat pelanggaran dari pengecekan `new Function`
z.config({ jitless: true });

const requestSchema = z.object({
 name: z.string().min(2, "Nama minimal 2 karakter"),
 email: z.string().email("Format email tidak valid"),
 whatsapp: z
 .string()
 .min(10, "Nomor WhatsApp minimal 10 digit")
 .refine(
 (val) => /^(\+62|62|0)[0-9]{9,13}$/.test(val.replace(/\s/g, "")),
 "Format nomor WhatsApp Indonesia tidak valid"
 ),
 brandName: z.string().optional(),
 preferredDate: z.string().optional(),
 notes: z.string().optional(),
 consent: z.boolean().refine((val) => val === true, {
 message: "Anda harus menyetujui pengolahan data pribadi",
 }),
});

export default function RequestPage() {
 const [formData, setFormData] = useState<{
 name: string;
 email: string;
 whatsapp: string;
 brandName: string;
 preferredDate: string;
 notes: string;
 consent: boolean;
 }>({
 name: "",
 email: "",
 whatsapp: "",
 brandName: "",
 preferredDate: "",
 notes: "",
 consent: false,
 });
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [submitting, setSubmitting] = useState(false);
 const [submitted, setSubmitted] = useState(false);
 const [requestNumber, setRequestNumber] = useState<string | null>(null);
 const [cart, setCart] = useState<any[]>([]);

 // Opsi "Customize": brief sendiri + referensi + paket + model
 const [mode, setMode] = useState<"template" | "custom">("template");
 const [customTitle, setCustomTitle] = useState("");
 const [customDesc, setCustomDesc] = useState("");
 const [refImages, setRefImages] = useState<RefImage[]>([]);
 const [refLinks, setRefLinks] = useState<string[]>([]);
 const [pkgSel, setPkgSel] = useState<PackageSelection>(EMPTY_PACKAGE_SELECTION);
 const [model, setModel] = useState<ModelSelection>(EMPTY_MODEL_SELECTION);
 const [packages, setPackages] = useState<Package[]>([]);
 const [pkgSettings, setPkgSettings] = useState<Pick<PublicSettings, "show_package_price">>({
 show_package_price: true,
 });

 useEffect(() => {
 fetch("/api/public/packages")
 .then((r) => (r.ok ? r.json() : null))
 .then((d) => d?.packages && setPackages(d.packages))
 .catch(() => {});
 fetch("/api/public/settings")
 .then((r) => (r.ok ? r.json() : null))
 .then((d) => d?.settings && setPkgSettings(d.settings))
 .catch(() => {});
 }, []);

 useEffect(() => {
 try {
 const saved = localStorage.getItem("ekatalog_cart");
 setCart(saved ? JSON.parse(saved) : []);
 } catch {
 setCart([]);
 }
 }, []);

 // Validasi bagian Customize; dipanggil juga saat data kontak belum valid agar semua
 // kesalahan tampil sekaligus.
 const collectCustomErrors = () => {
 const e: Record<string, string> = {};
 if (customTitle.trim().length < 2) e.title = "Nama produk atau koleksi minimal 2 karakter";
 if (customDesc.trim().length < 10) e.description = "Deskripsi kebutuhan minimal 10 karakter";
 if (refImages.some((i) => i.status === "uploading")) {
 e.references = "Tunggu hingga unggahan gambar selesai.";
 } else if (refImages.some((i) => i.status === "error")) {
 e.references = "Hapus gambar yang gagal diunggah terlebih dahulu.";
 } else if (refImages.length + refLinks.length === 0) {
 e.references = "Tambahkan minimal satu referensi: gambar atau tautan.";
 }
 const resolved = resolvePackageSelection(pkgSel);
 if (!resolved.ok) e.package = resolved.error;
 return { e, resolved };
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 setErrors({});

 // Validasi dengan safeParse: TIDAK melempar exception, sehingga
 // pesan error per-field bisa ditampilkan di bawah input.
 const parsed = requestSchema.safeParse(formData);

 if (!parsed.success) {
 const fieldErrors: Record<string, string> = {};
 for (const issue of parsed.error.issues) {
 const key = issue.path[0];
 if (key !== undefined && !fieldErrors[String(key)]) {
 fieldErrors[String(key)] = issue.message;
 }
 }
 if (mode === "custom") Object.assign(fieldErrors, collectCustomErrors().e);
 setErrors(fieldErrors);
 setSubmitting(false);
 focusFirstError();
 return;
 }

 const validated = parsed.data;

 let customBody: Record<string, unknown> | null = null;
 if (mode === "custom") {
 const { e, resolved } = collectCustomErrors();
 if (Object.keys(e).length > 0 || !resolved.ok) {
 setErrors((prev) => ({ ...prev, ...e }));
 setSubmitting(false);
 focusFirstError();
 return;
 }
 customBody = {
 title: customTitle.trim(),
 description: customDesc.trim(),
 images: refImages.map((i) => i.url),
 links: refLinks,
 packageId: resolved.packageId,
 customLookCount: resolved.customLookCount,
 customPhotoCount: resolved.customPhotoCount,
 modelGender: model.gender,
 modelNotes: model.notes.trim() || null,
 };
 }

 try {
 const cartItems = cart.map((item: any) => ({
 productId: item.productId ?? null,
 packageId: item.packageId ?? null,
 customLookCount: item.customLookCount ?? null,
 customPhotoCount: item.customPhotoCount ?? null,
 modelGender: item.modelGender ?? null,
 modelNotes: item.modelNotes ?? null,
 talentId: item.talentId ?? null,
 quantity: item.quantity ?? 1,
 }));

 // Kirim ke server: insert DB + kirim email dilakukan di server
 const res = await fetch("/api/public/requests", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 name: validated.name,
 email: validated.email,
 whatsapp: validated.whatsapp,
 brandName: validated.brandName || null,
 preferredDate: validated.preferredDate || null,
 notes: validated.notes || null,
 consent: validated.consent,
 ...(customBody ? { type: "CUSTOM", custom: customBody } : { items: cartItems }),
 }),
 });

 const result = await res.json().catch(() => ({}));

 if (!res.ok) {
 // Validasi server: tampilkan pesan pada field yang bermasalah
 if (res.status === 400 && result.field) {
 setErrors({ [String(result.field).replace(/^custom\./, "")]: result.error || "Input tidak valid" });
 focusFirstError();
 return;
 }
 throw new Error(result.error || "Gagal mengirim permintaan");
 }

 const requestNumber = result.requestNumber;

 // Clear cart
 localStorage.removeItem("ekatalog_cart");
 window.dispatchEvent(new Event("ekatalog:cart-change"));

 setSubmitted(true);
 setRequestNumber(requestNumber);
 } catch (err: any) {
 console.error("Submit error:", err);
 setErrors({
 _form: err?.message || "Terjadi kesalahan. Silakan coba lagi.",
 });
 } finally {
 setSubmitting(false);
 }
 };

 /** Fokuskan input pertama yang bermasalah agar user langsung melihat. */
 const focusFirstError = () => {
 requestAnimationFrame(() => {
 const el = document.querySelector<HTMLElement>(
 '[aria-invalid="true"], [data-field-error]'
 );
 el?.focus();
 el?.scrollIntoView({ behavior: "smooth", block: "center" });
 });
 };

 /** Hapus error sebuah field saat user mengeditnya. */
 const clearError = (field: string) => {
 setErrors((prev) => {
 if (!prev[field]) return prev;
 const next = { ...prev };
 delete next[field];
 return next;
 });
 };

 if (submitted) {
 return (
 <div className="min-h-screen">
 <div className="max-w-2xl mx-auto px-4 py-20">
 <div className="text-center">
 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <Check className="h-7 w-7 text-green-600" aria-hidden />
 </div>
 <h1 className="text-2xl font-bold text-foreground mb-4">Permintaan Terkirim</h1>
 <p className="text-zinc-600 mb-6">
 Terima kasih, {formData.name}. Permintaan pemotretan Anda telah kami terima.
 </p>
 <div className="bg-white p-6 rounded-xl border border-zinc-200 inline-block">
 <div className="text-zinc-500 text-sm">Nomor Permintaan</div>
 <div className="text-2xl font-mono font-bold text-primary mt-1">{requestNumber}</div>
 </div>
 <p className="text-zinc-500 text-sm mt-6">
 Email konfirmasi telah dikirim ke {formData.email}. Simpan nomor permintaan untuk
 melacak status Anda.
 </p>
 <Link
 href="/katalog"
 className="mt-8 inline-block px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
 >
 Kembali ke Katalog
 </Link>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen">
 <div className="max-w-2xl mx-auto px-4 py-8">
 <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
 <h1 className="text-xl font-bold text-foreground mb-6">Ajukan Permintaan Pemotretan</h1>
 <p className="text-zinc-600 text-sm mb-6">
 Isi form berikut untuk mengajukan permintaan pemotretan fashion. Kami akan
 mengirim konfirmasi ke email Anda.
 </p>

 <div
 role="tablist"
 aria-label="Jenis permintaan"
 className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1"
 >
 {(
 [
 ["template", "Sesuai template produk"],
 ["custom", "Customize"],
 ] as const
 ).map(([value, label]) => (
 <button
 key={value}
 type="button"
 role="tab"
 aria-selected={mode === value}
 onClick={() => {
 setMode(value);
 setErrors({});
 }}
 className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
 mode === value
 ? "bg-white text-foreground shadow-sm"
 : "text-zinc-500 hover:text-zinc-700"
 }`}
 >
 {label}
 </button>
 ))}
 </div>

 {mode === "template" && cart.length === 0 && (
 <p className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
 Keranjang Anda masih kosong.{" "}
 <Link href="/katalog" className="font-medium underline">
 Pilih produk di katalog
 </Link>{" "}
 terlebih dahulu, atau gunakan tab Customize untuk brief sendiri.
 </p>
 )}

 <form onSubmit={handleSubmit} className="space-y-5" noValidate>
 {mode === "custom" && (
 <div className="space-y-5 rounded-lg border border-zinc-200 p-4">
 <div>
 <label htmlFor="custom-title" className="block text-sm font-medium text-zinc-700 mb-1">
 Nama Produk / Koleksi
 </label>
 <input
 id="custom-title"
 type="text"
 value={customTitle}
 onChange={(e) => {
 setCustomTitle(e.target.value);
 clearError("title");
 }}
 aria-invalid={Boolean(errors.title)}
 maxLength={120}
 className={`w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none ${
 errors.title ? "border-red-500" : "border-zinc-300"
 }`}
 placeholder="Contoh: Koleksi kaos Lebaran 2027"
 />
 {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
 </div>

 <div>
 <label htmlFor="custom-desc" className="block text-sm font-medium text-zinc-700 mb-1">
 Deskripsi Kebutuhan
 </label>
 <textarea
 id="custom-desc"
 value={customDesc}
 onChange={(e) => {
 setCustomDesc(e.target.value);
 clearError("description");
 }}
 aria-invalid={Boolean(errors.description)}
 rows={5}
 maxLength={2000}
 className={`w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none ${
 errors.description ? "border-red-500" : "border-zinc-300"
 }`}
 placeholder="Jelaskan produk, konsep, suasana, lokasi, dan hasil yang Anda inginkan..."
 />
 {errors.description && (
 <p className="text-xs text-red-600 mt-1">{errors.description}</p>
 )}
 </div>

 <ReferencePicker
 images={refImages}
 setImages={(u) => {
 setRefImages(u);
 clearError("references");
 }}
 links={refLinks}
 setLinks={(u) => {
 setRefLinks(u);
 clearError("references");
 }}
 error={errors.references}
 />
 {errors.references && <span data-field-error className="sr-only" />}

 <PackagePicker
 packages={packages}
 settings={pkgSettings}
 value={pkgSel}
 onChange={(next) => {
 setPkgSel(next);
 clearError("package");
 }}
 />
 {errors.package && (
 <p data-field-error className="text-xs text-red-600">{errors.package}</p>
 )}

 <ModelPicker value={model} onChange={setModel} />
 </div>
 )}

 <div className="grid md:grid-cols-2 gap-5">
 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Nama Lengkap
 </label>
 <input
 type="text"
 name="name"
 value={formData.name}
 onChange={(e) => {
 setFormData({ ...formData, name: e.target.value });
 clearError("name");
 }}
 aria-invalid={Boolean(errors.name)}
 aria-describedby={errors.name ? "err-name" : undefined}
 className={`w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none ${
 errors.name ? "border-red-500" : "border-zinc-300"
 }`}
 placeholder="Masukkan nama lengkap"
 />
 {errors.name && (
 <p id="err-name" className="text-xs text-red-600 mt-1">
 {errors.name}
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Email
 </label>
 <input
 type="email"
 name="email"
 value={formData.email}
 onChange={(e) => {
 setFormData({ ...formData, email: e.target.value });
 clearError("email");
 }}
 aria-invalid={Boolean(errors.email)}
 aria-describedby={errors.email ? "err-email" : undefined}
 className={`w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none ${
 errors.email ? "border-red-500" : "border-zinc-300"
 }`}
 placeholder="contoh@email.com"
 />
 {errors.email && (
 <p id="err-email" className="text-xs text-red-600 mt-1">
 {errors.email}
 </p>
 )}
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Nomor WhatsApp
 </label>
 <input
 type="tel"
 name="whatsapp"
 value={formData.whatsapp}
 onChange={(e) => {
 setFormData({ ...formData, whatsapp: e.target.value });
 clearError("whatsapp");
 }}
 aria-invalid={Boolean(errors.whatsapp)}
 aria-describedby={errors.whatsapp ? "err-whatsapp" : undefined}
 className={`w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none ${
 errors.whatsapp ? "border-red-500" : "border-zinc-300"
 }`}
 placeholder="081234567890"
 />
 {errors.whatsapp && (
 <p id="err-whatsapp" className="text-xs text-red-600 mt-1">
 {errors.whatsapp}
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Nama Brand / Usaha
 </label>
 <input
 type="text"
 name="brandName"
 value={formData.brandName}
 onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
 className="w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none border-zinc-300"
 placeholder="Nama brand atau usaha Anda"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Tanggal yang Diinginkan
 </label>
 <input
 type="date"
 name="preferredDate"
 value={formData.preferredDate}
 onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
 className="w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none border-zinc-300"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-zinc-700 mb-1">
 Catatan Tambahan
 </label>
 <textarea
 name="notes"
 value={formData.notes}
 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
 rows={3}
 className="w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 focus:ring-2 focus:ring-primary focus:outline-none border-zinc-300"
 placeholder="Catatan khusus untuk pemotretan..."
 />
 </div>

 <div>
 <div className="flex items-start gap-2">
 <input
 id="consent"
 type="checkbox"
 name="consent"
 checked={formData.consent}
 onChange={(e) => {
 setFormData({ ...formData, consent: e.target.checked });
 clearError("consent");
 }}
 aria-invalid={Boolean(errors.consent)}
 aria-describedby={errors.consent ? "err-consent" : undefined}
 className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-primary focus:ring-primary"
 />
 <label
 htmlFor="consent"
 className="text-sm leading-relaxed text-zinc-600"
 >
 Saya menyetujui pengolahan data pribadi sesuai kebijakan privasi
 Article. Nama, email, WhatsApp, dan catatan Anda disimpan terenkripsi.
 </label>
 </div>
 {errors.consent && (
 <p id="err-consent" className="ml-6 mt-1 text-xs text-red-600">
 {errors.consent}
 </p>
 )}
 </div>

 {errors._form && (
 <p
 role="alert"
 className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
 >
 {errors._form}
 </p>
 )}

 <div className="pt-4">
 <button
 type="submit"
 disabled={submitting || refImages.some((i) => i.status === "uploading")}
 className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-70 transition-colors flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Mengirim...
 </>
 ) : (
 "Ajukan Permintaan"
 )}
 </button>
 </div>

 <div className="mt-6 text-xs text-zinc-500 text-center border-t border-zinc-100 pt-4">
 {mode === "template"
 ? `Keranjang Anda saat ini berisi ${cart.length} item. Harga bersifat estimasi hingga disepakati dengan admin.`
 : "Harga bersifat estimasi hingga disepakati dengan admin."}
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}
