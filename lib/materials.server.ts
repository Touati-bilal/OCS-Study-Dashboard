import fs from "fs";
import path from "path";

export const DATA_ROOT = path.join(process.cwd(), "CyberSecurity");

export interface MaterialFile {
  name: string;
  category: string;
  ext: string;
  sizeKb: number;
  url: string;
}

const SKIP_FILES = new Set(["README.md", "PROGRESS.md", "TODO.md", ".gitkeep"]);
const ALLOWED_EXT = new Set([".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".txt", ".md"]);

export function getModuleMaterials(folder: string): MaterialFile[] {
  const moduleRoot = path.join(DATA_ROOT, folder);
  const results: MaterialFile[] = [];
  if (!fs.existsSync(moduleRoot)) return results;

  function walk(dir: string, relParts: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, [...relParts, entry.name]);
      } else {
        if (SKIP_FILES.has(entry.name)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) continue;
        const stat = fs.statSync(full);
        const relParts_ = [folder, ...relParts, entry.name];
        const category =
          relParts.length > 0 ? relParts[relParts.length - 1].replace(/^\d+\s*-\s*/, "") : "Fichiers";
        results.push({
          name: entry.name,
          category,
          ext,
          sizeKb: Math.max(1, Math.round(stat.size / 1024)),
          url: "/api/files/" + relParts_.map(encodeURIComponent).join("/"),
        });
      }
    }
  }
  walk(moduleRoot, []);
  return results;
}

export interface MaterialGroup {
  category: string;
  files: MaterialFile[];
}

export function getModuleMaterialGroups(folder: string): MaterialGroup[] {
  const files = getModuleMaterials(folder);
  const map = new Map<string, MaterialFile[]>();
  for (const f of files) {
    if (!map.has(f.category)) map.set(f.category, []);
    map.get(f.category)!.push(f);
  }
  return Array.from(map.entries()).map(([category, files]) => ({ category, files }));
}
