"use client";

import { cn } from "@/lib/utils";
import { TASK_PRIORITY_META } from "@/lib/tasks";
import type { TaskPriority } from "@/lib/types";

/**
 * Priority indicator: a coloured dot plus a label. The colour always comes from the shared
 * priority palette, never from the status, so the two can be read independently.
 */
export function PriorityIndicator({
  priority,
  size = "md",
  showLabel = true,
}: {
  priority: TaskPriority;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const meta = TASK_PRIORITY_META[priority];
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
      style={{ borderColor: meta.color + "55", color: meta.color }}
      title={`Priorité : ${meta.label} — ${meta.description}`}
    >
      <span className={cn("shrink-0 rounded-full", dot)} style={{ backgroundColor: meta.color }} />
      {showLabel && <span className="whitespace-nowrap">{meta.label}</span>}
    </span>
  );
}
