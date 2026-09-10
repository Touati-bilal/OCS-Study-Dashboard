"use client";

import { Card } from "@/components/ui/Card";
import type { MaterialGroup } from "@/lib/materials.server";
import { FileText, FileType2, FileSpreadsheet, File, ExternalLink, FolderOpen } from "lucide-react";

const EXT_ICON: Record<string, React.ElementType> = {
  ".pdf": FileText,
  ".docx": FileType2,
  ".doc": FileType2,
  ".pptx": FileType2,
  ".ppt": FileType2,
  ".xlsx": FileSpreadsheet,
  ".txt": File,
  ".md": File,
};

const EXT_COLOR: Record<string, string> = {
  ".pdf": "#fb7185",
  ".docx": "#48a3ff",
  ".doc": "#48a3ff",
  ".pptx": "#fbbf24",
  ".ppt": "#fbbf24",
  ".xlsx": "#34d399",
  ".txt": "#94a3b8",
  ".md": "#94a3b8",
};

export function MaterialsList({ groups }: { groups: MaterialGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <FolderOpen size={22} className="text-ink/30" />
        <p className="text-sm text-ink/50">Aucun document trouvé dans ce dossier.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.category}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">
            <FolderOpen size={13} /> {group.category}
          </p>
          <div className="flex flex-col gap-2">
            {group.files.map((file) => {
              const Icon = EXT_ICON[file.ext] ?? File;
              const color = EXT_COLOR[file.ext] ?? "#94a3b8";
              return (
                <a
                  key={file.url}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card hover className="flex items-center gap-3 p-3.5">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: color + "1f" }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink/85">{file.name}</p>
                      <p className="text-[11px] text-ink/40">{file.sizeKb} Ko</p>
                    </div>
                    <ExternalLink size={15} className="shrink-0 text-ink/30" />
                  </Card>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
