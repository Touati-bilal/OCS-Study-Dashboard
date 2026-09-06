"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Label, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { formatDateHuman } from "@/lib/utils";

const FIELDS: Array<{ key: keyof FormState; label: string; placeholder: string }> = [
  { key: "learned", label: "Ce que j'ai appris", placeholder: "Nouvelles notions, outils, techniques..." },
  { key: "workedOn", label: "Ce sur quoi j'ai travaillé", placeholder: "Tâches, projets, missions..." },
  { key: "completed", label: "Ce que j'ai terminé", placeholder: "Livrables ou tâches complétées..." },
  { key: "notUnderstood", label: "Ce que je n'ai pas compris", placeholder: "Points flous, notions difficiles..." },
  { key: "problems", label: "Problèmes rencontrés", placeholder: "Blocages, bugs, difficultés..." },
  { key: "questions", label: "Questions", placeholder: "Questions à poser à mon encadrant..." },
  { key: "skills", label: "Compétences acquises", placeholder: "Nouvelles compétences développées..." },
  { key: "notes", label: "Notes libres", placeholder: "Autres remarques..." },
];

interface FormState {
  learned: string;
  workedOn: string;
  completed: string;
  notUnderstood: string;
  problems: string;
  questions: string;
  skills: string;
  notes: string;
}

const EMPTY: FormState = {
  learned: "",
  workedOn: "",
  completed: "",
  notUnderstood: "",
  problems: "",
  questions: "",
  skills: "",
  notes: "",
};

export function JournalSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const entries = useAppStore((s) => s.journalEntries);
  const upsert = useAppStore((s) => s.upsertJournalEntry);
  const deleteEntry = useAppStore((s) => s.deleteJournalEntry);

  const existing = entries.find((e) => e.date === date);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open) setForm(existing ? { ...existing } : EMPTY);
  }, [open, date]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsert({ id: existing?.id, date, ...form });
    onClose();
  }

  if (!date) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Journal de stage">
      <p className="mb-4 -mt-2 text-xs capitalize text-brand-400">{formatDateHuman(date)}</p>
      <form onSubmit={handleSubmit}>
        {FIELDS.map((field) => (
          <FieldGroup key={field.key}>
            <Label>{field.label}</Label>
            <Textarea
              rows={2}
              value={form[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
            />
          </FieldGroup>
        ))}
        <div className="flex gap-2">
          {existing && (
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={() => {
                deleteEntry(existing.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          )}
          <Button type="submit" className="flex-1">
            Enregistrer
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
