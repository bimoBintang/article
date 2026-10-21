"use client";

import * as React from "react";
import {
  Info,
  CircleCheck,
  TriangleAlert,
  CircleX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Alert / callout.
 *
 * Gaya: permukaan berwarna lembut dengan ikon Lucide di dalam chip
 * berwarna (bukan emoji), border tipis, dan tipografi yang rapat.
 */

const variants = {
  info: {
    box: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    title: "text-blue-900 dark:text-blue-100",
    body: "text-blue-800/90 dark:text-blue-200/80",
    Icon: Info,
  },
  success: {
    box: "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-900",
    chip:
      "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
    title: "text-green-900 dark:text-green-100",
    body: "text-green-800/90 dark:text-green-200/80",
    Icon: CircleCheck,
  },
  warning: {
    box: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
    chip:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    title: "text-amber-900 dark:text-amber-100",
    body: "text-amber-800/90 dark:text-amber-200/80",
    Icon: TriangleAlert,
  },
  error: {
    box: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900",
    chip: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    title: "text-red-900 dark:text-red-100",
    body: "text-red-800/90 dark:text-red-200/80",
    Icon: CircleX,
  },
} as const;

export type AlertVariant = keyof typeof variants;

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  /** Tombol aksi di sisi kanan (mis. "Coba lagi"). */
  action?: React.ReactNode;
  /** Jika diisi, tombol tutup muncul. */
  onDismiss?: () => void;
}

export function Alert({
  variant = "info",
  title,
  children,
  className,
  action,
  onDismiss,
  ...props
}: AlertProps) {
  const v = variants[variant] ?? variants.info;
  const { Icon } = v;

  // error/warning asserts, info/success politely announces
  const role = variant === "error" || variant === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5",
        v.box,
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          v.chip
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {title && (
          <p className={cn("text-sm font-semibold leading-snug", v.title)}>
            {title}
          </p>
        )}
        {children && (
          <div
            className={cn(
              "text-sm leading-relaxed break-words",
              title && "mt-0.5",
              v.body
            )}
          >
            {children}
          </div>
        )}
      </div>

      {(action || onDismiss) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Tutup peringatan"
              className={cn(
                "rounded-md p-1 transition-colors",
                v.body,
                "hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
