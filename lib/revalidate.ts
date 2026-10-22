import { revalidatePath } from "next/cache";

/**
 * Halaman publik (beranda, katalog, detail produk) di-cache 60 detik (ISR).
 * Panggil ini setelah admin mengubah konten yang tampil di sana (produk, paket,
 * model, testimoni, pengaturan harga, template hero) supaya perubahan langsung terlihat.
 */
export function revalidatePublic() {
  revalidatePath("/", "layout");
}
