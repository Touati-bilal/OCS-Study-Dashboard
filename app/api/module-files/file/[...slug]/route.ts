/**
 * `/api/module-files/file/[...slug]` — downloads one stored "Les Fichiers" document.
 *
 * Requires the signed-in owner account, resolves the path inside the storage root only (with
 * symlinks collapsed and the containment test anchored on a path separator, so a sibling directory
 * such as `uploads-backup` is not reachable), and always answers with an attachment of type
 * `application/octet-stream` plus `nosniff` - so an uploaded document is never executed as
 * same-origin HTML or script.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

import { requireOwnerAccess, unauthorizedFiles } from "@/lib/prv/guard.server";
import { resolveModuleFileForDownload } from "@/lib/moduleFiles.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  let resolved: { fullPath: string; name: string };
  try {
    resolved = resolveModuleFileForDownload(params.slug ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fichier introuvable";
    const notFound = message === "fichier introuvable";
    return new NextResponse(notFound ? "Fichier introuvable" : "Forbidden", { status: notFound ? 404 : 403 });
  }

  const fileBuffer = fs.readFileSync(resolved.fullPath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(resolved.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "no-store",
    },
  });
}
