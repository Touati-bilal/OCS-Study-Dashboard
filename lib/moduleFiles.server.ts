/**
 * "Les Fichiers" storage: user-uploaded documents (e.g. PDFs handed out by teachers),
 * kept fully separate from the theoretical course materials in `public/materials`
 * (see materials.server.ts) and from the TP/Projects uploads (see uploads.server.ts).
 * Each module gets its own folder plus a meta.json carrying the user-chosen title and
 * upload date, since the file on disk is renamed to an id to avoid collisions.
 *
 * Everything here treats its input as hostile. `moduleId` is validated as an identifier and never
 * joined into a path unchecked, the name on disk is always generated here, extensions are
 * allowlisted, the size is capped, and every resolved path is re-checked against the storage root
 * with a separator-anchored comparison (a plain `startsWith(root)` also accepts a sibling directory
 * whose name merely begins with the root's name).
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Storage root. Deliberately outside `public/`, so Next never serves these files as static assets
 * and a document dropped here can never become a same-origin script.
 *
 * Overridable with `STUDY_UPLOADS_DIR`, and it must follow that directory: the two stores share one
 * parent, so pointing only one of them elsewhere would split the owner's files across two trees.
 * `PRV_UPLOADS_DIR` is still read as a fallback, so an existing environment keeps working.
 */
export const MODULE_FILES_ROOT = path.join(
  path.resolve(
    process.env.STUDY_UPLOADS_DIR?.trim() || process.env.PRV_UPLOADS_DIR?.trim() || path.join(process.cwd(), "uploads")
  ),
  "module-files"
);

/** Extensions accepted on upload and on download. Anything else is refused. */
export const ALLOWED_EXTENSIONS: readonly string[] = [
  ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls", ".csv", ".zip",
  ".png", ".jpg", ".jpeg", ".gif", ".txt", ".md", ".url",
];

/** 25 MB, checked before the body is buffered. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

/**
 * Names already used by the storage layout itself. Refused here for the same reason as in
 * `uploads.server.ts`: a `moduleId` that names a storage root would nest one store inside the other,
 * putting files where the other store's meta cannot see them.
 */
const RESERVED_MODULE_IDS: ReadonlySet<string> = new Set(["uploads", "module-files"]);

/** True for an identifier this app is willing to turn into a directory. */
export function isValidModuleId(moduleId: unknown): moduleId is string {
  return (
    typeof moduleId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(moduleId) &&
    !RESERVED_MODULE_IDS.has(moduleId.toLowerCase())
  );
}

/** Lowercased extension, or `null` when the name has none or the extension is not allowlisted. */
export function allowedExtension(name: string): string | null {
  const ext = path.extname(name).toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) return null;
  return ext;
}

/** Display text only: basename, no path separators or control characters, bounded length. */
function sanitizeDisplayName(name: string): string {
  const base = path
    .basename(name)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\?%*:|"<>]/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return base.slice(0, 120) || "fichier";
}

/** Resolves a path inside the storage root, or throws. Anchored on `path.sep` on purpose. */
function resolveInsideRoot(...segments: string[]): string {
  const root = path.resolve(MODULE_FILES_ROOT);
  const target = path.resolve(path.join(root, ...segments));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("chemin de stockage refusé");
  }
  return target;
}

function moduleDir(moduleId: string): string {
  if (!isValidModuleId(moduleId)) throw new Error("identifiant de module invalide");
  return resolveInsideRoot(moduleId);
}

function metaPath(moduleId: string): string {
  return path.join(moduleDir(moduleId), "meta.json");
}

function readMeta(moduleId: string): StoredMeta[] {
  const file = metaPath(moduleId);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? (parsed as StoredMeta[]) : [];
  } catch {
    return [];
  }
}

function writeMeta(moduleId: string, entries: StoredMeta[]): void {
  const dir = moduleDir(moduleId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(entries, null, 2), { mode: 0o600 });
}

