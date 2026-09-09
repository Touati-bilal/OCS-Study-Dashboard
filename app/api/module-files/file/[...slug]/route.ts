import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { MODULE_FILES_ROOT, findModuleFileByStoredName } from "@/lib/moduleFiles.server";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".zip": "application/zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const resolvedRoot = path.resolve(MODULE_FILES_ROOT);
  const targetPath = path.join(resolvedRoot, ...params.slug);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isFile()) {
    return new NextResponse("Fichier introuvable", { status: 404 });
  }

  const [moduleId, storedName] = params.slug;
  const meta = findModuleFileByStoredName(moduleId, storedName);
  const ext = path.extname(resolvedTarget).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(resolvedTarget);
  const downloadName = meta ? meta.originalName : path.basename(resolvedTarget);
  const download = req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      "Cache-Control": "no-store",
    },
  });
}
