"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";

import { PrvEmpty, PrvNotice, PrvPanel, PrvStat } from "@/components/prv/PrvPanel";
import { Button } from "@/components/ui/Button";
import { isTaskOverdue, sortTasksByRelevance } from "@/lib/tasks";
import { useAppStore } from "@/store/useAppStore";

/**
 * PRV · Tâches.
 *
 * This is a *view* of the real task store, not a copy: the same tasks the dashboard already has,
 * ordered by relevance, with the private-only addition of an "à revoir" note list. Nothing here
 * writes to the task store except through the normal task form.
 */
interface ReviewItem {
  id: string;
  text: string;
  moduleId: string | null;
  createdAt: string;
}

export default function PrvTasksPage() {
  const tasks = useAppStore((state) => state.tasks);
  const moveTask = useAppStore((state) => state.moveTask);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/prv/review", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({ items: [] }));
    setItems(payload.items ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const open = useMemo(() => sortTasksByRelevance(tasks.filter((task) => task.status !== "completed")), [tasks]);
  const overdue = useMemo(() => open.filter(isTaskOverdue), [open]);
  const completed = useMemo(() => tasks.filter((task) => task.status === "completed"), [tasks]);

  const addItem = async () => {
    if (busy || draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/prv/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Impossible d'ajouter cet élément.");
      return;
    }
    setDraft("");
    void load();
  };

  const removeItem = async (id: string) => {
    await fetch("/api/prv/review", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void load();
  };

  return (
    <div className="space-y-5">
      <PrvPanel title="Tâches" subtitle="Les mêmes tâches que le tableau de bord, classées par pertinence.">
        <div className="grid grid-cols-3 gap-3">
          <PrvStat label="Ouvertes" value={open.length} />
          <PrvStat label="En retard" value={overdue.length} tone={overdue.length > 0 ? "warn" : "muted"} />
          <PrvStat label="Terminées" value={completed.length} tone="good" />
        </div>
      </PrvPanel>

      <PrvPanel title="À revoir" subtitle="Notes à reprendre. Ce ne sont pas des tâches : rien n'est créé automatiquement.">
        {error && <PrvNotice tone="warn">{error}</PrvNotice>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addItem();
            }}
            placeholder="Ajouter une note de révision"
            className="w-full rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500/60"
          />
          <Button size="sm" onClick={() => void addItem()} disabled={busy || draft.trim().length === 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Ajouter
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="mt-3">
            <PrvEmpty>Aucune note en attente.</PrvEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-ink/5 bg-ink/[0.02] px-3 py-2"
              >
                <Circle className="h-3.5 w-3.5 shrink-0 text-ink/30" />
                <span className="min-w-0 flex-1 truncate text-xs text-ink/80">{item.text}</span>
                <button
                  type="button"
                  onClick={() => void removeItem(item.id)}
                  aria-label="Retirer"
                  className="shrink-0 rounded-lg p-1 text-ink/30 transition-colors hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PrvPanel>

      <PrvPanel title="Ouvertes" subtitle="Les plus importantes d'abord.">
        {open.length === 0 ? (
          <PrvEmpty>Aucune tâche ouverte. Ajoutez-en depuis un module pour alimenter vos rapports.</PrvEmpty>
        ) : (
          <ul className="space-y-1.5">
            {open.slice(0, 40).map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/5 bg-ink/[0.02] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => moveTask(task.id, task.deadline)}
                  aria-label="Marquer terminée"
                  className="shrink-0 rounded-full p-1 text-ink/25 transition-colors hover:text-emerald-500"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-ink/85">{task.title}</span>
                {task.moduleId && (
                  <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">
                    {task.moduleId}
                  </span>
                )}
                {isTaskOverdue(task) && (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    en retard
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </PrvPanel>
    </div>
  );
}
