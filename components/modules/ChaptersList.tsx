"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAppStore, deriveChapterStatus } from "@/store/useAppStore";
import { isOccOrsModule, type ChapterDef } from "@/lib/modules";
import type { ChapterStatus } from "@/lib/types";
import { CheckCircle2, CircleDashed, CircleDot, ChevronDown, Check, Search, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_META: Record<ChapterStatus, { icon: React.ElementType; color: string; label: string }> = {
  not_started: { icon: CircleDashed, color: "#64748b", label: "Non commencé" },
  in_progress: { icon: CircleDot, color: "#fbbf24", label: "En cours" },
  completed: { icon: CheckCircle2, color: "#34d399", label: "Terminé" },
};

export function ChaptersList({ moduleId, chapters }: { moduleId: string; chapters: ChapterDef[] }) {
  const runtime = useAppStore((s) => s.modules[moduleId]);
  const toggleObjective = useAppStore((s) => s.toggleObjective);
  const setChapterObjectives = useAppStore((s) => s.setChapterObjectives);
  const [openId, setOpenId] = useState<string | null>(chapters[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const isFilterable = isOccOrsModule(moduleId);

  const filteredChapters = useMemo(() => {
    if (!isFilterable || !query.trim()) return chapters;
    const q = query.trim().toLowerCase();
    return chapters.filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(q) ||
        chapter.objectives.some((o) => o.text.toLowerCase().includes(q))
    );
  }, [chapters, query, isFilterable]);

  return (
    <div className="flex flex-col gap-2">
      {isFilterable && (
        <div className="relative mb-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un chapitre ou une section..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white/85 placeholder:text-white/30 focus:border-white/25 focus:outline-none"
          />
        </div>
      )}
      {isFilterable && filteredChapters.length === 0 && (
        <Card hover={false} className="p-4 text-center text-xs text-white/40">
          Aucun chapitre ne correspond à « {query} ».
        </Card>
      )}
      {filteredChapters.map((chapter, i) => {
        const status = deriveChapterStatus(chapter, runtime);
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const isSimple = chapter.objectives.length <= 1;
        const done = chapter.objectives.filter((o) => runtime?.objectiveStatus[o.id]).length;
        const isOpen = openId === chapter.id;

        if (isSimple) {
          const objective = chapter.objectives[0];
          return (
            <Card key={chapter.id} delay={i * 0.04} hover={false} className="flex items-center gap-3 p-3.5">
              <button onClick={() => objective && toggleObjective(moduleId, objective.id)} className="shrink-0" title={meta.label}>
                <Icon size={22} style={{ color: meta.color }} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", status === "completed" ? "text-white/50 line-through" : "text-white/85")}>
                  {i + 1}. {chapter.title}
                </p>
                <p className="text-[11px]" style={{ color: meta.color }}>
                  {meta.label}
                </p>
              </div>
            </Card>
          );
        }

        return (
          <Card key={chapter.id} delay={i * 0.04} hover={false} className="overflow-hidden p-0">
            <button
              onClick={() => setOpenId(isOpen ? null : chapter.id)}
              className="flex w-full items-center gap-3 p-3.5 text-left"
            >
              <Icon size={20} className="shrink-0" style={{ color: meta.color }} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", status === "completed" ? "text-white/50 line-through" : "text-white/85")}>
                  {i + 1}. {chapter.title}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <ProgressBar value={(done / chapter.objectives.length) * 100} color={meta.color} height={5} className="max-w-[110px]" showShimmer={false} />
                  <span className="text-[10px] text-white/40">
                    {done}/{chapter.objectives.length} objectifs
                  </span>
                </div>
              </div>
              <ChevronDown
                size={18}
                className={cn("shrink-0 text-white/35 transition-transform", isOpen && "rotate-180")}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden border-t border-white/8"
                >
                  <div className="flex flex-col gap-1 p-3">
                    {chapter.objectives.map((obj) => {
                      const objDone = !!runtime?.objectiveStatus[obj.id];
                      return (
                        <button
                          key={obj.id}
                          onClick={() => toggleObjective(moduleId, obj.id)}
                          className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-white/[0.04]"
                        >
                          {objDone ? (
                            <span
                              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: meta.color }}
                            >
                              <Check size={12} className="text-base-950" strokeWidth={3} />
                            </span>
                          ) : (
                            <Square size={18} className="mt-0.5 shrink-0 text-white/25" />
                          )}
                          <span className={cn("text-xs leading-snug", objDone ? "text-white/40 line-through" : "text-white/75")}>
                            {obj.text}
                          </span>
                        </button>
                      );
                    })}
                    <div className="mt-1 flex gap-2 px-2">
                      <button
                        onClick={() =>
                          setChapterObjectives(
                            moduleId,
                            chapter.objectives.map((o) => o.id),
                            true
                          )
                        }
                        className="text-[10px] font-medium text-brand-400 hover:text-brand-300"
                      >
                        Tout cocher
                      </button>
                      <button
                        onClick={() =>
                          setChapterObjectives(
                            moduleId,
                            chapter.objectives.map((o) => o.id),
                            false
                          )
                        }
                        className="text-[10px] font-medium text-white/35 hover:text-white/55"
                      >
                        Tout décocher
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}
    </div>
  );
}
