"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label, FieldGroup } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { computeFinalGrade, finalGradePercent, CC_MAX, EFM_MAX, FINAL_MAX } from "@/lib/grades";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GraduationCap } from "lucide-react";

export function GradesCard({ moduleId, color }: { moduleId: string; color: string }) {
  const runtime = useAppStore((s) => s.modules[moduleId]);
  const setGrades = useAppStore((s) => s.setGrades);

  const [cc, setCc] = useState<string>(runtime?.ccGrade?.toString() ?? "");
  const [efm, setEfm] = useState<string>(runtime?.efmGrade?.toString() ?? "");

  const ccVal = cc === "" ? null : Math.max(0, Math.min(CC_MAX, Number(cc)));
  const efmVal = efm === "" ? null : Math.max(0, Math.min(EFM_MAX, Number(efm)));
  const final = computeFinalGrade(ccVal, efmVal);
  const percent = finalGradePercent(ccVal, efmVal);

  function commit(nextCc: string, nextEfm: string) {
    const c = nextCc === "" ? null : Math.max(0, Math.min(CC_MAX, Number(nextCc)));
    const e = nextEfm === "" ? null : Math.max(0, Math.min(EFM_MAX, Number(nextEfm)));
    setGrades(moduleId, c, e);
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white/85">
        <GraduationCap size={16} className="text-brand-400" /> Notes du module
      </h3>

      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-3">
          <FieldGroup className="mb-0">
            <Label>CC (/{CC_MAX})</Label>
            <Input
              type="number"
              min={0}
              max={CC_MAX}
              step={0.25}
              value={cc}
              placeholder="—"
              onChange={(e) => {
                setCc(e.target.value);
                commit(e.target.value, efm);
              }}
            />
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label>EFM (/{EFM_MAX})</Label>
            <Input
              type="number"
              min={0}
              max={EFM_MAX}
              step={0.25}
              value={efm}
              placeholder="—"
              onChange={(e) => {
                setEfm(e.target.value);
                commit(cc, e.target.value);
              }}
            />
          </FieldGroup>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ProgressRing value={percent} size={88} strokeWidth={8} color={color} />
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white/[0.04] p-3 text-center">
        <p className="text-[11px] text-white/40">Note finale = (CC × 0.25) + ((EFM ÷ 2) × 0.75)</p>
        <p className="mt-1 font-display text-xl font-bold">
          {final !== null ? `${final} / ${FINAL_MAX}` : "—"}
        </p>
      </div>
    </Card>
  );
}
