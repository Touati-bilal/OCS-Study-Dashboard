import fs from "fs";
import path from "path";

export interface ActivityFile {
  fileName: string;
  part: string;
  number: number | null;
  title: string;
  version: string | null;
  ext: string;
  sizeKb: number;
  url: string;
}

export interface ActivityGroup {
  part: string;
  files: ActivityFile[];
}

/**
 * Activities root: one folder per module id (e.g. `public/activities/M201`), which lives under
 * `public/` so Next.js serves the PDFs as static assets directly (no custom API route or
 * server-side file reading at request time — this works identically in dev and in any
 * production/serverless deployment, since `public/` is always shipped in full). The listing is
 * read once at build time from the server component, exactly like the course materials
 * (see materials.server.ts).
 */
export const ACTIVITIES_ROOT = path.join(process.cwd(), "public", "activities");

const ALLOWED_EXT = new Set([".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".txt"]);
const PART_LABEL: Record<string, string> = {
  activites: "Autres activités",
  support: "Support",
};

export function moduleActivitiesDir(moduleId: string): string {
  return path.join(ACTIVITIES_ROOT, moduleId);
}

export function hasModuleActivities(moduleId: string): boolean {
  return fs.existsSync(moduleActivitiesDir(moduleId));
}

/**
 * Next.js indexes the files of `public/` with `encodeURI(...)` and looks them up with that same
 * key, so a URL has to be encoded the same way: `encodeURIComponent` over-encodes the characters
 * `encodeURI` keeps literal (`+ ( ) & = , ; : @ ! ~ * '`) and those files would 404.
 * `?` and `#` are escaped too since they would otherwise truncate the URL.
 */
function encodeAssetPath(segment: string): string {
  return encodeURI(segment).replace(/[?#]/g, (char) => encodeURIComponent(char));
}

function parseActivityName(fileName: string): Omit<ActivityFile, "ext" | "sizeKb" | "url" | "fileName"> {
  const base = fileName.replace(/\.[^.]+$/, "");

  const partMatch = base.match(/^P(\d+)[-_ ]+/i);
  const part = partMatch ? `P${partMatch[1]}` : null;
  const afterPart = partMatch ? base.slice(partMatch[0].length) : base;

  const activityMatch = afterPart.match(/^ACTIVIT[ÉE]\s*(\d+)\s*[-–—:_]?\s*(.*)$/i);
  const number = activityMatch ? Number(activityMatch[1]) : null;
  const rawTitle = activityMatch ? activityMatch[2] : afterPart;

  const versionMatch = rawTitle.match(/\s*[._-](v\d+(?:\.\d+)*)$/i);
  const version = versionMatch ? versionMatch[1] : null;
  const title = cleanTitle(versionMatch ? rawTitle.slice(0, versionMatch.index) : rawTitle) || base;

  return {
    part: part ?? (number !== null ? "activites" : "support"),
    number,
    title,
    version,
  };
}

function cleanTitle(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function compareActivities(a: ActivityFile, b: ActivityFile): number {
  if (a.part !== b.part) return a.part === "support" ? 1 : b.part === "support" ? -1 : a.part.localeCompare(b.part);
  if (a.number !== b.number) {
    if (a.number === null) return 1;
    if (b.number === null) return -1;
    return a.number - b.number;
  }
  return a.fileName.localeCompare(b.fileName, "fr");
}

export function getModuleActivities(moduleId: string): ActivityFile[] {
  const root = moduleActivitiesDir(moduleId);
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && entry.isFile())
    .map((entry) => {
      const ext = path.extname(entry.name).toLowerCase();
      const stat = fs.statSync(path.join(root, entry.name));
      return {
        fileName: entry.name,
        ...parseActivityName(entry.name),
        ext,
        sizeKb: Math.max(1, Math.round(stat.size / 1024)),
        url: "/activities/" + [moduleId, entry.name].map(encodeAssetPath).join("/"),
      };
    })
    .filter((file) => ALLOWED_EXT.has(file.ext))
    .sort(compareActivities);
}

export function getModuleActivityGroups(moduleId: string): ActivityGroup[] {
  const map = new Map<string, ActivityFile[]>();
  for (const file of getModuleActivities(moduleId)) {
    if (!map.has(file.part)) map.set(file.part, []);
    map.get(file.part)!.push(file);
  }
  return Array.from(map.entries()).map(([part, files]) => ({ part: PART_LABEL[part] ?? part, files }));
}
