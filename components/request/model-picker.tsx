"use client";

import {
  MODEL_GENDERS,
  MODEL_NOTES_MAX,
  type ModelGender,
} from "@/lib/model-gender";

export type ModelSelection = { gender: ModelGender | null; notes: string };

export const EMPTY_MODEL_SELECTION: ModelSelection = { gender: null, notes: "" };

/**
 * Pilihan jenis model (opsional, klik ulang membatalkan) + catatan untuk model.
 * Dipakai halaman produk dan form Customize.
 */
export function ModelPicker({
  value,
  onChange,
}: {
  value: ModelSelection;
  onChange: (next: ModelSelection) => void;
}) {
  return (
    <div className="space-y-3">
      <label id="model-label" className="mb-2 block text-sm font-semibold text-zinc-700">
        Jenis Model
      </label>
      <div
        role="group"
        aria-labelledby="model-label"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {MODEL_GENDERS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() =>
              onChange({ ...value, gender: value.gender === g.value ? null : g.value })
            }
            aria-pressed={value.gender === g.value}
            className={`rounded-lg border px-3 py-2.5 text-sm transition-all ${
              value.gender === g.value
                ? "border-primary bg-primary/5 font-medium text-primary"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div>
        <label
          htmlFor="model-notes"
          className="mb-1 block text-xs font-medium text-zinc-600"
        >
          Catatan untuk model (opsional)
        </label>
        <textarea
          id="model-notes"
          value={value.notes}
          onChange={(e) =>
            onChange({ ...value, notes: e.target.value.slice(0, MODEL_NOTES_MAX) })
          }
          maxLength={MODEL_NOTES_MAX}
          rows={3}
          placeholder="Contoh: tinggi sekitar 170 cm, gaya kasual, berhijab"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-right text-xs text-zinc-400">
          {value.notes.length}/{MODEL_NOTES_MAX}
        </p>
      </div>
    </div>
  );
}
