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
  Download,
  Trash2,
  UploadCloud,
  FolderOpen,
  X,
} from "lucide-react";

interface ModuleFile {
  id: string;
  title: string;
  originalName: string;
  ext: string;
  sizeKb: number;
  uploadedAt: string;
  url: string;
}

interface PendingFile {
  key: string;
  file: File;
  title: string;
}

const EXT_ICON: Record<string, React.ElementType> = {
  ".pdf": FileText,
  ".docx": FileType2,
  ".doc": FileType2,
  ".pptx": FileType2,
  ".ppt": FileType2,
  ".xlsx": FileSpreadsheet,
  ".xls": FileSpreadsheet,
  ".zip": FileArchive,
  ".png": ImageIcon,
  ".jpg": ImageIcon,
  ".jpeg": ImageIcon,
  ".gif": ImageIcon,
};

function nameWithoutExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function FilesSection({ moduleId }: { moduleId: string }) {
  const [files, setFiles] = useState<ModuleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/module-files?moduleId=${encodeURIComponent(moduleId)}`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files ?? []);
    }
    setLoading(false);
  }, [moduleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handlePick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const additions: PendingFile[] = Array.from(fileList).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      title: nameWithoutExt(file.name),
    }));
    setPending((prev) => [...prev, ...additions]);
  }

  function updatePendingTitle(key: string, title: string) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, title } : p)));
  }

  function removePending(key: string) {
    setPending((prev) => prev.filter((p) => p.key !== key));
  }

  async function confirmUpload() {
    if (pending.length === 0) return;
    setSaving(true);
    for (const p of pending) {
      const formData = new FormData();
      formData.append("moduleId", moduleId);
      formData.append("title", p.title);
      formData.append("file", p.file);
      await fetch("/api/module-files", { method: "POST", body: formData });
    }
    setPending([]);
    setSaving(false);
    await refresh();
  }

  async function handleDelete(id: string) {
    await fetch("/api/module-files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, id }),
    });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
          <FolderOpen size={13} className="text-brand-400" /> Les Fichiers
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 rounded-full bg-brand-400/20 px-2.5 py-1 text-[11px] font-medium text-brand-400"
        >
          <UploadCloud size={12} /> Importer
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handlePick(e.target.files);
          e.target.value = "";
        }}
      />

      {pending.length > 0 && (
        <Card hover={false} className="flex flex-col gap-2.5 p-3">
          <p className="text-[11px] font-medium text-white/50">
            Donnez un nom à chaque fichier avant de l'enregistrer :
          </p>
          {pending.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <input
                type="text"
                value={p.title}
                onChange={(e) => updatePendingTitle(p.key, e.target.value)}
                placeholder="Nom du fichier"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/85 outline-none focus:border-brand-400/50"
              />
              <span className="shrink-0 text-[10px] text-white/30">{p.file.name}</span>
              <button
                onClick={() => removePending(p.key)}
                className="shrink-0 rounded-full p-1 text-white/30 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={confirmUpload}
            disabled={saving}
            className="mt-1 self-start rounded-full bg-brand-400 px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : `Enregistrer ${pending.length} fichier${pending.length > 1 ? "s" : ""}`}
          </button>
        </Card>
      )}

      {!loading && files.length === 0 && pending.length === 0 && (
        <Card hover={false} className="p-4 text-center text-xs text-white/40">
          Aucun fichier importé pour ce module.
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {files.map((file) => {
          const Icon = EXT_ICON[file.ext] ?? File;
          return (
            <Card key={file.id} hover={false} className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/10">
                <Icon size={16} className="text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/85">{file.title}</p>
                <p className="text-[11px] text-white/40">
                  {file.ext.replace(".", "").toUpperCase() || "FICHIER"} · {file.sizeKb} Ko · {formatDate(file.uploadedAt)}
                </p>
              </div>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvrir"
                className="shrink-0 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70"
              >
                <ExternalLink size={14} />
              </a>
              <a
                href={`${file.url}?download=1`}
                download={file.originalName}
                title="Télécharger"
                className="shrink-0 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70"
              >
                <Download size={14} />
              </a>
              <button
                onClick={() => handleDelete(file.id)}
                title="Supprimer"
                className="shrink-0 rounded-full p-1.5 text-white/30 hover:bg-rose-500/10 hover:text-rose-400"
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
