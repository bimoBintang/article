import type { RequestStatus } from "@/types";

/** Urutan status permintaan; dipakai API, filter, dan form ubah status. */
export const REQUEST_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "NEGOTIATION",
  "AGREED",
  "INVOICED",
  "PAID",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly RequestStatus[];

/** Kelas warna badge status di panel admin. */
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  NEGOTIATION: "bg-orange-50 text-orange-700 border-orange-200",
  AGREED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  INVOICED: "bg-purple-50 text-purple-700 border-purple-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  SCHEDULED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-gray-50 text-gray-700 border-gray-200",
};
