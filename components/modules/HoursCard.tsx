"use client";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAppStore } from "@/store/useAppStore";
import { Minus, Plus, Clock3 } from "lucide-react";

export function HoursCard({ moduleId, duration, color }: { moduleId: string; duration: number; color: string }) {
  const hours = useAppStore((s) => s.modules[moduleId]?.hoursStudied ?? 0);
  const addHours = useAppStore((s) => s.addHours);
  const setHoursStudied = useAppStore((s) => s.setHoursStudied);
  const pct = Math.min(100, Math.round((hours / duration) * 100));

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink/85">
        <Clock3 size={16} className="text-brand-400" /> Heures d&apos;étude
      </h3>
      <div className="flex items-center gap-3">
        <button
          onClick={() => addHours(moduleId, -1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink/70 hover:bg-ink/[0.12]"
        >
          <Minus size={16} />
        </button>
        <div className="flex-1 text-center">
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHoursStudied(moduleId, Number(e.target.value) || 0)}
            className="w-full bg-transparent text-center font-display text-2xl font-bold text-ink outline-none"
          />
          <p className="text-[11px] text-ink/40">sur {duration}h prévues</p>
        </div>
        <button
          onClick={() => addHours(moduleId, 1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
        >
          <Plus size={16} />
        </button>
      </div>
      <ProgressBar value={pct} color={color} className="mt-3" />
    </Card>
  );
}
