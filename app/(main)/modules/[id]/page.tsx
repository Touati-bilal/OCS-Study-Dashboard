import { notFound } from "next/navigation";
import { getModuleById, ALL_MODULES } from "@/lib/modules";
import { getModuleMaterialGroups } from "@/lib/materials.server";
import { getModuleActivityGroups } from "@/lib/activities.server";
import { ModuleDetailClient } from "@/components/modules/ModuleDetailClient";

export function generateStaticParams() {
  return ALL_MODULES.map((m) => ({ id: m.id }));
}

export default function ModuleDetailPage({ params }: { params: { id: string } }) {
  const moduleDef = getModuleById(params.id);
  if (!moduleDef) notFound();

  const materialGroups = getModuleMaterialGroups(moduleDef.folder);
  const activityGroups = getModuleActivityGroups(moduleDef.id);
  const backHref = moduleDef.category === "main" ? "/modules" : "/secondary";

  return (
    <ModuleDetailClient
      module={moduleDef}
      materialGroups={materialGroups}
      activityGroups={activityGroups}
      backHref={backHref}
    />
  );
}
