/**
 * `/api/module-files` — the owner's own documents per module ("Les Fichiers").
 *
 * Every method requires the signed-in owner account: these routes write to the server filesystem
 * and used to be reachable, listable and deletable by anyone who could reach the app.
 *
 * The client never supplies a path. `moduleId` is validated as an identifier, the name a file is
 * stored under is generated here, and the storage library re-checks every resolved path against the
 * storage root. Extensions are allowlisted and the size is capped, so nothing that can execute as
 * active content ever lands on disk.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireOwnerAccess, unauthorizedFiles } from "@/lib/prv/guard.server";
import {
  MAX_UPLOAD_BYTES,
  deleteModuleFile,
  isValidModuleId,
  listModuleFiles,
  saveModuleFile,
} from "@/lib/moduleFiles.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!isValidModuleId(moduleId)) {
    return NextResponse.json({ error: "Identifiant de module invalide." }, { status: 400 });
  }

  return NextResponse.json({ files: listModuleFiles(moduleId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  // Rejected on the declared length before the body is parsed, so an oversized upload is never
  // buffered.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
  }

  const formData = await req.formData();
  const moduleId = formData.get("moduleId");
  const title = formData.get("title");
  const file = formData.get("file");

  if (!isValidModuleId(moduleId)) {
    return NextResponse.json({ error: "Identifiant de module invalide." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const entry = saveModuleFile(moduleId, typeof title === "string" ? title : "", file.name, buffer);
    return NextResponse.json({ ok: true, file: entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enregistrement refusé." },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  const { moduleId, id } = (await req.json().catch(() => ({}))) as { moduleId?: unknown; id?: unknown };
  if (!isValidModuleId(moduleId) || typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const ok = deleteModuleFile(moduleId, id);
  return NextResponse.json({ ok });
}
