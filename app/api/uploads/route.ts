import { NextRequest, NextResponse } from "next/server";
import { listUploads, saveUpload, deleteUpload, type UploadCategory } from "@/lib/uploads.server";

function isCategory(v: string | null): v is UploadCategory {
  return v === "tp" || v === "projects";
}

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId requis" }, { status: 400 });

  return NextResponse.json({
    tp: listUploads(moduleId, "tp"),
    projects: listUploads(moduleId, "projects"),
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const moduleId = formData.get("moduleId");
  const category = formData.get("category");
  const file = formData.get("file");

  if (typeof moduleId !== "string" || !moduleId) {
    return NextResponse.json({ error: "moduleId requis" }, { status: 400 });
  }
  if (!isCategory(typeof category === "string" ? category : null)) {
    return NextResponse.json({ error: "category invalide" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const savedName = saveUpload(moduleId, category as UploadCategory, file.name, buffer);

  return NextResponse.json({ ok: true, filename: savedName });
}

export async function DELETE(req: NextRequest) {
  const { moduleId, category, filename } = await req.json();
  if (!moduleId || !isCategory(category) || !filename) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const ok = deleteUpload(moduleId, category, filename);
  return NextResponse.json({ ok });
}
