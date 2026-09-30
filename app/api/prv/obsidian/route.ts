/**
 * GET /api/prv/obsidian — vault-relative note paths and deep links, computed on the server.
 *
 * The vault configuration lives in the server environment rather than in the client bundle, so a
 * vault name and its folder layout are never part of the public JavaScript. The client receives
 * only vault-*relative* paths (`OCS/M201/Préparation`), never a local filesystem path.
 *
 * `obsidian://` opens on desktop. Mobile has no equivalent URL scheme, so the response says
 * explicitly which platform the link targets instead of offering a link that silently fails.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, unauthorized } from "@/lib/prv/guard.server";
import { getMainModules } from "@/lib/modules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ObsidianNote {
  moduleId: string;
  code: string;
  name: string;
  /** Vault-relative path, safe to display. */
  path: string;
  /** `obsidian://` link for desktop, or `null` when unconfigured. */
  href: string | null;
}

export async function GET(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();

  const vault = process.env.PRV_OBSIDIAN_VAULT?.trim() || "";
  const rootFolder = (process.env.PRV_OBSIDIAN_ROOT?.trim() || "OCS").replace(/^\/+|\/+$/g, "");

  const notes: ObsidianNote[] = getMainModules("OCS").map((module) => {
    const path = [rootFolder, module.code, "Préparation"].join("/");
    return {
      moduleId: module.id,
      code: module.code,
      name: module.name,
      path,
      href: vault.length > 0 ? `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(path)}` : null,
    };
  });

  const weeklyPath = [rootFolder, "PRV", "Rapport hebdomadaire"].join("/");

  return NextResponse.json(
    {
      configured: vault.length > 0,
      rootFolder,
      notes,
      weekly: {
        path: weeklyPath,
        href:
          vault.length > 0
            ? `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(weeklyPath)}`
            : null,
      },
      hint:
        "Le lien obsidian:// fonctionne sur ordinateur. Sur mobile, ouvrez la note manuellement dans Obsidian : le chemin ci-dessus est relatif au coffre, jamais un chemin de votre disque.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
