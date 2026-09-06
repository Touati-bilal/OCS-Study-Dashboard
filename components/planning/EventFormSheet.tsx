"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import type { InternshipEvent } from "@/lib/types";

export function EventFormSheet({
  open,
  onClose,
  internshipId,
  defaultDate,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  internshipId: string;
  defaultDate?: string;
  editing?: InternshipEvent | null;
}) {
  const addEvent = useAppStore((s) => s.addInternshipEvent);
  const updateEvent = useAppStore((s) => s.updateInternshipEvent);
  const deleteEvent = useAppStore((s) => s.deleteInternshipEvent);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDate(editing?.date ?? defaultDate ?? "");
      setStartTime(editing?.startTime ?? "09:00");
      setEndTime(editing?.endTime ?? "10:00");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing, defaultDate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    if (editing) {
      updateEvent(editing.id, { title: title.trim(), date, startTime, endTime, notes });
    } else {
      addEvent({ internshipId, title: title.trim(), date, startTime, endTime, notes });
    }
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Modifier l'activité" : "Nouvelle activité"}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Label>Titre</Label>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required />
        </FieldGroup>
        <FieldGroup>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Début</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label>Fin</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </FieldGroup>
        </div>
        <FieldGroup>
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FieldGroup>
        <div className="flex gap-2">
          {editing && (
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={() => {
                deleteEvent(editing.id);
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
