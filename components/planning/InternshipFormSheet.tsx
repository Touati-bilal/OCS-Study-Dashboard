"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import type { Internship } from "@/lib/types";

const EMPTY = {
  company: "",
  title: "",
  startDate: "",
  endDate: "",
  location: "",
  supervisor: "",
  description: "",
  objectives: "",
  effGrade: "",
};

export function InternshipFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Internship | null;
}) {
  const addInternship = useAppStore((s) => s.addInternship);
  const updateInternship = useAppStore((s) => s.updateInternship);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { ...editing, effGrade: editing.effGrade !== null ? String(editing.effGrade) : "" }
          : EMPTY
      );
    }
  }, [open, editing]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.title.trim()) return;
    const effGrade = form.effGrade === "" ? null : Math.max(0, Math.min(100, Number(form.effGrade)));
    const payload = { ...form, effGrade };
    if (editing) {
      updateInternship(editing.id, payload);
    } else {
      addInternship(payload);
    }
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Modifier le stage" : "Nouveau stage"}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Label>Entreprise</Label>
          <Input value={form.company} onChange={(e) => set("company", e.target.value)} required autoFocus />
        </FieldGroup>
        <FieldGroup>
          <Label>Titre du stage</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Date de début</Label>
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label>Date de fin</Label>
            <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </FieldGroup>
        </div>
        <FieldGroup>
          <Label>Lieu</Label>
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label>Superviseur / Encadrant</Label>
          <Input value={form.supervisor} onChange={(e) => set("supervisor", e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label>Description</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label>Objectifs</Label>
          <Textarea rows={3} value={form.objectives} onChange={(e) => set("objectives", e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label>Note EFF (/100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.effGrade}
            placeholder="—"
            onChange={(e) => set("effGrade", e.target.value)}
          />
        </FieldGroup>
        <Button type="submit" className="mt-1 w-full">
          {editing ? "Enregistrer" : "Créer le stage"}
        </Button>
      </form>
    </Sheet>
  );
}
