"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HydrationGate } from "@/components/layout/HydrationGate";
import { ModuleTabs } from "./ModuleTabs";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GradesCard } from "./GradesCard";
import { HoursCard } from "./HoursCard";
import { ChaptersList } from "./ChaptersList";
import { NotesEditor } from "./NotesEditor";
import { MaterialsList } from "./MaterialsList";
import { TpProjectsSection } from "./TpProjectsSection";
import { TodoSection } from "@/components/dashboard/TodoSection";
import { useModuleStats } from "@/hooks/useModuleStats";
import type { ModuleDef } from "@/lib/modules";
import type { MaterialGroup } from "@/lib/materials.server";
import { Target } from "lucide-react";

const BASE_TABS = [
  { id: "apercu", label: "Aperçu" },
  { id: "chapitres", label: "Chapitres" },
  { id: "notes", label: "Notes" },
  { id: "documents", label: "Documents" },
  { id: "taches", label: "Tâches" },
];

const TP_PROJECTS_TAB = { id: "tp-projets", label: "TP & Projects" };

export function ModuleDetailClient({
  module,
  materialGroups,
  backHref,
}: {
  module: ModuleDef;
  materialGroups: MaterialGroup[];
  backHref: string;
}) {
  const [tab, setTab] = useState("apercu");
  const [stat] = useModuleStats([module]);
  const tabs = module.efmRegional ? [...BASE_TABS, TP_PROJECTS_TAB] : BASE_TABS;

  return (
    <>
      <PageHeader title={module.code} subtitle={module.name} backHref={backHref} />
      <ModuleTabs tabs={tabs} active={tab} onChange={setTab} color={module.color} />

      <HydrationGate>
        <div className="px-5 py-4">
          {tab === "apercu" && (
            <div className="flex flex-col gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <ProgressRing value={stat?.progress ?? 0} color={module.color} size={80} />
                  <div className="flex-1">
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      <Badge color={module.color}>{module.duration}h</Badge>
                      <Badge color="#94a3b8" variant="outline">
                        Coef. {module.coefficient}
                      </Badge>
                      {module.efmRegional && <Badge color="#fbbf24">EFM régional</Badge>}
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">{module.description}</p>
                  </div>
                </div>
              </Card>

              {module.objectives.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white/85">
                    <Target size={16} className="text-brand-400" /> Objectifs
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {module.objectives.map((obj, i) => (
                      <li key={i} className="flex gap-2 text-xs text-white/55">
                        <span className="text-brand-400">•</span> {obj}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {module.skills && module.skills.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-sm font-semibold text-white/85">Compétences</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {module.skills.map((skill) => (
                      <Badge key={skill} color={module.color} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              <HoursCard moduleId={module.id} duration={module.duration} color={module.color} />
              <GradesCard moduleId={module.id} color={module.color} />
            </div>
          )}

          {tab === "chapitres" && <ChaptersList moduleId={module.id} chapters={module.chapters} />}

          {tab === "notes" && <NotesEditor moduleId={module.id} />}

          {tab === "documents" && <MaterialsList groups={materialGroups} />}

          {tab === "taches" && <TodoSection filterModuleId={module.id} compact title="Tâches du module" />}

          {tab === "tp-projets" && module.efmRegional && <TpProjectsSection moduleId={module.id} />}
        </div>
      </HydrationGate>
    </>
  );
}
