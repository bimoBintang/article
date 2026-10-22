/**
 * Daftar template hero beranda.
 *
 * Berkas ini sengaja berisi data murni (tanpa import React atau database)
 * supaya aman dipakai di sisi klien, API, maupun server.
 *
 * Menambah template baru:
 *  1. tambahkan komponennya di components/home/hero-templates/
 *  2. tambahkan satu entri di HERO_TEMPLATES di bawah
 *  3. daftarkan komponennya di components/home/hero-templates/index.ts
 *     (TypeScript akan gagal bila langkah 3 terlewat).
 */
export const HERO_TEMPLATES = [
  {
    id: "orbit-3d",
    name: "Orbit 3D",
    description:
      "Foto mengorbit pada bidang miring dengan perspektif seperti planet. Piring tengah berputar pelan.",
  },
  {
    id: "orbit-flat",
    name: "Orbit datar",
    description:
      "Foto mengitari piring tengah pada lingkaran datar yang berputar, dan foto selalu tegak.",
  },
  {
    id: "editorial-grid",
    name: "Grid editorial",
    description:
      "Susunan foto statis dua kolom seperti halaman majalah, tanpa gerakan. Pilihan paling tenang.",
  },
  {
    id: "editorial-grid-3d",
    name: "Grid editorial 3D",
    description:
      "Susunan dua kolom yang sama, tetapi tiap foto adalah kartu dua sisi yang berputar sendiri dan menampilkan produk lain di baliknya.",
  },
  {
    id: "column-360",
    name: "Kolom 360°",
    description:
      "Kolom segi-enam berisi foto produk yang berputar di atas piring, dengan keterangan mono bernomor di tiap sisi.",
  },
] as const;

export type HeroTemplateId = (typeof HERO_TEMPLATES)[number]["id"];

/** Template yang dipakai sebelum admin memilih apa pun. */
export const DEFAULT_HERO_TEMPLATE: HeroTemplateId = "orbit-3d";

export const HERO_TEMPLATE_IDS = HERO_TEMPLATES.map((t) => t.id) as [
  HeroTemplateId,
  ...HeroTemplateId[],
];

export function isHeroTemplateId(value: unknown): value is HeroTemplateId {
  return (
    typeof value === "string" &&
    (HERO_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}
