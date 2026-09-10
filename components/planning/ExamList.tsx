"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ExamFormSheet } from "./ExamFormSheet";
import { useAppStore } from "@/store/useAppStore";
import { daysUntil, formatDateHuman } from "@/lib/utils";
import { ClipboardList, MapPin, Plus, Clock3 } from "lucide-react";
import type { Exam } from "@/lib/types";

export function ExamList() {
  const exams = useAppStore((s) => s.exams);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);

  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(exam: Exam) {
    setEditing(exam);
    setSheetOpen(true);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink/85">
          <ClipboardList size={16} className="text-brand-400" /> Examens à venir
        </h2>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink/45">Aucun examen planifié.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((exam, i) => {
            const d = daysUntil(exam.date);
            const soon = d >= 0 && d <= 7;
            const past = d < 0;
            return (
              <button key={exam.id} onClick={() => openEdit(exam)} className="block w-full text-left">
                <Card delay={i * 0.03} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink/90">{exam.name}</p>
                      {exam.module && <p className="truncate text-[11px] text-ink/45">{exam.module}</p>}
                    </div>
                    <Badge color={past ? "#64748b" : soon ? "#fb7185" : "#48a3ff"} className="shrink-0">
                      {past ? "Passé" : d === 0 ? "Aujourd'hui" : `J-${d}`}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/45">
                    <span className="capitalize">{formatDateHuman(exam.date)}</span>
                    {exam.time && (
                      <span className="flex items-center gap-1">
                        <Clock3 size={11} /> {exam.time}
                      </span>
                    )}
                    {exam.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {exam.location}
                      </span>
                    )}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <ExamFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing} />
    </div>
  );
}
