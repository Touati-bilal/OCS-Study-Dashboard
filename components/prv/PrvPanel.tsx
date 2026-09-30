"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled block used across the PRV sections, matching the app's glass card language. */
export function PrvPanel({
  title,
  subtitle,
  action,
  children,
  className,
  delay = 0,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn("glass rounded-2xl p-5 shadow-card", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || action) && (
        <header className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-ink/50">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** A single labelled figure. */
export function PrvStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "muted";
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    muted: "text-ink/45",
  }[tone];
  return (
    <div className="rounded-xl border border-ink/5 bg-ink/[0.02] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-ink/45">{hint}</p>}
    </div>
  );
}

/** Shown wherever a value is genuinely unknown, so the UI never renders a misleading 0 or 100 %. */
export function PrvEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-ink/15 bg-ink/[0.02] p-3 text-xs leading-relaxed text-ink/50">
      {children}
    </p>
  );
}

export function PrvNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "good";
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-teal-500/25 bg-teal-500/10 text-ink/80",
    warn: "border-amber-500/25 bg-amber-500/10 text-ink/80",
    good: "border-emerald-500/25 bg-emerald-500/10 text-ink/80",
  }[tone];
  return (
    <p className={cn("rounded-xl border p-3 text-xs leading-relaxed", toneClass)}>{children}</p>
  );
}
