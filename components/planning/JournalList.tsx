"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JournalSheet } from "./JournalSheet";
import { useAppStore } from "@/store/useAppStore";
import { formatDateHuman, todayISO } from "@/lib/utils";
import { BookMarked, ChevronRight, Plus } from "lucide-react";

export function JournalList() {
  const entries = useAppStore((s) => s.journalEntries);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink/85">
          <BookMarked size={16} className="text-brand-400" /> Journal quotidien
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setActiveDate(todayISO())}>
          <Plus size={14} /> Aujourd&apos;hui
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink/45">
          Aucune entrée de journal. Clique sur un jour du calendrier ou sur &quot;Aujourd&apos;hui&quot;.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((entry, i) => (
            <button key={entry.id} onClick={() => setActiveDate(entry.date)} className="block w-full text-left">
              <Card delay={i * 0.03} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold capitalize text-ink/85">
                    {formatDateHuman(entry.date)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-ink/45">
                    {entry.learned || entry.workedOn || "Entrée enregistrée"}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-ink/30" />
              </Card>
            </button>
          ))}
        </div>
      )}

      <JournalSheet open={activeDate !== null} onClose={() => setActiveDate(null)} date={activeDate ?? ""} />
    </div>
  );
}
