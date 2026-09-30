/**
 * Builds a PRV snapshot from the *real* store, in the browser.
 *
 * The study data lives in `localStorage` via Zustand and the server cannot read it, so the client
 * reads it here and posts it to the authorised PRV endpoint. This module is the only place that
 * reads the store for PRV, and it reads nothing it does not need: task fields, module hours and
 * objective flags, quiz scores, and the owner's own journal notes.
 *
 * It is deliberately a plain function rather than a hook, so it can be called from a click handler
 * at the exact moment a report is requested, instead of subscribing to the whole store.
 */

import { getMainModules } from "@/lib/modules";
import { quizKey } from "@/lib/quizzes";
import { emptySnapshot, type PrvSnapshot } from "@/lib/prv/snapshot";
import { useAppStore } from "@/store/useAppStore";

export function collectSnapshot(): PrvSnapshot {
  const state = useAppStore.getState();

  // Only the OCS main modules are reported, so an OCC/ORS store cannot leak into the PRV report.
  const ocsModuleIds = new Set(getMainModules("OCS").map((module) => module.id));

  const snapshot = emptySnapshot();
  snapshot.generatedAt = new Date().toISOString();

  /**
   * Tasks are filtered exactly like every other source of study data.
   *
   * A task attached to an OCC/ORS/EGTS module is dropped outright, because the report would
   * otherwise carry another exam's titles, notes and deadlines into the OCS PRV and on to the AI
   * prompt. A task with no module at all is kept: those are the owner's general study tasks, which
   * genuinely belong to the weekly review, and there is no way to attribute them to another exam.
   */
  snapshot.tasks = state.tasks
    .filter((task) => task.moduleId === null || task.moduleId === undefined || ocsModuleIds.has(task.moduleId))
    .map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      moduleId: task.moduleId,
      chapterId: task.chapterId,
      deadline: task.deadline,
      priority: task.priority,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      notes: task.notes,
      source: task.source,
    }));

  for (const [moduleId, runtime] of Object.entries(state.modules ?? {})) {
    if (!ocsModuleIds.has(moduleId)) continue;
    snapshot.moduleRuntime[moduleId] = {
      hoursStudied: runtime.hoursStudied ?? 0,
      objectiveStatus: { ...(runtime.objectiveStatus ?? {}) },
    };
  }

  // Chapter results are stored flat as `moduleId:chapterId` and regrouped for the report.
  for (const [key, result] of Object.entries(state.chapterQuizResults ?? {})) {
    const separator = key.indexOf(":");
    if (separator === -1) continue;
    const moduleId = key.slice(0, separator);
    const chapterId = key.slice(separator + 1);
    if (!ocsModuleIds.has(moduleId)) continue;
    if (!snapshot.chapterQuiz[moduleId]) snapshot.chapterQuiz[moduleId] = {};
    snapshot.chapterQuiz[moduleId][chapterId] = result;
  }

  for (const [moduleId, result] of Object.entries(state.quizResults ?? {})) {
    if (ocsModuleIds.has(moduleId)) snapshot.legacyQuiz[moduleId] = result;
  }

  snapshot.journal = (state.journalEntries ?? []).map((entry) => ({
    date: entry.date,
    notUnderstood: entry.notUnderstood ?? "",
    questions: entry.questions ?? "",
    notes: entry.notes ?? "",
    problems: entry.problems ?? "",
  }));

  return snapshot;
}

export { quizKey };
