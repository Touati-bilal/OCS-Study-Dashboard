"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { getModulesForOption } from "@/lib/modules";
import { todayISO } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

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
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const studyOption = useAppStore((s) => s.studyOption);
  const availableModules = getModulesForOption(studyOption);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleId, setModuleId] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");

  useEffect(() => {
    if (open) {
      setTitle(editingTask?.title ?? "");
      setDescription(editingTask?.description ?? "");
      setModuleId(editingTask?.moduleId ?? defaultModuleId ?? "");
      setDeadline(editingTask?.deadline ?? defaultDate ?? todayISO());
      setPriority(editingTask?.priority ?? "medium");
      setStatus(editingTask?.status ?? "todo");
    }
  }, [open, editingTask, defaultModuleId, defaultDate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadline) return;
    if (editingTask) {
      updateTask(editingTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        moduleId: moduleId || null,
        deadline,
        priority,
        status,
      });
    } else {
      addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        moduleId: moduleId || null,
        deadline,
        priority,
        status,
      });
    }
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editingTask ? "Modifier la tâche" : "Nouvelle tâche"}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Label>Titre</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Réviser le chapitre 3"
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
        <FieldGroup>
          <Label>Date</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Priorité</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label>Statut</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">À faire</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminé</option>
            </Select>
          </FieldGroup>
        </div>
        <FieldGroup>
          <Label>Module / catégorie (optionnel)</Label>
          <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">Aucun module</option>
            {availableModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <Button type="submit" className="mt-1 w-full">
          {editingTask ? "Enregistrer" : "Ajouter la tâche"}
        </Button>
      </form>
    </Sheet>
  );
}
