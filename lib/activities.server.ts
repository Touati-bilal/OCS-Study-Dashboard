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

const ALLOWED_EXT = new Set([".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".txt"]);
const PART_LABEL: Record<string, string> = {
  activites: "Autres activités",
  support: "Support",
};

export function moduleActivitiesDir(moduleId: string): string {
  return path.join(process.cwd(), `${moduleId}-Active`);
}

export function hasModuleActivities(moduleId: string): boolean {
  return fs.existsSync(moduleActivitiesDir(moduleId));
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
        url: `/api/activities/file/${[moduleId, entry.name].map(encodeURIComponent).join("/")}`,
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

export function resolveActivityPath(moduleId: string, fileName: string): string | null {
  const root = path.resolve(moduleActivitiesDir(moduleId));
  const target = path.resolve(path.join(root, path.basename(fileName)));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return target;
}
