/**
 * `/api/uploads/file/[...slug]` — downloads one stored TP / Projects file.
 *
 * Two rules matter here, and both were missing before:
 *
 *   1. the route requires the signed-in owner account, so the stored files are not world-readable;
 *   2. the response is always an *attachment* of type `application/octet-stream`, with
 *      `X-Content-Type-Options: nosniff` and only allowlisted extensions resolvable at all.
 *
 * Together with the write path - which no longer accepts a client-supplied `moduleId` as a path, and
 * stores files outside `public/` - there is no way to get a browser to execute an uploaded document
 * as HTML or script on the app's own origin.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireOwnerAccess, unauthorizedFiles } from "@/lib/owner-access.server";
import { resolveUploadFileForDownload } from "@/lib/uploads.server";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  let resolved: { fullPath: string; name: string };
  try {
    resolved = resolveUploadFileForDownload(params.slug ?? []);
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
