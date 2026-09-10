"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { NotebookPen, Check, Trash2 } from "lucide-react";

function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesEditor({ moduleId }: { moduleId: string }) {
  const notes = useAppStore((s) => s.notes.filter((n) => n.moduleId === moduleId));
  const addNote = useAppStore((s) => s.addNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const [draft, setDraft] = useState("");

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function handleSave() {
    const text = draft.trim();
    if (!text) return;
    addNote(moduleId, text);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink/85">
          <NotebookPen size={16} className="text-brand-400" /> Nouvelle note
        </h3>
        <Textarea
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écris ici tes notes, résumés, points clés à retenir..."
        />
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-medium text-white shadow-glow transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Check size={14} /> Enregistrer
          </button>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <Card hover={false} className="p-4 text-center text-xs text-ink/40">
          Aucune note pour ce module.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((note, i) => (
            <Card key={note.id} delay={i * 0.03} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm text-ink/85">{note.text}</p>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="shrink-0 rounded-full p-1.5 text-ink/30 hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-ink/40">{formatNoteDate(note.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
