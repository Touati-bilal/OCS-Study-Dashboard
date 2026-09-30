"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UploadCategory = "tp" | "projects";

export interface UploadedFile {
  /** Server-generated id. This is what identifies the file, and what a delete must send. */
  id: string;
  /** Display name only. */
  name: string;
  sizeKb: number;
  uploadedAt: string;
  category: UploadCategory;
  url: string;
}

/**
 * Runtime access to `uploads/<moduleId>/<category>` through the existing `/api/uploads` routes.
 * Shared by the "TP & Projects" tab (OCC / ORS) and by the OCS "Documents → Proger" section, so
 * both use the exact same storage and the same behaviour.
 */
export function useModuleUploads(moduleId: string) {
  const [tp, setTp] = useState<UploadedFile[]>([]);
  const [projects, setProjects] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<UploadCategory | null>(null);
  // The file APIs require the signed-in owner account, so the section says so instead of silently
  // showing an empty list.
  const [authRequired, setAuthRequired] = useState(false);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/uploads?moduleId=${encodeURIComponent(moduleId)}`);
    if (res.status === 401) {
      setAuthRequired(true);
      setTp([]);
      setProjects([]);
    } else if (res.ok) {
      setAuthRequired(false);
      const data = await res.json();
      setTp(data.tp ?? []);
      setProjects(data.projects ?? []);
    }
    setLoading(false);
  }, [moduleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function upload(category: UploadCategory, file: File) {
    setUploading(category);
    const formData = new FormData();
    formData.append("moduleId", moduleId);
    formData.append("category", category);
    formData.append("file", file);
    await fetch("/api/uploads", { method: "POST", body: formData });
    await refresh();
    setUploading(null);
  }

  async function remove(category: UploadCategory, id: string) {
    const res = await fetch("/api/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, category, id }),
    });
    if (res.status === 401) setAuthRequired(true);
    await refresh();
  }

  return {
    tp,
    projects,
    loading,
    uploading,
    authRequired,
    upload,
    remove,
    tpInputRef,
    projectInputRef,
  };
}
