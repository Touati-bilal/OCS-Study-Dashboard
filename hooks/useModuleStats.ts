"use client";

import { useMemo } from "react";
import {
  useAppStore,
  computeModuleProgress,
  computeModuleHoursProgress,
  isModuleHoursCompleted,
  computeIsModuleStarted,
  countCompletedObjectives,
  countCompletedChapters,
} from "@/store/useAppStore";
import { ModuleDef, countObjectives, getModulesForOption, isOccOrsModule } from "@/lib/modules";
import { computeFinalGrade } from "@/lib/grades";

export interface ModuleStat {
  module: ModuleDef;
  progress: number;
  hoursStudied: number;
  started: boolean;
  completed: boolean;
  ccGrade: number | null;
  efmGrade: number | null;
  finalGrade: number | null;
  completedChapters: number;
  totalChapters: number;
  completedObjectives: number;
  totalObjectives: number;
}

export function useModuleStats(modules?: ModuleDef[]): ModuleStat[] {
  const moduleState = useAppStore((s) => s.modules);
  const studyOption = useAppStore((s) => s.studyOption);
  const resolvedModules = modules ?? getModulesForOption(studyOption);

  return useMemo(() => {
    return resolvedModules.map((module) => {
      const runtime = moduleState[module.id];
      const totalObjectives = countObjectives(module);
      const usesHoursProgress = !isOccOrsModule(module.id);
      const progress = usesHoursProgress
        ? computeModuleHoursProgress(runtime, module.duration)
        : computeModuleProgress(runtime, totalObjectives);
      const started = computeIsModuleStarted(runtime);
      return {
        module,
        progress,
        hoursStudied: runtime?.hoursStudied ?? 0,
        started,
        completed: usesHoursProgress ? isModuleHoursCompleted(runtime, module.duration) : progress >= 100,
        ccGrade: runtime?.ccGrade ?? null,
        efmGrade: runtime?.efmGrade ?? null,
        finalGrade: computeFinalGrade(runtime?.ccGrade ?? null, runtime?.efmGrade ?? null),
        completedChapters: countCompletedChapters(module.chapters, runtime),
        totalChapters: module.chapters.length,
        completedObjectives: countCompletedObjectives(runtime),
        totalObjectives,
      };
    });
  }, [resolvedModules, moduleState]);
}

export function useAggregateStats(modules?: ModuleDef[]) {
  const stats = useModuleStats(modules);
  return useMemo(() => {
    const totalHours = stats.reduce((sum, s) => sum + s.hoursStudied, 0);
    const started = stats.filter((s) => s.started);
    const completed = stats.filter((s) => s.completed);
    const inProgress = started.filter((s) => !s.completed);
    const remaining = stats.filter((s) => !s.started);
    const overallProgress =
      stats.length > 0 ? Math.round(stats.reduce((sum, s) => sum + s.progress, 0) / stats.length) : 0;
    return {
      totalHours,
      overallProgress,
      startedCount: started.length,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      remainingCount: remaining.length,
      totalCount: stats.length,
    };
  }, [stats]);
}
