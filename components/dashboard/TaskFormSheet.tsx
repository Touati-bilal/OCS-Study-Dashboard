"use client";

import { TaskFormSheet as SharedTaskFormSheet } from "@/components/tasks/TaskFormSheet";
import type { Task } from "@/lib/types";

/**
 * Backward-compatible adapter for the OCC / ORS day-based task list (`TodoSection`): it keeps
 * the same props and simply delegates to the shared task form.
 *
 * `important` is passed as the default priority because the old form pre-selected `medium`,
 * which migrated to `important` — so new tasks behave exactly as they did before.
 */
export function TaskFormSheet({
  open,
  onClose,
  editingTask,
  defaultModuleId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  editingTask?: Task | null;
  defaultModuleId?: string | null;
  defaultDate?: string;
}) {
  return (
    <SharedTaskFormSheet
      open={open}
      onClose={onClose}
      editingTask={editingTask}
      moduleId={defaultModuleId ?? undefined}
      defaultDeadline={defaultDate}
      defaultPriority="important"
    />
  );
}
