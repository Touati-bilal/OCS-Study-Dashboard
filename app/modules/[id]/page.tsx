import { notFound } from "next/navigation";
import { getModuleById, ALL_MODULES } from "@/lib/modules";
import { getModuleMaterialGroups } from "@/lib/materials.server";
import { ModuleDetailClient } from "@/components/modules/ModuleDetailClient";

export function generateStaticParams() {
  return ALL_MODULES.map((m) => ({ id: m.id }));
}

export default function ModuleDetailPage({ params }: { params: { id: string } }) {
  const module = getModuleById(params.id);
  if (!module) notFound();

  const materialGroups = getModuleMaterialGroups(module.folder);
  const backHref = module.category === "main" ? "/modules" : "/secondary";

  return <ModuleDetailClient module={module} materialGroups={materialGroups} backHref={backHref} />;
}
