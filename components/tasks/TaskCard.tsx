"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { PriorityIndicator } from "./PriorityIndicator";
import { StatusControl, StatusLabel } from "./StatusControl";
import { useAppStore } from "@/store/useAppStore";
import {
  TASK_PRIORITY_META,
  formatCompletedAt,
  formatDeadline,
  getTaskContext,
  isTaskOverdue,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { CalendarClock, CheckCheck, ExternalLink, Link2, NotebookPen, Pencil, StickyNote, Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";

export function TaskCard({
  task,
  showModule = true,
  onEdit,
}: {
  task: Task;
  showModule?: boolean;
  onEdit: (task: Task) => void;
}) {
  const setTaskStatus = useAppStore((s) => s.setTaskStatus);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const context = showModule ? getTaskContext(task) : null;
  const isCompleted = task.status === "completed";
  const overdue = isTaskOverdue(task);
  const deadline = formatDeadline(task);
  const completedAt = formatCompletedAt(task);

  const hasDetails = !!(task.description || task.notes || task.source || task.links?.length);

  function cycleStatus() {
    const order = ["todo", "in_progress", "completed"] as const;
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    setTaskStatus(task.id, next);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="relative"
    >
      {/* The priority colour is a left rail, so it stays readable on small screens. */}
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ backgroundColor: TASK_PRIORITY_META[task.priority].color, opacity: 0.85 }}
      />
      <Card hover={false} className="p-3.5 pl-4">
        <div className="flex items-start gap-3">
          <StatusControl status={task.status} onCycle={cycleStatus} className="mt-0.5" />

          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-medium leading-snug", isCompleted ? "text-ink/40 line-through" : "text-ink/90")}>
              {task.title}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {context && (
                <Link
                  href={context.href}
                  className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-ink/50 hover:text-brand-400"
                  title={context.moduleName}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: context.moduleColor }}
                  />
                  <span className="truncate">{context.moduleCode}</span>
                  {context.chapterTitle && (
                    <span className="hidden truncate text-ink/35 sm:inline">· {context.chapterTitle}</span>
                  )}
                </Link>
              )}
              <PriorityIndicator priority={task.priority} size="sm" />
              <StatusLabel status={task.status} />
            </div>

            {deadline && !isCompleted && (
              <p
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1 text-[10px]",
                  overdue ? "text-rose-400" : "text-ink/40"
                )}
              >
                <CalendarClock size={11} /> {overdue ? "En retard — " : "Échéance : "}
                {deadline}
              </p>
            )}

            {isCompleted && completedAt && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                <CheckCheck size={11} /> Terminé le {completedAt}
              </p>
            )}

            {hasDetails && (
              <button
                onClick={() => setDetailsOpen((v) => !v)}
                className="mt-1.5 text-[10px] font-medium text-ink/35 hover:text-ink/60"
              >
                {detailsOpen ? "Masquer le détail" : "Voir le détail"}
              </button>
            )}

            {detailsOpen && hasDetails && (
              <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-ink/8 bg-ink/[0.03] p-2.5">
                {task.description && (
                  <p className="text-[11px] leading-relaxed text-ink/60">{task.description}</p>
                )}
                {task.notes && (
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink/60">
                    <StickyNote size={12} className="mt-px shrink-0 text-ink/30" />
                    {task.notes}
                  </p>
                )}
                {task.source && (
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink/50">
                    <NotebookPen size={12} className="mt-px shrink-0 text-ink/30" />
                    <span>
                      <span className="text-ink/35">Source : </span>
                      {task.source}
                    </span>
                  </p>
                )}
                {task.links && task.links.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {task.links.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 truncate text-[11px] text-brand-400 hover:text-brand-300"
                      >
                        <Link2 size={12} className="shrink-0" />
                        <span className="truncate">{link}</span>
                        <ExternalLink size={10} className="shrink-0 opacity-60" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              onClick={() => onEdit(task)}
              title="Modifier"
              className="text-ink/30 hover:text-ink/70"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => deleteTask(task.id)}
              title="Supprimer"
              className="text-ink/30 hover:text-rose-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
