"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TaskCard } from "./TaskCard";
import { TaskFormSheet } from "./TaskFormSheet";
import { useAppStore } from "@/store/useAppStore";
import { getModulesForOption } from "@/lib/modules";
import { getCompletedTasks, getOpenTasks } from "@/lib/tasks";
import { ChevronDown, ListTodo, Plus, Sparkles } from "lucide-react";
import type { Task } from "@/lib/types";

/**
 * Incomplete-tasks-first board.
 *
 * - On the first page it lists every unfinished task of the study option, so nothing hides
 *   behind a module that would have to be opened.
 * - Inside a module (`moduleId`) it shows that module's tasks; the module is then implicit
 *   and the task form attaches to it automatically.
 *
 * A finished task leaves the active list but is never deleted: its completion date stays
 * available in the collapsible history below.
 */
export function TaskBoard({
  moduleId,
  title = "Tâches à faire",
  emptyLabel = "Aucune tâche en attente.",
  showModuleBadge = true,
  padded = true,
  restrictToStudyOption = false,
}: {
  moduleId?: string;
  title?: string;
  emptyLabel?: string;
  showModuleBadge?: boolean;
  padded?: boolean;
  /** On the first page: only show tasks of the modules of the active study option. */
  restrictToStudyOption?: boolean;
}) {
  const allTasks = useAppStore((s) => s.tasks);
  const studyOption = useAppStore((s) => s.studyOption);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const tasks = useMemo(() => {
    if (!restrictToStudyOption) return allTasks;
    const allowed = new Set(getModulesForOption(studyOption).map((m) => m.id));
    // A missing module is a null moduleId; an empty string is tolerated so tasks stored before the
    // form normalised it are not silently dropped from the list.
    return allTasks.filter((t) => !t.moduleId || allowed.has(t.moduleId));
  }, [allTasks, restrictToStudyOption, studyOption]);

  const openTasks = useMemo(() => getOpenTasks(tasks, moduleId), [tasks, moduleId]);
  const completedTasks = useMemo(() => getCompletedTasks(tasks, moduleId), [tasks, moduleId]);

  function openNew() {
    setEditingTask(null);
    setSheetOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setSheetOpen(true);
  }

  return (
    <div className={padded ? "px-5 pb-6 md:px-8 lg:px-0" : ""}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink/85">
          <ListTodo size={16} className="text-brand-400" /> {title}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full bg-brand-400/15 px-2 py-0.5 text-[11px] font-semibold text-brand-400"
            aria-label={`${openTasks.length} tâche(s) non terminée(s)`}
          >
            {openTasks.length}
          </span>
          <Button size="sm" variant="secondary" onClick={openNew}>
            <Plus size={14} /> Ajouter
          </Button>
        </div>
      </div>

      {openTasks.length === 0 ? (
        <Card hover={false} className="flex flex-col items-center gap-1.5 p-6 text-center">
          <Sparkles size={20} className="text-emerald-400/70" />
          <p className="text-sm text-ink/50">{emptyLabel}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {openTasks.map((task) => (
              <TaskCard key={task.id} task={task} showModule={showModuleBadge} onEdit={openEdit} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1.5 text-xs font-medium text-ink/40 hover:text-ink/65"
          >
            <span>Terminées ({completedTasks.length})</span>
            <ChevronDown size={14} className={historyOpen ? "rotate-180" : ""} />
          </button>
          {historyOpen && (
            <div className="mt-2 flex flex-col gap-2 opacity-80">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} showModule={showModuleBadge} onEdit={openEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      <TaskFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editingTask={editingTask}
        moduleId={moduleId}
      />
    </div>
  );
}
