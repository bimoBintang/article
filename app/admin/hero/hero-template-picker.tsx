"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { HeroVisual, type HomeProduct } from "@/components/home/hero-visual";
import { HERO_TEMPLATES, type HeroTemplateId } from "@/lib/hero-templates";

export function HeroTemplatePicker({
  current,
  products,
}: {
  current: HeroTemplateId;
  products: HomeProduct[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<HeroTemplateId>(current);
  const [savingId, setSavingId] = useState<HeroTemplateId | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function select(id: HeroTemplateId) {
    setError("");
    setNotice("");
    setSavingId(id);

    try {
      const res = await fetch("/api/admin/hero-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan template");
      }

      setActive(id);
      setNotice(HERO_TEMPLATES.find((t) => t.id === id)?.name ?? id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan template");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" title="Gagal">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" title="Template diganti">
          Beranda sekarang memakai &ldquo;{notice}&rdquo;.{" "}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Lihat beranda
          </a>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {HERO_TEMPLATES.map((template) => {
          const isActive = template.id === active;
          const isSaving = savingId === template.id;

          return (
            <article
              key={template.id}
              aria-current={isActive || undefined}
              className={`flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${
                isActive
                  ? "border-primary ring-1 ring-primary"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {/*
                Panggung terang: token warna situs publik (ink, paper) tidak
                dibalik di tema gelap admin. `inert` membuat pratinjau tidak
                bisa diklik atau difokus, jadi tidak menavigasi keluar admin.
              */}
              <div
                inert
                className="theme-public flex flex-1 items-center justify-center bg-paper p-5 sm:p-6"
              >
                <div className="w-full max-w-sm">
                  <HeroVisual
                    products={products}
                    template={template.id}
                    priority={false}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-foreground">
                    {template.name}
                  </h2>
                  {isActive && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {template.description}
                </p>
                <button
                  onClick={() => select(template.id)}
                  disabled={isActive || savingId !== null}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isActive
                    ? "Sedang dipakai"
                    : isSaving
                      ? "Menyimpan..."
                      : "Pakai template ini"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
