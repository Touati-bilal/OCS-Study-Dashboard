"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, ShieldAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Select, Textarea } from "@/components/ui/Field";
import { PrvEmpty, PrvNotice, PrvPanel } from "@/components/prv/PrvPanel";
import { usePrv } from "@/components/prv/usePrv";
import { getMainModules } from "@/lib/modules";
import { useAppStore } from "@/store/useAppStore";
import type { TaskPriority } from "@/lib/types";

interface Proposal {
  title: string;
  description: string;
  priority: TaskPriority;
  moduleId: string | null;
  rationale: string;
}

/**
 * PRV · IA.
 *
 * The key never reaches this page: proposals come from `/api/prv/ai/tasks`, which calls the model
 * server-side. Each proposal sits behind an editable confirmation form, and only the owner's
 * explicit click - going through the real `addTask` action - puts anything in the task store. The
 * AI has no write path of its own.
 */
export default function PrvAiPage() {
  const { busy, error, proposeTasks } = usePrv();
  const addTask = useAppStore((state) => state.addTask);
  const openTasks = useAppStore((state) => state.tasks.filter((task) => task.status !== "completed"));
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prv/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((status) => {
        if (!cancelled) setConfigured(Boolean(status.aiConfigured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = async () => {
    const result = await proposeTasks(note);
    if (!result) return;
    if (result.status === "unconfigured" || result.status === "disabled") {
      setMessage(result.message ?? "IA indisponible.");
      return;
    }
    if (result.proposals.length === 0) {
      setMessage("Aucune proposition renvoyée.");
      return;
    }
    setProposals(
      result.proposals.map((proposal) => ({
        ...proposal,
        priority: proposal.priority as TaskPriority,
      }))
    );
    setMessage(null);
  };

  /** The only path from a proposal to the task store, and it needs this explicit click. */
  const accept = (proposal: Proposal) => {
    addTask({
      title: proposal.title,
      description: proposal.description || undefined,
      moduleId: proposal.moduleId,
      priority: proposal.priority,
      source: "Proposition IA (PRV)",
    });
    setAccepted((current) => [...current, proposal.title]);
  };

  const modules = getMainModules("OCS");

  return (
    <div className="space-y-5">
      <PrvPanel title="Assistant IA" subtitle="Propose des tâches. Vous confirmez avant toute création.">
        {configured === false && (
          <PrvNotice tone="info">
            Aucune clé IA configurée. Définissez <code className="rounded bg-ink/10 px-1">AI_API_KEY</code>{" "}
            (et facultativement <code className="rounded bg-ink/10 px-1">AI_BASE_URL</code>,{" "}
            <code className="rounded bg-ink/10 px-1">AI_MODEL</code>) côté serveur. La clé n&apos;est
            jamais envoyée au navigateur.
          </PrvNotice>
        )}
        {error && <PrvNotice tone="warn">{error}</PrvNotice>}
        {message && <PrvNotice tone="warn">{message}</PrvNotice>}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Décrivez ce que vous voulez travailler"
            className="w-full rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500/60"
          />
          <Button onClick={() => void ask()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
            Proposer
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink/45">
          Le modèle reçoit un résumé chiffré de votre semaine et vos titres de tâches existantes pour
          éviter les doublons. Ni le code PRV, ni la phrase de récupération, ni vos fichiers ne lui
          sont transmis.
        </p>
      </PrvPanel>

      <PrvPanel title="Propositions" subtitle="Relisez, ajustez, puis confirmez. Rien n'est créé automatiquement.">
        {proposals.length === 0 ? (
          <PrvEmpty>Aucune proposition pour l&apos;instant.</PrvEmpty>
        ) : (
          <ul className="space-y-3">
            {proposals.map((proposal, index) => {
              const isAccepted = accepted.includes(proposal.title);
              return (
                <li key={`${proposal.title}-${index}`} className="rounded-xl border border-ink/5 bg-ink/[0.02] p-3">
                  <p className="text-xs font-semibold text-ink">{proposal.title}</p>
                  {proposal.rationale && (
                    <p className="mt-0.5 text-[11px] italic text-ink/45">Pourquoi : {proposal.rationale}</p>
                  )}

                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                    <FieldGroup>
                      <label className="mb-1 block text-[11px] font-medium text-ink/55">Titre</label>
                      <Input
                        value={proposal.title}
                        onChange={(event) => {
                          const next = [...proposals];
                          next[index] = { ...proposal, title: event.target.value };
                          setProposals(next);
                        }}
                      />
                    </FieldGroup>
                    <FieldGroup>
                      <label className="mb-1 block text-[11px] font-medium text-ink/55">Priorité</label>
                      <Select
                        value={proposal.priority}
                        onChange={(event) => {
                          const next = [...proposals];
                          next[index] = { ...proposal, priority: event.target.value as TaskPriority };
                          setProposals(next);
                        }}
                      >
                        <option value="prof">Demandé par le prof</option>
                        <option value="important">Important</option>
                        <option value="normal">Normal</option>
                      </Select>
                    </FieldGroup>
                    <FieldGroup className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-ink/55">Module</label>
                      <Select
                        value={proposal.moduleId ?? ""}
                        onChange={(event) => {
                          const next = [...proposals];
                          next[index] = { ...proposal, moduleId: event.target.value || null };
                          setProposals(next);
                        }}
                      >
                        <option value="">Aucun</option>
                        {modules.map((module) => (
                          <option key={module.id} value={module.id}>
                            {module.code} — {module.name}
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>
                    <FieldGroup className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-ink/55">Description</label>
                      <Textarea
                        rows={2}
                        value={proposal.description}
                        onChange={(event) => {
                          const next = [...proposals];
                          next[index] = { ...proposal, description: event.target.value };
                          setProposals(next);
                        }}
                      />
                    </FieldGroup>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => accept(proposal)}
                      disabled={isAccepted || proposal.title.trim().length === 0}
                    >
                      {isAccepted ? "Ajoutée" : "Confirmer et ajouter"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setProposals(proposals.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Ignorer
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PrvPanel>

      <PrvPanel title="Ce que l'IA ne peut pas faire">
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-ink/60">
          <li className="flex items-start gap-1.5">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-ink/30" />
            Créer, modifier ou terminer une tâche sans votre confirmation explicite.
          </li>
          <li className="flex items-start gap-1.5">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-ink/30" />
            Modifier un chiffre du rapport : les métriques sont calculées, pas générées.
          </li>
          <li className="flex items-start gap-1.5">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-ink/30" />
            Accéder à vos fichiers, à vos notes Obsidian ou à une autre partie de l&apos;application.
          </li>
        </ul>
        <p className="mt-2 text-[11px] text-ink/45">
          {openTasks.length} tâche(s) ouverte(s) déjà connues du modèle, pour éviter les doublons.
        </p>
      </PrvPanel>
    </div>
  );
}
