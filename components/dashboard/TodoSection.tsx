"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TaskFormSheet } from "./TaskFormSheet";
import { useAppStore } from "@/store/useAppStore";
import { getModuleById } from "@/lib/modules";
import { cn, todayISO, addDays, toISODate, formatDateHuman } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Square,
  CheckSquare,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  ListTodo,
  MoveRight,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: "Basse", color: "#34d399" },
  medium: { label: "Moyenne", color: "#fbbf24" },
  high: { label: "Haute", color: "#fb7185" },
};

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "À faire", color: "#94a3b8" },
  in_progress: { label: "En cours", color: "#48a3ff" },
  completed: { label: "Terminé", color: "#34d399" },
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "completed"];

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
  const deleteTask = useAppStore((s) => s.deleteTask);
  const setTaskStatus = useAppStore((s) => s.setTaskStatus);
  const moveTask = useAppStore((s) => s.moveTask);

  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.deadline === selectedDate)
        .filter((t) => (filterModuleId ? t.moduleId === filterModuleId : true))
        .sort((a, b) => {
          const order: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
          if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [tasks, selectedDate, filterModuleId]
  );

  const isToday = selectedDate === todayISO();

  function openEdit(task: Task) {
    setEditingTask(task);
    setSheetOpen(true);
  }

  function openNew() {
    setEditingTask(null);
    setSheetOpen(true);
  }

  function shiftDay(delta: number) {
    setSelectedDate((d) => toISODate(addDays(new Date(d + "T00:00:00"), delta)));
  }

  return (
    <div className={compact ? "" : "px-5 pb-6 md:px-8 lg:px-0"}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink/85">
          <ListTodo size={16} className="text-brand-400" /> {title}
        </h2>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      <div className="mb-1.5 flex items-center gap-2">
        <button
          onClick={() => shiftDay(-1)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink/50 hover:bg-ink/10 hover:text-ink"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 overflow-hidden">
          <CalendarClock size={13} className="shrink-0 text-ink/40" />
          <span className="truncate text-xs font-medium capitalize text-ink/70">
            {isToday ? "Aujourd'hui" : formatDateHuman(selectedDate)}
          </span>
        </div>
        <button
          onClick={() => shiftDay(1)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink/50 hover:bg-ink/10 hover:text-ink"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="mb-3 flex items-center justify-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="rounded-lg border border-ink/10 bg-ink/[0.04] px-2 py-1 text-[11px] text-ink/70 outline-none focus:border-brand-500/60"
        />
        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayISO())}
            className="text-[11px] font-medium text-brand-400 hover:text-brand-300"
          >
            Aujourd&apos;hui
          </button>
        )}
      </div>

      {dayTasks.length === 0 && (
        <Card className="p-6 text-center text-sm text-ink/45">Aucune tâche pour ce jour.</Card>
      )}

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {dayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onCycleStatus={() => {
                const idx = STATUS_ORDER.indexOf(task.status);
                setTaskStatus(task.id, STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]);
              }}
              onEdit={() => openEdit(task)}
              onDelete={() => deleteTask(task.id)}
              showModuleBadge={!filterModuleId}
              moving={movingTaskId === task.id}
              onToggleMove={() => setMovingTaskId((id) => (id === task.id ? null : task.id))}
              onMove={(date) => {
                moveTask(task.id, date);
                setMovingTaskId(null);
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      <TaskFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editingTask={editingTask}
        defaultModuleId={filterModuleId}
        defaultDate={selectedDate}
      />
    </div>
  );
}

function TaskRow({
  task,
  onCycleStatus,
  onEdit,
  onDelete,
  showModuleBadge,
  moving,
  onToggleMove,
  onMove,
}: {
  task: Task;
  onCycleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showModuleBadge: boolean;
  moving: boolean;
  onToggleMove: () => void;
  onMove: (date: string) => void;
}) {
  const mod = task.moduleId ? getModuleById(task.moduleId) : undefined;
  const completed = task.status === "completed";
  const priorityMeta = PRIORITY_META[task.priority];
  const statusMeta = STATUS_META[task.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card hover={false} className="flex items-start gap-3 p-3.5">
        <button onClick={onCycleStatus} className="mt-0.5 shrink-0" aria-label="Changer le statut">
          {completed ? (
            <CheckSquare size={19} className="text-emerald-400" />
          ) : task.status === "in_progress" ? (
            <CircleDot size={19} className="text-brand-400" />
          ) : (
            <Square size={19} className="text-ink/30" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", completed ? "text-ink/35 line-through" : "text-ink/90")}>
            {task.title}
          </p>
          {task.description && <p className="mt-0.5 text-xs text-ink/40">{task.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {showModuleBadge && mod && (
              <Badge color={mod.color} className="text-[10px]">
                {mod.code}
              </Badge>
            )}
            <Badge color={priorityMeta.color} variant="outline" className="text-[10px]">
              {priorityMeta.label}
            </Badge>
            <Badge color={statusMeta.color} variant="outline" className="text-[10px]">
              {statusMeta.label}
            </Badge>
          </div>
          {moving && (
            <div className="mt-2 flex items-center gap-1.5">
              <MoveRight size={13} className="text-ink/40" />
              <input
                type="date"
                autoFocus
                defaultValue={task.deadline}
                onChange={(e) => e.target.value && onMove(e.target.value)}
                className="rounded-lg border border-ink/10 bg-ink/[0.04] px-2 py-1 text-xs text-ink outline-none focus:border-brand-500/60"
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={onToggleMove} className={cn("hover:text-ink", moving ? "text-brand-400" : "text-ink/35")}>
            <MoveRight size={14} />
          </button>
          <button onClick={onEdit} className="text-ink/35 hover:text-ink/70">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="text-ink/35 hover:text-rose-400">
            <Trash2 size={14} />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
