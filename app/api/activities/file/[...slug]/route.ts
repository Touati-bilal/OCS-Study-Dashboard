import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveActivityPath } from "@/lib/activities.server";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const [moduleId, ...rest] = params.slug;
  const resolvedTarget = resolveActivityPath(moduleId, rest.join("/"));
  if (!resolvedTarget) return new NextResponse("Fichier introuvable", { status: 404 });

  const ext = path.extname(resolvedTarget).toLowerCase();
  const fileBuffer = fs.readFileSync(resolvedTarget);
  const filename = path.basename(resolvedTarget);
  const download = req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
