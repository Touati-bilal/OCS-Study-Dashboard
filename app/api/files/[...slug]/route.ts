import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DATA_ROOT, DATA_SUBROOTS } from "@/lib/materials.server";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(_req: NextRequest, { params }: { params: { slug: string[] } }) {
  const resolvedRoot = path.resolve(DATA_ROOT);
  const targetPath = path.join(resolvedRoot, ...params.slug);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedRoot + path.sep) || !DATA_SUBROOTS.has(params.slug[0])) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isFile()) {
    return new NextResponse("Fichier introuvable", { status: 404 });
  }

  const ext = path.extname(resolvedTarget).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(resolvedTarget);
  const filename = path.basename(resolvedTarget);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
