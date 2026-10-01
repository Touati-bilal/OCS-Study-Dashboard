"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { MaterialsList } from "./MaterialsList";
import { ActivitiesSection } from "./ActivitiesSection";
import { FilesSection } from "./FilesSection";
import { UploadGroup } from "./TpProjectsSection";
import { useModuleUploads } from "@/hooks/useModuleUploads";
import {
  DOCUMENT_SECTIONS,
  PROGER_SECTIONS,
  countMaterialFiles,
  splitModuleDocuments,
  type DocumentSectionId,
  type ProgerSectionId,
} from "@/lib/documents";
import type { MaterialGroup } from "@/lib/materials.server";
import type { ActivityGroup } from "@/lib/activities.server";
import { cn } from "@/lib/utils";
import { BookOpen, FlaskConical, FolderKanban, UploadCloud } from "lucide-react";

const SECTION_ICON: Record<DocumentSectionId, React.ElementType> = {
  cours: BookOpen,
  activites: FlaskConical,
  fichiers: UploadCloud,
  proger: FolderKanban,
};

/**
 * "Documents" of an OCS module:
 *
 *   Cours | Activités | Fichiers / Updates | Proger (TP | Proger)
 *
 * Every source keeps its own storage, so no file is ever duplicated:
 *  - Cours      → the static course material of `public/materials/<folder>`
 *  - Activités  → `public/activities/<moduleId>` (the M201 activity PDFs live here)
 *  - Fichiers   → the uploadable `uploads/module-files/<moduleId>` documents
 *  - Proger/TP  → the "TP" course folder + `uploads/<moduleId>/tp`
 *  - Proger     → `uploads/<moduleId>/projects`
 */
export function DocumentsSection({
  moduleId,
  materialGroups,
  activityGroups,
  color,
}: {
  moduleId: string;
  materialGroups: MaterialGroup[];
  activityGroups: ActivityGroup[];
  color: string;
}) {
  const [section, setSection] = useState<DocumentSectionId>("cours");
  const [progerSection, setProgerSection] = useState<ProgerSectionId>("tp");

  const { tp, projects, loading, uploading, upload, remove, tpInputRef, projectInputRef } =
    useModuleUploads(moduleId);

  const { coursGroups, tpGroup } = useMemo(() => splitModuleDocuments(materialGroups), [materialGroups]);
  const coursCount = useMemo(() => countMaterialFiles(coursGroups), [coursGroups]);

  const active = DOCUMENT_SECTIONS.find((s) => s.id === section) ?? DOCUMENT_SECTIONS[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {DOCUMENT_SECTIONS.map((def) => {
          const Icon = SECTION_ICON[def.id];
          const isActive = def.id === section;
          return (
            <button
              key={def.id}
              onClick={() => setSection(def.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                isActive ? "text-ink" : "text-ink/45 hover:text-ink/70"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="documents-section-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: color + "26" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={13} className="relative z-10" style={isActive ? { color } : undefined} />
              <span className="relative z-10">{def.label}</span>
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-3 text-[11px] leading-relaxed text-ink/35">{active.description}</p>

        {section === "cours" && <MaterialsList groups={coursGroups} emptyLabel="Aucun support de cours pour ce module." />}

        {section === "activites" && <ActivitiesSection groups={activityGroups} color={color} />}

        {section === "fichiers" && (
          <FilesSection
            moduleId={moduleId}
            title="Fichiers / Updates"
            emptyLabel="Aucun fichier ajouté. Les documents communiqués plus tard se retrouveront ici."
          />
        )}

        {section === "proger" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1.5">
              {PROGER_SECTIONS.map((def) => {
                const isActive = def.id === progerSection;
                return (
                  <button
                    key={def.id}
                    onClick={() => setProgerSection(def.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      isActive ? "text-ink" : "text-ink/45 hover:text-ink/70"
                    )}
                    style={isActive ? { backgroundColor: color + "26" } : undefined}
                  >
                    {def.label}
                  </button>
                );
              })}
            </div>

            {progerSection === "tp" && (
              <div className="flex flex-col gap-4">
                <p className="text-[11px] leading-relaxed text-ink/35">
                  {PROGER_SECTIONS[0].description}
                </p>
                {tpGroup ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">
                      <BookOpen size={13} style={{ color }} /> Support TP
                    </p>
                    <MaterialsList groups={[tpGroup]} emptyLabel="Aucun support TP." />
                  </div>
                ) : (
                  <Card hover={false} className="p-4 text-center text-xs text-ink/40">
                    Aucun support TP dans ce module.
                  </Card>
                )}
                <UploadGroup
                  title="TP"
                  icon={FlaskConical}
                  color="#48a3ff"
                  files={tp}
                  loading={loading}
                  uploading={uploading === "tp"}
                  onPick={() => tpInputRef.current?.click()}
                  onDelete={(id) => remove("tp", id)}
                  emptyLabel="Aucun fichier TP importé."
                />
                <input
                  ref={tpInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload("tp", file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {progerSection === "proger" && (
              <div className="flex flex-col gap-4">
                <p className="text-[11px] leading-relaxed text-ink/35">
                  {PROGER_SECTIONS[1].description}
                </p>
                <UploadGroup
                  title="Proger"
                  icon={FolderKanban}
                  color="#a78bfa"
                  files={projects}
                  loading={loading}
                  uploading={uploading === "projects"}
                  onPick={() => projectInputRef.current?.click()}
                  onDelete={(id) => remove("projects", id)}
                  emptyLabel="Aucun document de progression pour ce module."
                />
                <input
                  ref={projectInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload("projects", file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-ink/25">
        {coursCount} support{coursCount > 1 ? "s" : ""} de cours
        {tpGroup ? ` · ${tpGroup.files.length} document${tpGroup.files.length > 1 ? "s" : ""} TP` : ""}
      </p>
    </div>
  );
}
