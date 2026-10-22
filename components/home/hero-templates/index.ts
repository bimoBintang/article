import type { ComponentType } from "react";
import type { HeroTemplateId } from "@/lib/hero-templates";
import { HeroColumn360 } from "./column-360";
import { HeroEditorialGrid } from "./editorial-grid";
import { HeroEditorialGrid3D } from "./editorial-grid-3d";
import { HeroOrbit3D } from "./orbit-3d";
import { HeroOrbitFlat } from "./orbit-flat";
import type { HeroTemplateProps } from "./types";

/**
 * Peta id template -> komponen. Bertipe Record<HeroTemplateId, ...> sehingga
 * template yang ditambahkan di lib/hero-templates.ts tetapi belum
 * didaftarkan di sini akan gagal di tsc.
 */
export const HERO_TEMPLATE_COMPONENTS: Record<
  HeroTemplateId,
  ComponentType<HeroTemplateProps>
> = {
  "orbit-3d": HeroOrbit3D,
  "orbit-flat": HeroOrbitFlat,
  "editorial-grid": HeroEditorialGrid,
  "editorial-grid-3d": HeroEditorialGrid3D,
  "column-360": HeroColumn360,
};
