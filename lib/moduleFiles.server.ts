import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * "Les Fichiers" storage: user-uploaded documents (e.g. PDFs handed out by teachers),
 * kept fully separate from the theoretical course materials in `public/materials`
 * (see materials.server.ts) and from the TP/Projects uploads (see uploads.server.ts).
 * Each module gets its own folder plus a meta.json carrying the user-chosen title and
 * upload date, since the file on disk is renamed to an id to avoid collisions.
 */
export const MODULE_FILES_ROOT = path.join(process.cwd(), "uploads", "module-files");

export interface ModuleFileEntry {
  id: string;
  title: string;
  originalName: string;
  ext: string;
  sizeKb: number;
  uploadedAt: string;
  url: string;
}

interface StoredMeta {
  id: string;
  title: string;
  originalName: string;
  storedName: string;
  uploadedAt: string;
}

function moduleDir(moduleId: string): string {
  return path.join(MODULE_FILES_ROOT, moduleId);
}

function metaPath(moduleId: string): string {
  return path.join(moduleDir(moduleId), "meta.json");
}

function readMeta(moduleId: string): StoredMeta[] {
  const file = metaPath(moduleId);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMeta(moduleId: string, entries: StoredMeta[]): void {
  fs.mkdirSync(moduleDir(moduleId), { recursive: true });
  fs.writeFileSync(metaPath(moduleId), JSON.stringify(entries, null, 2));
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[/\\?%*:|"<>]/g, "-").trim();
  return base || "fichier";
}

export function listModuleFiles(moduleId: string): ModuleFileEntry[] {
  const dir = moduleDir(moduleId);
  return readMeta(moduleId)
    .filter((e) => fs.existsSync(path.join(dir, e.storedName)))
    .map((e) => {
      const stat = fs.statSync(path.join(dir, e.storedName));
      return {
        id: e.id,
        title: e.title,
        originalName: e.originalName,
        ext: path.extname(e.originalName).toLowerCase(),
        sizeKb: Math.max(1, Math.round(stat.size / 1024)),
        uploadedAt: e.uploadedAt,
        url: "/api/module-files/file/" + [moduleId, e.storedName].map(encodeURIComponent).join("/"),
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function saveModuleFile(moduleId: string, title: string, originalName: string, buffer: Buffer): ModuleFileEntry {
  const dir = moduleDir(moduleId);
  fs.mkdirSync(dir, { recursive: true });

  const safeOriginalName = sanitizeFilename(originalName);
  const ext = path.extname(safeOriginalName);
  const id = crypto.randomUUID();
  const storedName = `${id}${ext}`;
  fs.writeFileSync(path.join(dir, storedName), buffer);

  const uploadedAt = new Date().toISOString();
  const finalTitle = title.trim() || path.basename(safeOriginalName, ext);

  const entries = readMeta(moduleId);
  entries.push({ id, title: finalTitle, originalName: safeOriginalName, storedName, uploadedAt });
  writeMeta(moduleId, entries);

  const stat = fs.statSync(path.join(dir, storedName));
  return {
    id,
    title: finalTitle,
    originalName: safeOriginalName,
    ext: ext.toLowerCase(),
    sizeKb: Math.max(1, Math.round(stat.size / 1024)),
    uploadedAt,
    url: "/api/module-files/file/" + [moduleId, storedName].map(encodeURIComponent).join("/"),
  };
}

export function deleteModuleFile(moduleId: string, id: string): boolean {
  const entries = readMeta(moduleId);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;

  const [entry] = entries.splice(idx, 1);
  const dir = moduleDir(moduleId);
  const resolvedDir = path.resolve(dir);
  const resolvedTarget = path.resolve(path.join(dir, entry.storedName));
  if (resolvedTarget.startsWith(resolvedDir) && fs.existsSync(resolvedTarget)) {
    fs.unlinkSync(resolvedTarget);
  }

  writeMeta(moduleId, entries);
  return true;
}

/** Looks up the stored metadata for one file, used by the file-serving route to set a friendly download name. */
export function findModuleFileByStoredName(moduleId: string, storedName: string): StoredMeta | undefined {
  return readMeta(moduleId).find((e) => e.storedName === storedName);
}
