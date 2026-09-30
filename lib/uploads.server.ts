/**
 * Storage for the TP / Projects uploads (`uploads/<moduleId>/<category>`).
 *
 * Everything about a request that reaches this file is treated as hostile, because these routes are
 * reachable by anyone who can reach the app:
 *
 *   - `moduleId` is a *validated identifier*, never a path. It has to match
 *     `^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$`, which contains no `/`, no `.` and no `\`, so it cannot
 *     point outside the storage root. The previous version joined it straight into a path, which let
 *     a caller escape `uploads/` and write anywhere the process could reach.
 *   - The name a file is *stored* under is generated here (a random id), never taken from the
 *     client. The name the client sent is kept only as display text, with any path component
 *     stripped, and it is never used to build a path.
 *   - The resolved directory is re-checked against the storage root with a separator-anchored
 *     comparison, so even a future caller that forgets to validate `moduleId` cannot escape.
 *   - Extensions are allowlisted and the size is capped before anything is written.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Storage root. Deliberately outside `public/`, so Next never serves these files as static assets
 * and a document dropped here can never become a same-origin script.
 */
export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export type UploadCategory = "tp" | "projects";

/** The only categories a directory may hold. Also the only subdirectory names a caller can reach. */
const CATEGORIES: readonly UploadCategory[] = ["tp", "projects"];

/**
 * Extensions accepted on upload *and* on download. Anything else is refused with a 403, so a file
 * that somehow ended up on disk (a restored backup, a stray copy) still cannot be served as
 * active content.
 */
export const ALLOWED_EXTENSIONS: readonly string[] = [
  ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls", ".csv", ".zip",
  ".png", ".jpg", ".jpeg", ".gif", ".txt", ".md", ".url",
];

/** 25 MB. Rejected before the body is buffered, so a large upload cannot exhaust memory. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadedFile {
  /** Server-generated id; this is what identifies the file, and what a delete must send. */
  id: string;
  /** Human-readable name, for display only. */
  name: string;
  sizeKb: number;
  uploadedAt: string;
  category: UploadCategory;
  url: string;
}

interface StoredEntry {
  /** Name on disk, always `<id><ext>` for files written by this version. */
  storedName: string;
  /** Display name supplied by the client at upload time, path-stripped. Never used as a path. */
  originalName: string;
  uploadedAt: string;
}

/** True for an identifier this app is willing to turn into a directory. */
export function isValidModuleId(moduleId: unknown): moduleId is string {
  return typeof moduleId === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(moduleId);
}

export function isCategory(v: unknown): v is UploadCategory {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

/** Lowercased extension, or `null` when the name has none or the extension is not allowlisted. */
export function allowedExtension(name: string): string | null {
  const ext = path.extname(name).toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) return null;
  return ext;
}

/**
 * Strips a client-supplied name down to display text: basename only, no path separators, no control
 * characters, bounded length. The result is never used to build a path.
 */
export function sanitizeDisplayName(name: string): string {
  const base = path
    .basename(name)
    // Control characters, path separators and the characters Windows refuses in a filename.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\?%*:|"<>]/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return base.slice(0, 120) || "fichier";
}

/**
 * Resolves a directory inside the storage root, or throws.
 *
 * The containment test is anchored on `path.sep` on purpose: a plain `startsWith(root)` also
 * accepts a *sibling* whose name merely begins with the root's name (`uploads-backup`), which is
 * how the previous download route could be walked out of the storage root.
 */
function resolveInsideRoot(...segments: string[]): string {
  const root = path.resolve(UPLOADS_ROOT);
  const target = path.resolve(path.join(root, ...segments));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("chemin de stockage refusé");
  }
  return target;
}

function categoryDir(moduleId: string, category: UploadCategory): string {
  if (!isValidModuleId(moduleId)) throw new Error("identifiant de module invalide");
  if (!isCategory(category)) throw new Error("catégorie invalide");
  return resolveInsideRoot(moduleId, category);
}

