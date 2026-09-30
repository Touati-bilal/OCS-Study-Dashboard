import type { MaterialGroup } from "./materials.server";

/**
 * Document structure shared by every OCS module (M201, M202, M203, ...):
 *
 *   Documents
 *   ├── Cours              course / learning material
 *   ├── Activités          the activities handed out for the module
 *   ├── Fichiers / Updates external files that can be added at any time
 *   └── Proger
 *       ├── TP             practical work
 *       └── Proger         progress / production documents
 *
 * The sections below are the single source of truth for the labels; the OCS module page just
 * renders them. Sections are declared in a fixed order so every OCS module looks the same.
 */
export type DocumentSectionId = "cours" | "activites" | "fichiers" | "proger";

export type ProgerSectionId = "tp" | "proger";

export interface DocumentSectionDef {
  id: DocumentSectionId;
  label: string;
  shortLabel: string;
  description: string;
}

export const DOCUMENT_SECTIONS: DocumentSectionDef[] = [
  {
    id: "cours",
    label: "Cours",
    shortLabel: "Cours",
    description: "Supports de cours et documents théoriques du module.",
  },
  {
    id: "activites",
    label: "Activités",
    shortLabel: "Activités",
    description: "Activités communiquées pour ce module (parties, cas pratiques, corrigés).",
  },
  {
    id: "fichiers",
    label: "Fichiers / Updates",
    shortLabel: "Fichiers",
    description: "Fichiers ajoutés ou mis à jour ensuite, sans mélanger avec le cours.",
  },
  {
    id: "proger",
    label: "Proger",
    shortLabel: "Proger",
    description: "Travaux pratiques et documents de progression. Le matériel peut être ajouté plus tard.",
  },
];

export const PROGER_SECTIONS: { id: ProgerSectionId; label: string; description: string }[] = [
  { id: "tp", label: "TP", description: "Travaux pratiques du module. Le matériel peut être ajouté plus tard." },
  { id: "proger", label: "Proger", description: "Documents de progression et de production. Le matériel peut être ajouté plus tard." },
];

/**
 * Material categories (the folder names under `public/materials/<folder>`) that belong to
 * "Proger / TP" instead of "Cours". Everything else is course material.
 * Compared case-insensitively, so `03 - TP` and `tp` are both recognised.
 */
export const PROGER_MATERIAL_CATEGORIES = new Set(["tp", "proger", "projets", "projects"]);

export interface ModuleDocuments {
  /** Course material groups, labelled with their original folder name (Résumé, Cours, EFM...). */
  coursGroups: MaterialGroup[];
  /** The "TP" material group of the module, if it has one. */
  tpGroup: MaterialGroup | null;
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

/**
 * Splits the flat material groups of a module into the "Cours" section and the "Proger / TP"
 * section. No file is ever dropped or duplicated: each file lands in exactly one place.
 */
export function splitModuleDocuments(groups: MaterialGroup[]): ModuleDocuments {
  const coursGroups: MaterialGroup[] = [];
  let tpGroup: MaterialGroup | null = null;

  for (const group of groups) {
    if (PROGER_MATERIAL_CATEGORIES.has(normalizeCategory(group.category))) {
      if (!tpGroup) tpGroup = group;
      else tpGroup = { category: tpGroup.category, files: [...tpGroup.files, ...group.files] };
    } else {
      coursGroups.push(group);
    }
  }

  return { coursGroups, tpGroup };
}

export function countMaterialFiles(groups: MaterialGroup[]): number {
  return groups.reduce((sum, group) => sum + group.files.length, 0);
}
