"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Info, Loader2 } from "lucide-react";

import { PrvEmpty, PrvNotice, PrvPanel } from "@/components/prv/PrvPanel";
import { useAppStore } from "@/store/useAppStore";

interface ObsidianNote {
  moduleId: string;
  code: string;
  name: string;
  path: string;
  href: string | null;
}

/**
 * PRV · Obsidian.
 *
 * The vault configuration and the deep links come from a session-protected server route, so neither
 * the vault name nor any local path is part of the public page. What is shown is the vault-*relative*
 * note path, which is what you would type in Obsidian, plus a desktop deep link when one exists.
 */
export default function PrvObsidianPage() {
  const tasks = useAppStore((state) => state.tasks);
  const [data, setData] = useState<{ configured: boolean; notes: ObsidianNote[]; weekly: { path: string; href: string | null }; hint: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prv/obsidian", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("refused"))))
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError("Configuration Obsidian indisponible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTasks = tasks.filter((task) => task.status !== "completed").slice(0, 20);

  return (
    <div className="space-y-5">
      <PrvPanel title="Obsidian" subtitle="Raccourcis vers vos notes de travail.">
        {error && <PrvNotice tone="warn">{error}</PrvNotice>}
        {!data && !error && (
          <div className="flex items-center gap-2 text-sm text-ink/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        )}
        {data && (
          data.configured ? (
            <PrvNotice tone="good">Coffre configuré. Les liens ci-dessous ouvrent Obsidian sur ordinateur.</PrvNotice>
          ) : (
            <PrvNotice tone="info">
              Aucun coffre configuré. Définissez{" "}
              <code className="rounded bg-ink/10 px-1">PRV_OBSIDIAN_VAULT</code> (et facultativement{" "}
              <code className="rounded bg-ink/10 px-1">PRV_OBSIDIAN_ROOT</code>) dans l&apos;environnement
              du serveur pour activer les liens profonds. Aucun chemin n&apos;est exposé par défaut.
            </PrvNotice>
          )
        )}
        {data && <p className="mt-2 text-[11px] leading-relaxed text-ink/45">{data.hint}</p>}
      </PrvPanel>

      {data && (
        <PrvPanel title="Rapport hebdomadaire" subtitle="Point d'entrée du compte rendu dans vos notes.">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-ink/5 px-2 py-1 text-[11px] text-ink/70">{data.weekly.path}</code>
            {data.weekly.href ? (
              <a
                href={data.weekly.href}
                className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-ink/[0.07] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.12]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans Obsidian
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink/40">
                <Info className="h-3.5 w-3.5" /> Lien indisponible
              </span>
            )}
          </div>
        </PrvPanel>
      )}

      {data && (
        <PrvPanel title="Par module" subtitle="Chemin de la note de préparation de chaque module.">
          <ul className="space-y-1.5">
            {data.notes.map((note) => (
              <li key={note.moduleId} className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-ink/5 px-2 py-1 text-[11px] text-ink/70">
                  {note.path}
                </code>
                {note.href && (
                  <a
                    href={note.href}
                    aria-label={`Ouvrir ${note.code} dans Obsidian`}
                    className="shrink-0 rounded-lg p-1.5 text-ink/40 transition-colors hover:text-teal-600 dark:hover:text-teal-300"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </PrvPanel>
      )}

      <PrvPanel title="À consigner" subtitle="Vos tâches ouvertes, pour les reporter dans vos notes.">
        {openTasks.length === 0 ? (
          <PrvEmpty>Aucune tâche ouverte à consigner.</PrvEmpty>
        ) : (
          <ul className="space-y-1">
            {openTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-xs text-ink/75">
                <Info className="h-3.5 w-3.5 shrink-0 text-ink/30" />
                <span className="truncate">{task.title}</span>
                {task.moduleId && <span className="ml-auto text-[10px] text-ink/40">{task.moduleId}</span>}
              </li>
            ))}
          </ul>
        )}
      </PrvPanel>
    </div>
  );
}
