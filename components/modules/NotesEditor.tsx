"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/useAppStore";
import { NotebookPen, Check } from "lucide-react";

export function NotesEditor({ moduleId }: { moduleId: string }) {
  const notes = useAppStore((s) => s.modules[moduleId]?.notes ?? "");
  const setModuleNotes = useAppStore((s) => s.setModuleNotes);
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setValue(notes), [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(v: string) {
    setValue(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setModuleNotes(moduleId, v);
      setSaved(true);
    }, 500);
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
          <NotebookPen size={16} className="text-brand-400" /> Notes personnelles
        </h3>
        <span className="flex items-center gap-1 text-[10px] text-white/35">
          {saved ? (
            <>
              <Check size={12} /> Enregistré
            </>
          ) : (
            "Enregistrement..."
          )}
        </span>
      </div>
      <Textarea
        rows={8}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Écris ici tes notes, résumés, points clés à retenir..."
      />
    </Card>
  );
}