function metaPath(moduleId: string, category: UploadCategory): string {
  return path.join(categoryDir(moduleId, category), "meta.json");
}

function readMeta(dir: string): StoredEntry[] {
  const file = path.join(dir, "meta.json");
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? (parsed as StoredEntry[]) : [];
  } catch {
    return [];
  }
}

function writeMeta(dir: string, entries: StoredEntry[]): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(entries, null, 2), { mode: 0o600 });
}

export function listUploads(moduleId: string, category: UploadCategory): UploadedFile[] {
  const dir = categoryDir(moduleId, category);
  if (!fs.existsSync(dir)) return [];
  const meta = new Map(readMeta(dir).map((entry) => [entry.storedName, entry]));
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== "meta.json")
    .map((entry) => {
      const full = path.join(dir, entry.name);
      const stat = fs.statSync(full);
      const stored = meta.get(entry.name);
      return {
        id: entry.name,
        // A file written before this version has no metadata entry; its own name is its display name.
        name: stored?.originalName ?? entry.name,
        sizeKb: Math.max(1, Math.round(stat.size / 1024)),
        uploadedAt: stored?.uploadedAt ?? stat.mtime.toISOString(),
        category,
        url: "/api/uploads/file/" + [moduleId, category, entry.name].map(encodeURIComponent).join("/"),
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * Writes one file. The name on disk is `<random id><ext>`; the client's name survives only as
 * display text. Returns the stored id.
 */
export function saveUpload(
  moduleId: string,
  category: UploadCategory,
  originalName: string,
  buffer: Buffer
): string {
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error("fichier trop volumineux");
  const ext = allowedExtension(originalName);
  if (ext === null) throw new Error("type de fichier non autorisé");

  const dir = categoryDir(moduleId, category);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const storedName = `${crypto.randomUUID()}${ext}`;
  const target = resolveInsideRoot(moduleId, category, storedName);
  fs.writeFileSync(target, buffer, { mode: 0o600 });

  const entries = readMeta(dir).filter((entry) => entry.storedName !== storedName);
  entries.push({ storedName, originalName: sanitizeDisplayName(originalName), uploadedAt: new Date().toISOString() });
  writeMeta(dir, entries);
  return storedName;
}

/** Deletes one file, addressed by the server-generated id the listing returned. */
export function deleteUpload(moduleId: string, category: UploadCategory, id: string): boolean {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  const dir = categoryDir(moduleId, category);
  const target = resolveInsideRoot(moduleId, category, id);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  fs.unlinkSync(target);
  writeMeta(dir, readMeta(dir).filter((entry) => entry.storedName !== id));
  return true;
}

/**
 * Resolves a file for download and asserts it is a real, allowlisted, regular file inside the
 * storage root. `fs.realpathSync` collapses symlinks before the containment test, so a symlink
 * planted in the storage directory cannot be used to read a file elsewhere.
 */
export function resolveUploadFileForDownload(segments: string[]): { fullPath: string; name: string } {
  if (segments.length !== 3) throw new Error("chemin invalide");
  const [moduleId, category, storedName] = segments;
  if (!isValidModuleId(moduleId) || !isCategory(category)) throw new Error("chemin invalide");
  if (!storedName || storedName.includes("/") || storedName.includes("\\") || storedName.includes("..")) {
    throw new Error("chemin invalide");
  }
  if (allowedExtension(storedName) === null) throw new Error("type de fichier non autorisé");

  const target = resolveInsideRoot(moduleId, category, storedName);
  if (!fs.existsSync(target)) throw new Error("fichier introuvable");
  const real = fs.realpathSync(target);
  const root = path.resolve(UPLOADS_ROOT);
  if (real !== root && !real.startsWith(root + path.sep)) throw new Error("chemin de stockage refusé");
  if (!fs.statSync(real).isFile()) throw new Error("fichier introuvable");

  const stored = readMeta(path.dirname(real)).find((entry) => entry.storedName === path.basename(real));
  return { fullPath: real, name: stored?.originalName ?? path.basename(real) };
}
