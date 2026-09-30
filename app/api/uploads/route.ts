import { NextRequest, NextResponse } from "next/server";

import { requireOwnerAccess, unauthorizedFiles } from "@/lib/prv/guard.server";
import {
  MAX_UPLOAD_BYTES,
  deleteUpload,
  isCategory,
  isValidModuleId,
  listUploads,
  saveUpload,
} from "@/lib/uploads.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!isValidModuleId(moduleId)) {
    return NextResponse.json({ error: "Identifiant de module invalide." }, { status: 400 });
  }

  return NextResponse.json(
    {
      tp: listUploads(moduleId, "tp"),
      projects: listUploads(moduleId, "projects"),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  // Rejected on the declared length before the body is parsed.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
  }

  const formData = await req.formData();
  const moduleId = formData.get("moduleId");
  const category = formData.get("category");
  const file = formData.get("file");

  if (!isValidModuleId(moduleId)) {
    return NextResponse.json({ error: "Identifiant de module invalide." }, { status: 400 });
  }
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    // The name on disk is generated in here; `file.name` survives only as display text.
    const storedName = saveUpload(moduleId, category, file.name, buffer);
    return NextResponse.json({ ok: true, id: storedName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enregistrement refusé." },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireOwnerAccess(req))) return unauthorizedFiles();

  const { moduleId, category, id } = (await req.json().catch(() => ({}))) as {
    moduleId?: unknown;
    category?: unknown;
    id?: unknown;
  };
  if (!isValidModuleId(moduleId) || !isCategory(category) || typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const ok = deleteUpload(moduleId, category, id);
  return NextResponse.json({ ok });
}