export function listModuleFiles(moduleId: string): ModuleFileEntry[] {
  const dir = moduleDir(moduleId);
  return readMeta(moduleId)
    .filter((entry) => allowedExtension(entry.storedName) !== null)
    .filter((entry) => {
      const full = path.join(dir, entry.storedName);
      return fs.existsSync(full) && fs.statSync(full).isFile();
    })
    .map((entry) => {
      const stat = fs.statSync(path.join(dir, entry.storedName));
      return {
        // The stored name, not the bare id, so this matches `/api/uploads`: one identifier that is
        // simultaneously what a delete addresses and what the download URL contains.
        id: entry.storedName,
        title: entry.title,
        originalName: entry.originalName,
        ext: path.extname(entry.originalName).toLowerCase(),
        sizeKb: Math.max(1, Math.round(stat.size / 1024)),
        uploadedAt: entry.uploadedAt,
        url: "/api/module-files/file/" + [moduleId, entry.storedName].map(encodeURIComponent).join("/"),
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function saveModuleFile(
  moduleId: string,
  title: string,
  originalName: string,
  buffer: Buffer
): ModuleFileEntry {
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error("fichier trop volumineux");
  const ext = allowedExtension(originalName);
  if (ext === null) throw new Error("type de fichier non autorisé");

  const dir = moduleDir(moduleId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  // The name on disk is generated here. The client's name is display text only.
  const id = crypto.randomUUID();
  const storedName = `${id}${ext}`;
  fs.writeFileSync(resolveInsideRoot(moduleId, storedName), buffer, { mode: 0o600 });

  const uploadedAt = new Date().toISOString();
  const safeOriginalName = sanitizeDisplayName(originalName);
  const finalTitle = title.trim().slice(0, 200) || path.basename(safeOriginalName, ext);

  const entries = readMeta(moduleId);
  entries.push({ id, title: finalTitle, originalName: safeOriginalName, storedName, uploadedAt });
  writeMeta(moduleId, entries);

  const stat = fs.statSync(path.join(dir, storedName));
  return {
    id: storedName,
    title: finalTitle,
    originalName: safeOriginalName,
    ext,
    sizeKb: Math.max(1, Math.round(stat.size / 1024)),
    uploadedAt,
    url: "/api/module-files/file/" + [moduleId, storedName].map(encodeURIComponent).join("/"),
  };
}

export function deleteModuleFile(moduleId: string, id: string): boolean {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  const entries = readMeta(moduleId);
  // Matched on `storedName`, which is what the API now hands out as the id. The bare `entry.id` is
  // still accepted so documents stored before this change remain deletable.
  const idx = entries.findIndex((entry) => entry.storedName === id || entry.id === id);
  if (idx === -1) return false;

  const [entry] = entries.splice(idx, 1);
  try {
    const target = resolveInsideRoot(moduleId, entry.storedName);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.unlinkSync(target);
  } catch {
    // A path that would escape the root is simply not deleted; the entry is still removed.
  }

  writeMeta(moduleId, entries);
  return true;
}

/**
 * Resolves a file for download: a real, allowlisted, regular file inside the storage root, with
 * symlinks collapsed first so a planted symlink cannot be used to read something else.
 */
export function resolveModuleFileForDownload(segments: string[]): { fullPath: string; name: string } {
  if (segments.length !== 2) throw new Error("chemin invalide");
  const [moduleId, storedName] = segments;
  if (!isValidModuleId(moduleId)) throw new Error("chemin invalide");
  if (!storedName || storedName.includes("/") || storedName.includes("\\") || storedName.includes("..")) {
    throw new Error("chemin invalide");
  }
  if (allowedExtension(storedName) === null) throw new Error("type de fichier non autorisé");

  const target = resolveInsideRoot(moduleId, storedName);
  if (!fs.existsSync(target)) throw new Error("fichier introuvable");
  const real = fs.realpathSync(target);
  const root = path.resolve(MODULE_FILES_ROOT);
  if (real !== root && !real.startsWith(root + path.sep)) throw new Error("chemin de stockage refusé");
  if (!fs.statSync(real).isFile()) throw new Error("fichier introuvable");

  const meta = readMeta(moduleId).find((entry) => entry.storedName === path.basename(real));
  return { fullPath: real, name: meta?.originalName ?? path.basename(real) };
}
