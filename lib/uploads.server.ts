import fs from "fs";
import path from "path";

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export type UploadCategory = "tp" | "projects";

export interface UploadedFile {
  name: string;
  sizeKb: number;
  uploadedAt: string;
  category: UploadCategory;
  url: string;
}

function categoryDir(moduleId: string, category: UploadCategory): string {
  return path.join(UPLOADS_ROOT, moduleId, category);
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[/\\?%*:|"<>]/g, "-").trim();
  return base || "fichier";
}

export function listUploads(moduleId: string, category: UploadCategory): UploadedFile[] {
  const dir = categoryDir(moduleId, category);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const full = path.join(dir, e.name);
      const stat = fs.statSync(full);
      return {
        name: e.name,
        sizeKb: Math.max(1, Math.round(stat.size / 1024)),
        uploadedAt: stat.mtime.toISOString(),
        category,
        url: "/api/uploads/file/" + [moduleId, category, e.name].map(encodeURIComponent).join("/"),
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function saveUpload(moduleId: string, category: UploadCategory, filename: string, buffer: Buffer): string {
  const dir = categoryDir(moduleId, category);
  fs.mkdirSync(dir, { recursive: true });
  let safeName = sanitizeFilename(filename);
  let target = path.join(dir, safeName);
  if (fs.existsSync(target)) {
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    safeName = `${base}-${Date.now()}${ext}`;
    target = path.join(dir, safeName);
  }
  fs.writeFileSync(target, buffer);
  return safeName;
}

export function deleteUpload(moduleId: string, category: UploadCategory, filename: string): boolean {
  const dir = categoryDir(moduleId, category);
  const target = path.join(dir, sanitizeFilename(filename));
  const resolvedDir = path.resolve(dir);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedDir)) return false;
  if (!fs.existsSync(resolvedTarget)) return false;
  fs.unlinkSync(resolvedTarget);
  return true;
}
