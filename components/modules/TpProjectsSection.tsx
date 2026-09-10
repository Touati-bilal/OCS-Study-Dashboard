"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  FileText,
  FileType2,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  File,
  ExternalLink,
  Trash2,
  UploadCloud,
  FlaskConical,
  FolderKanban,
} from "lucide-react";

interface UploadedFile {
  name: string;
  sizeKb: number;
  uploadedAt: string;
  category: "tp" | "projects";
  url: string;
}

const EXT_ICON: Record<string, React.ElementType> = {
  ".pdf": FileText,
  ".docx": FileType2,
  ".doc": FileType2,
  ".pptx": FileType2,
  ".ppt": FileType2,
  ".xlsx": FileSpreadsheet,
  ".zip": FileArchive,
  ".png": ImageIcon,
  ".jpg": ImageIcon,
  ".jpeg": ImageIcon,
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function TpProjectsSection({ moduleId }: { moduleId: string }) {
  const [tp, setTp] = useState<UploadedFile[]>([]);
  const [projects, setProjects] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"tp" | "projects" | null>(null);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/uploads?moduleId=${encodeURIComponent(moduleId)}`);
    if (res.ok) {
      const data = await res.json();
      setTp(data.tp ?? []);
      setProjects(data.projects ?? []);
    }
    setLoading(false);
  }, [moduleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpload(category: "tp" | "projects", file: File) {
    setUploading(category);
    const formData = new FormData();
    formData.append("moduleId", moduleId);
    formData.append("category", category);
    formData.append("file", file);
    await fetch("/api/uploads", { method: "POST", body: formData });
    await refresh();
    setUploading(null);
  }

  async function handleDelete(category: "tp" | "projects", filename: string) {
    await fetch("/api/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, category, filename }),
    });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <UploadGroup
        title="TP"
        icon={FlaskConical}
        color="#48a3ff"
        files={tp}
        loading={loading}
        uploading={uploading === "tp"}
        onPick={() => tpInputRef.current?.click()}
        onDelete={(name) => handleDelete("tp", name)}
      />
      <input
        ref={tpInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload("tp", file);
          e.target.value = "";
        }}
      />

      <UploadGroup
        title="Projets"
        icon={FolderKanban}
        color="#a78bfa"
        files={projects}
        loading={loading}
        uploading={uploading === "projects"}
        onPick={() => projectInputRef.current?.click()}
        onDelete={(name) => handleDelete("projects", name)}
      />
      <input
        ref={projectInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload("projects", file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function UploadGroup({
  title,
  icon: SectionIcon,
  color,
  files,
  loading,
  uploading,
  onPick,
  onDelete,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  files: UploadedFile[];
  loading: boolean;
  uploading: boolean;
  onPick: () => void;
  onDelete: (filename: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">
          <SectionIcon size={13} style={{ color }} /> {title}
        </p>
        <button
          onClick={onPick}
          disabled={uploading}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
          style={{ backgroundColor: color + "22", color }}
        >
          <UploadCloud size={12} /> {uploading ? "Envoi..." : "Importer"}
        </button>
      </div>

      {!loading && files.length === 0 && (
        <Card hover={false} className="p-4 text-center text-xs text-ink/40">
          Aucun fichier {title.toLowerCase()} importé.
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {files.map((file) => {
          const Icon = EXT_ICON[extOf(file.name)] ?? File;
          return (
            <Card key={file.name} hover={false} className="flex items-center gap-3 p-3">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + "1f" }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink/85">{file.name}</p>
                  <p className="text-[11px] text-ink/40">
                    {file.sizeKb} Ko · {formatDate(file.uploadedAt)}
                  </p>
                </div>
                <ExternalLink size={14} className="shrink-0 text-ink/30" />
              </a>
              <button
                onClick={() => onDelete(file.name)}
                className="shrink-0 rounded-full p-1.5 text-ink/30 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 size={14} />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
