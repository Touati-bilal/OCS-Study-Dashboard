"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InternshipFormSheet } from "./InternshipFormSheet";
import { useAppStore } from "@/store/useAppStore";
import { Briefcase, Building2, MapPin, User, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDateShort } from "@/lib/utils";

export function InternshipCard() {
  const internships = useAppStore((s) => s.internships);
  const deleteInternship = useAppStore((s) => s.deleteInternship);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(0);

  const current = internships[editIndex] ?? internships[0];

  if (internships.length === 0) {
    return (
      <>
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Briefcase size={26} className="text-ink/30" />
          <div>
            <p className="text-sm font-medium text-ink/70">Aucun stage enregistré</p>
            <p className="mt-0.5 text-xs text-ink/40">Crée ta fiche de stage pour commencer.</p>
          </div>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus size={14} /> Créer un stage
          </Button>
        </Card>
        <InternshipFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Building2 size={15} className="text-brand-400" />
              <p className="truncate text-sm font-semibold text-ink/90">{current.company}</p>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink/50">{current.title}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setSheetOpen(true)}
              className="rounded-full p-1.5 text-ink/40 hover:bg-ink/10 hover:text-ink"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => deleteInternship(current.id)}
              className="rounded-full p-1.5 text-ink/40 hover:bg-rose-500/10 hover:text-rose-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {current.startDate && current.endDate && (
            <Badge color="#48a3ff" variant="outline">
              {formatDateShort(current.startDate)} → {formatDateShort(current.endDate)}
            </Badge>
          )}
          {current.location && (
            <Badge color="#94a3b8" variant="outline">
              <MapPin size={10} /> {current.location}
            </Badge>
          )}
          {current.supervisor && (
            <Badge color="#94a3b8" variant="outline">
              <User size={10} /> {current.supervisor}
            </Badge>
          )}
          {current.effGrade !== null && current.effGrade !== undefined && (
            <Badge color="#34d399">EFF: {current.effGrade}/100</Badge>
          )}
        </div>

        {current.description && <p className="mt-3 text-xs leading-relaxed text-ink/55">{current.description}</p>}
        {current.objectives && (
          <div className="mt-2 rounded-xl bg-ink/[0.04] p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink/35">Objectifs</p>
            <p className="text-xs text-ink/55">{current.objectives}</p>
          </div>
        )}

        {internships.length > 1 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto">
            {internships.map((i, idx) => (
              <button
                key={i.id}
                onClick={() => setEditIndex(idx)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                  idx === editIndex ? "bg-brand-500/25 text-brand-300" : "bg-ink/[0.05] text-ink/45"
                }`}
              >
                {i.company}
              </button>
            ))}
          </div>
        )}
      </Card>

      <button
        onClick={() => {
          setEditIndex(internships.length);
          setSheetOpen(true);
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink/15 py-2 text-xs text-ink/40 hover:border-ink/25 hover:text-ink/60"
      >
        <Plus size={13} /> Ajouter un autre stage
      </button>

      <InternshipFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editing={editIndex < internships.length ? current : null}
      />
    </>
  );
}
