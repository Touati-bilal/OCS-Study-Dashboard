"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { FileText, FileType2, FileSpreadsheet, File, ExternalLink, Download, FolderOpen, Clock3 } from "lucide-react";

interface ActivityFile {
  fileName: string;
  part: string;
  number: number | null;
  title: string;
  version: string | null;
  ext: string;
  sizeKb: number;
  url: string;
}

interface ActivityGroup {
  part: string;
  files: ActivityFile[];
}

const EXT_ICON: Record<string, React.ElementType> = {
  ".pdf": FileText,
  ".docx": FileType2,
  ".doc": FileType2,
  ".pptx": FileType2,
  ".ppt": FileType2,
  ".xlsx": FileSpreadsheet,
  ".txt": File,
};

const EXT_COLOR: Record<string, string> = {
  ".pdf": "#fb7185",
  ".docx": "#48a3ff",
  ".doc": "#48a3ff",
  ".pptx": "#fbbf24",
  ".ppt": "#fbbf24",
  ".xlsx": "#34d399",
  ".txt": "#94a3b8",
};

export function ActivitiesSection({ moduleId, color }: { moduleId: string; color: string }) {
  const [groups, setGroups] = useState<ActivityGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/activities?moduleId=${encodeURIComponent(moduleId)}`);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch {
      setFailed(true);
    }
  }, [moduleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (groups === null) {
    if (failed) {
      return (
        <Card hover={false} className="p-4 text-center text-xs text-ink/40">
          Impossible de charger les activités pour le moment.
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-ink/[0.05]" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Card hover={false} className="flex flex-col items-center gap-2 p-8 text-center">
        <FolderOpen size={24} style={{ color }} />
        <p className="font-display text-base font-semibold text-ink/85">Tsenaw Update</p>
        <p className="max-w-sm text-xs leading-relaxed text-ink/45">
          Les activités de ce module ne sont pas encore disponibles. Elles seront ajoutées dès
          qu&apos;elles seront communiquées.
        </p>
      </Card>
    );
  }

  const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">
          <FolderOpen size={13} style={{ color }} /> Les Activités
        </p>
        <span className="text-[11px] text-ink/40">{totalFiles} fichiers</span>
      </div>

      {groups.map((group) => (
        <div key={group.part}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">
            {group.part}
          </p>
          <div className="flex flex-col gap-2">
            {group.files.map((file, i) => {
              const Icon = EXT_ICON[file.ext] ?? File;
              const iconColor = EXT_COLOR[file.ext] ?? "#94a3b8";
              return (
                <Card key={file.url} delay={0.04 * i} className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: iconColor + "1f" }}
                    >
                      <Icon size={18} style={{ color: iconColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink/85">
                        {file.number !== null ? `Activité ${file.number} — ` : ""}
                        {file.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink/40">
                        <Clock3 size={11} /> {file.sizeKb} Ko
                        {file.version && <span className="rounded-full bg-ink/[0.07] px-1.5 py-px">{file.version}</span>}
                      </p>
                    </div>
                    <a
                      href={`${file.url}?download=1`}
                      download={file.fileName}
                      title="Télécharger"
                      className="shrink-0 rounded-full p-1.5 text-ink/30 hover:bg-ink/10 hover:text-ink/70"
                    >
                      <Download size={15} />
                    </a>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir l'activité"
                      className="shrink-0 rounded-full p-1.5 text-ink/30 hover:bg-ink/10 hover:text-ink/70"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                  <p className="mt-2 truncate text-[10px] text-ink/30" title={file.fileName}>
                    {file.fileName}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
