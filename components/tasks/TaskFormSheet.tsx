"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { getModuleById, getModulesForOption } from "@/lib/modules";
import { TASK_PRIORITY_META } from "@/lib/tasks";
import { cn, todayISO } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

const PRIORITY_ORDER: TaskPriority[] = ["prof", "important", "normal"];

/**
 * The task form deliberately asks for the minimum needed to create a task: a title, an optional
 * description, the module, the due date, the priority and the status. The optional metadata that
 * used to be offered here (notes, source, links) is not part of the task workflow, so it is neither
 * asked for nor written. Values already stored on an edited task are carried through untouched so
 * editing never destroys existing data.
 */
export function TaskFormSheet({
  open,
  onClose,
  editingTask,
  moduleId: fixedModuleId,
  defaultDeadline,
  defaultPriority = "normal",
}: {
  open: boolean;
  onClose: () => void;
  editingTask?: Task | null;
  /** When set, the task belongs to this module and no module field is shown: it is automatic. */
  moduleId?: string;
  /** Pre-filled due date when the form is opened from a day picker. */
  defaultDeadline?: string;
  /** Priority pre-selected for a new task; the OCC / ORS list keeps its historical default. */
  defaultPriority?: TaskPriority;
}) {
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const studyOption = useAppStore((s) => s.studyOption);
  const availableModules = getModulesForOption(studyOption);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleId, setModuleId] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [status, setStatus] = useState<TaskStatus>("todo");

  // A task created from a module page never asks for a module: it belongs to that module.
  const isModuleLocked = Boolean(fixedModuleId);
  // `||` and not `??`: "Aucun module" is an empty string, and it must become null so the task is not
  // filtered out of the list right after being created.
  const effectiveModuleId = editingTask?.moduleId || fixedModuleId || moduleId || null;

  useEffect(() => {
    if (!open) return;
    setTitle(editingTask?.title ?? "");
    setDescription(editingTask?.description ?? "");
    setModuleId(editingTask?.moduleId ?? fixedModuleId ?? "");
    setDeadline(editingTask?.deadline ?? defaultDeadline ?? "");
    setPriority(editingTask?.priority ?? defaultPriority);
    setStatus(editingTask?.status ?? "todo");
  }, [open, editingTask, fixedModuleId, defaultDeadline, defaultPriority]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      moduleId: effectiveModuleId,
      deadline: deadline || undefined,
      priority,
      status,
      // Carried through so an edit never wipes metadata that already exists on the task.
      ...(editingTask
        ? {
            chapterId: editingTask.chapterId,
            notes: editingTask.notes,
            source: editingTask.source,
            links: editingTask.links,
          }
        : {}),
    };

    if (editingTask) {
      updateTask(editingTask.id, payload);
    } else {
      addTask(payload);
    }
    onClose();
  }

  const lockedModule = effectiveModuleId ? getModuleById(effectiveModuleId) : undefined;

  return (
    <Sheet open={open} onClose={onClose} title={editingTask ? "Modifier la tâche" : "Nouvelle tâche"}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Label>Titre</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la tâche"
            required
          />
        </FieldGroup>

        <FieldGroup>
          <Label>Description (optionnel)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Détails supplémentaires..."
          />
        </FieldGroup>

        {isModuleLocked ? (
          <FieldGroup>
            <Label>Module</Label>
            <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: lockedModule?.color }}
              />
              <span className="min-w-0 truncate text-sm text-ink/80">
                {lockedModule ? `${lockedModule.code} — ${lockedModule.name}` : fixedModuleId}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-ink/35">
              La tâche est rattachée automatiquement à ce module.
            </p>
          </FieldGroup>
        ) : (
          <FieldGroup>
            <Label>Module</Label>
            <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              <option value="">Aucun module</option>
              {availableModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        )}

        <FieldGroup>
          <Label>Échéance (optionnel)</Label>
          <Input type="date" min={todayISO()} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </FieldGroup>

        <FieldGroup>
          <Label>Priorité</Label>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {PRIORITY_ORDER.map((value) => {
              const meta = TASK_PRIORITY_META[value];
              const active = priority === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setPriority(value)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                    active ? "text-ink" : "border-ink/10 text-ink/50 hover:bg-ink/[0.04]"
                  )}
                  style={active ? { borderColor: meta.color + "88", backgroundColor: meta.color + "18" } : undefined}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold">{meta.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink/35">
            {TASK_PRIORITY_META[priority].description}
          </p>
        </FieldGroup>

        <FieldGroup>
          <Label>Statut</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            <option value="todo">○ À faire</option>
            <option value="in_progress">◐ En cours</option>
            <option value="completed">✓ Terminé</option>
          </Select>
        </FieldGroup>

        <Button type="submit" className="mt-1 w-full">
          {editingTask ? "Enregistrer" : "Ajouter la tâche"}
        </Button>
      </form>
    </Sheet>
  );
}
