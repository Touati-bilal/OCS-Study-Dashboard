"use client";

import { useCallback, useState } from "react";

import { collectSnapshot } from "@/lib/prv/collect";
import type { Observations } from "@/lib/prv/observations";
import { getLastCompletedWeek, todayIso } from "@/lib/prv/weekly";
import type { ReportSettings } from "@/lib/prv/trajectory";

/**
 * Talks to the PRV API from the browser.
 *
 * Every call goes to a route that re-checks the session server-side, so a 401 here means the
 * session expired and the owner has to unlock again - the hook surfaces that by reloading rather
 * than trying to work around it.
 */
export function usePrv() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(url, { cache: "no-store", ...init });
        if (response.status === 401) {
          // The session is gone: send the owner back to the unlock screen.
          if (typeof window !== "undefined") window.location.assign("/prv/deverrouiller");
          return null;
        }
        const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
        if (!response.ok) {
          setError(payload?.error ?? "La requête a échoué.");
          return null;
        }
        return payload;
      } catch {
        setError("Connexion impossible. Réessayez.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  /**
   * Generates a report for a period from the real store, read here in the browser.
   *
   * `start`/`end` name any range; omitting `weekEnd` sends the anchor as before, and omitting both
   * asks the server for the last completed week. The snapshot is collected at click time rather than
   * subscribed to, so the figures reflect the store exactly as it is when the button is pressed.
   */
  const generateReport = useCallback(
    (options: { start?: string; end?: string; weekEnd?: string; settings?: ReportSettings } = {}) => {
      const body: Record<string, unknown> = { snapshot: collectSnapshot() };
      if (options.start && options.end) {
        body.start = options.start;
        body.end = options.end;
      } else {
        body.weekEnd = options.weekEnd ?? todayIso();
      }
      if (options.settings) body.settings = options.settings;
      return request<{ key: string; weekStart: string; weekEnd: string; generation: number; empty: boolean }>(
        "/api/prv/reports",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
    },
    [request]
  );

  const listReports = useCallback(
    () => request<{ reports: unknown[]; trend: unknown[] }>("/api/prv/reports"),
    [request]
  );

  const getReport = useCallback(
    (ref: string) => request<Record<string, unknown>>(`/api/prv/reports/${encodeURIComponent(ref)}`),
    [request]
  );

  /** Saves the owner's notes for an existing period. Nothing else about the report is recomputed. */
  const saveReportNotes = useCallback(
    (ref: string, observations: Observations) =>
      request<{ key: string; observations: Observations; updatedAt: string }>(
        `/api/prv/reports/${encodeURIComponent(ref)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ observations }),
        }
      ),
    [request]
  );

  const analyze = useCallback(
    (ref: string) =>
      request<{ status: string; interpretation: string[]; focus: string[] }>(
        `/api/prv/ai/analyze/${encodeURIComponent(ref)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      ),
    [request]
  );

  const proposeTasks = useCallback(
    (note: string) =>
      request<{
        status: string;
        requiresConfirmation: true;
        proposals: Array<{ title: string; description: string; priority: string; moduleId: string | null; rationale: string }>;
        message?: string;
      }>("/api/prv/ai/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: collectSnapshot(), note }),
      }),
    [request]
  );

  const lock = useCallback(async () => {
    await request<{ ok: boolean }>("/api/prv/lock", { method: "POST" });
    if (typeof window !== "undefined") window.location.assign("/prv/deverrouiller");
  }, [request]);

  return {
    busy,
    error,
    request,
    generateReport,
    listReports,
    getReport,
    saveReportNotes,
    analyze,
    proposeTasks,
    lock,
  };
}

/**
 * The download URL for a report's PDF.
 *
 * It needs the opaque `downloadId`, never just the period: the route refuses a request without the
 * matching id, so a URL that leaks through the history list cannot fetch anything on its own.
 * `format=rapport` selects the structured A–F document; the default stays the weekly summary.
 */
export function pdfUrl(ref: string, downloadId: string, format: "rapport" | "summary" = "summary"): string {
  const base = `/api/prv/reports/${encodeURIComponent(ref)}/pdf?d=${encodeURIComponent(downloadId)}`;
  return format === "summary" ? base : `${base}&format=rapport`;
}

export { getLastCompletedWeek };
