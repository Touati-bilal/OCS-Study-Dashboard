import { NextRequest, NextResponse } from "next/server";
import { listModuleFiles, saveModuleFile, deleteModuleFile } from "@/lib/moduleFiles.server";

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId requis" }, { status: 400 });

  return NextResponse.json({ files: listModuleFiles(moduleId) });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const moduleId = formData.get("moduleId");
  const title = formData.get("title");
  const file = formData.get("file");

  if (typeof moduleId !== "string" || !moduleId) {
    return NextResponse.json({ error: "moduleId requis" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const entry = saveModuleFile(moduleId, typeof title === "string" ? title : "", file.name, buffer);

  return NextResponse.json({ ok: true, file: entry });
}

export async function DELETE(req: NextRequest) {
  const { moduleId, id } = await req.json();
  if (!moduleId || !id) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const ok = deleteModuleFile(moduleId, id);
  return NextResponse.json({ ok });
}
