"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { getModulesForOption } from "@/lib/modules";
import type { Exam } from "@/lib/types";

const EMPTY = { name: "", module: "", date: "", time: "", location: "", notes: "" };

export function ExamFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Exam | null;
}) {
  const addExam = useAppStore((s) => s.addExam);
  const updateExam = useAppStore((s) => s.updateExam);
  const deleteExam = useAppStore((s) => s.deleteExam);
  const studyOption = useAppStore((s) => s.studyOption);
  const availableModules = getModulesForOption(studyOption);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) setForm(editing ? { ...editing } : EMPTY);
  }, [open, editing]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.date) return;
    if (editing) updateExam(editing.id, form);
    else addExam(form);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Modifier l'examen" : "Nouvel examen"}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Label>Nom de l&apos;examen</Label>
          <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </FieldGroup>
        <FieldGroup>
          <Label>Module</Label>
          <Select value={form.module} onChange={(e) => set("module", e.target.value)}>
            <option value="">Sélectionner...</option>
            {availableModules.map((m) => (
              <option key={m.id} value={`${m.code} — ${m.name}`}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </FieldGroup>
          <FieldGroup>
            <Label>Heure</Label>
            <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </FieldGroup>
        </div>
        <FieldGroup>
          <Label>Lieu</Label>
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FieldGroup>
        <div className="flex gap-2">
          {editing && (
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={() => {
                deleteExam(editing.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          )}
          <Button type="submit" className="flex-1">
            {editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
