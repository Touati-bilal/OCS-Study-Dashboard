"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TaskFormSheet } from "./TaskFormSheet";
import { useAppStore } from "@/store/useAppStore";
import { getModuleById } from "@/lib/modules";
import { cn, daysUntil, formatDateShort } from "@/lib/utils";
import { Plus, Pencil, Trash2, CheckSquare, Square, ListTodo } from "lucide-react";
import type { Task } from "@/lib/types";

export function TodoSection({
  filterModuleId,
  title = "Mes tâches",
  compact = false,
}: {
  filterModuleId?: string;
  title?: string;
  compact?: boolean;
}) {
  const tasks = useAppStore((s) => s.tasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const deleteTask = useAppStore((s) => s.deleteTask);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const scoped = useMemo(
    () => (filterModuleId ? tasks.filter((t) => t.moduleId === filterModuleId) : tasks),
    [tasks, filterModuleId]
  );

  const pending = scoped
    .filter((t) => !t.completed)
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  const completed = scoped.filter((t) => t.completed);

  function openEdit(task: Task) {
    setEditingTask(task);
    setSheetOpen(true);
  }

  function openNew() {
    setEditingTask(null);
    setSheetOpen(true);
  }

  return (
    <div className={compact ? "" : "px-5 pb-6"}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-white/85">
          <ListTodo size={16} className="text-brand-400" /> {title}
        </h2>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      {pending.length === 0 && completed.length === 0 && (
        <Card className="p-6 text-center text-sm text-white/45">Aucune tâche pour le moment.</Card>
      )}

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id)}
              onEdit={() => openEdit(task)}
              onDelete={() => deleteTask(task.id)}
              showModuleBadge={!filterModuleId}
            />
          ))}
        </AnimatePresence>
      </div>

      {completed.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="text-xs font-medium text-white/40 hover:text-white/60"
          >
            {showCompleted ? "Masquer" : "Afficher"} les tâches terminées ({completed.length})
          </button>
          {showCompleted && (
            <div className="mt-2 flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task.id)}
                    onEdit={() => openEdit(task)}
                    onDelete={() => deleteTask(task.id)}
                    showModuleBadge={!filterModuleId}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      <TaskFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editingTask={editingTask}
        defaultModuleId={filterModuleId}
      />
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  showModuleBadge,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showModuleBadge: boolean;
}) {
  const mod = task.moduleId ? getModuleById(task.moduleId) : undefined;
  const dUntil = task.deadline ? daysUntil(task.deadline) : null;
  const overdue = !task.completed && dUntil !== null && dUntil < 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card hover={false} className="flex items-start gap-3 p-3.5">
        <button onClick={onToggle} className="mt-0.5 shrink-0 text-brand-400">
          {task.completed ? <CheckSquare size={19} /> : <Square size={19} className="text-white/30" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", task.completed ? "text-white/35 line-through" : "text-white/90")}>
            {task.title}
          </p>
          {task.description && <p className="mt-0.5 text-xs text-white/40">{task.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {showModuleBadge && mod && (
              <Badge color={mod.color} className="text-[10px]">
                {mod.code}
              </Badge>
            )}
            {task.deadline && (
              <Badge
                color={overdue ? "#fb7185" : "#94a3b8"}
                variant="outline"
                className="text-[10px]"
              >
                {overdue ? "En retard · " : ""}
                {formatDateShort(task.deadline)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={onEdit} className="text-white/35 hover:text-white/70">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="text-white/35 hover:text-rose-400">
            <Trash2 size={14} />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
