"use client";

import { cn } from "@/lib/utils";
import { TASK_STATUS_META } from "@/lib/tasks";
import type { TaskStatus } from "@/lib/types";
import { CheckSquare, CircleDot, Square } from "lucide-react";

const STATUS_ICON: Record<TaskStatus, React.ElementType> = {
  todo: Square,
  in_progress: CircleDot,
  completed: CheckSquare,
};

/**
 * Modern todo-style status control: ○ À faire / ◐ En cours / ✓ Terminé.
 * Clicking cycles to the next status, which is what marks a task as done.
 */
export function StatusControl({
  status,
  onCycle,
  size = 18,
  className,
}: {
  status: TaskStatus;
  onCycle: () => void;
  size?: number;
  className?: string;
}) {
  const meta = TASK_STATUS_META[status];
  const Icon = STATUS_ICON[status];

  return (
    <button
      onClick={onCycle}
      title={meta.label}
      aria-label={`Statut : ${meta.label} — cliquer pour changer`}
      className={cn("shrink-0 transition-transform active:scale-90", className)}
    >
      <Icon size={size} style={{ color: meta.color }} />
    </button>
  );
}

export function StatusLabel({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-medium"
      style={{ color: meta.color }}
    >
      <span aria-hidden>{meta.symbol}</span>
      {meta.label}
    </span>
  );
}
