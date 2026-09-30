"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PrvEmpty, PrvNotice, PrvPanel, PrvStat } from "@/components/prv/PrvPanel";
import { pdfUrl, usePrv } from "@/components/prv/usePrv";
import { formatWeekRange } from "@/lib/prv/weekly";
import { useAppStore } from "@/store/useAppStore";

interface ReportRow {
  key: string;
  weekStart: string;
  weekEnd: string;
  generation: number;
  weightedProgress: number;
  trajectory: string;
  completionRate: number | null;
  planned: number;
  completed: number;
  longOverdue: number;
  empty: boolean;
  aiStatus: string;
  downloadId?: string;
}

const TRAJECTORY: Record<string, { label: string; tone: string }> = {
  improving: { label: "En hausse", tone: "text-emerald-600 dark:text-emerald-400" },
  stable: { label: "Stable", tone: "text-ink/70" },
  slipping: { label: "En baisse", tone: "text-amber-600 dark:text-amber-400" },
  "insufficient-data": { label: "Historique insuffisant", tone: "text-ink/45" },
};

export default function PrvReportsPage() {
  const { busy, error, generateReport, listReports, getReport, analyze } = usePrv();
  const tasks = useAppStore((state) => state.tasks);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    const payload = await listReports();
    if (payload) setRows(payload.reports as ReportRow[]);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (weekEnd: string) => {
    setSelected(weekEnd);
    setDetail(null);
    const payload = await getReport(weekEnd);
    if (payload) setDetail(payload);
  };

  const recommendations = useMemo(() => {
    const list = (detail?.recommendations ?? []) as Array<{ kind: string; title: string; detail: string; evidence: string[] }>;
    return list;
  }, [detail]);

  const ai = (detail?.ai ?? null) as { status: string; interpretation: string[]; focus: string[] } | null;
  const metrics = (detail?.metrics ?? null) as
    | {
        completionRate: number | null;
        planned: unknown[];
        completed: unknown[];
        completedPlanned: unknown[];
        carriedOver: unknown[];
        longOverdue: unknown[];
        noDeadline: unknown[];
      }
    | null;

  return (
    <div className="space-y-5">
      <PrvPanel
        title="Rapports hebdomadaires"
        subtitle="Une entrée par semaine. Régénérer la même semaine met à jour le rapport existant au lieu d'en créer un second."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" /> Actualiser
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                const result = await generateReport();
                if (result) {
                  setNotice(
                    result.generation > 1
                      ? `Semaine ${result.weekEnd} mise à jour (${result.generation}ᵉ génération).`
                      : `Rapport créé pour la semaine ${result.weekEnd}.`
                  );
                  void refresh();
                }
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Générer
            </Button>
          </div>
        }
      >
        {notice && <PrvNotice tone="good">{notice}</PrvNotice>}
        {error && <PrvNotice tone="warn">{error}</PrvNotice>}
        {rows.length === 0 ? (
          <PrvEmpty>
            Aucun rapport enregistré. Utilisez « Générer » pour construire la semaine en cours à
            partir de vos {tasks.length} tâche(s) réelles.
          </PrvEmpty>
        ) : (
          <ul className="divide-y divide-ink/5">
            {rows.map((row) => {
              const verdict = TRAJECTORY[row.trajectory] ?? { label: row.trajectory, tone: "text-ink/60" };
              return (
                <li key={row.key} className="flex flex-wrap items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void open(row.weekEnd)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-sm text-ink">{formatWeekRange(row.weekStart, row.weekEnd)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
                      <span>{row.completed}/{row.planned} terminées</span>
                      {row.completionRate === null ? (
                        <span>· taux n/a</span>
                      ) : (
                        <span>· {row.completionRate} %</span>
                      )}
                      {row.generation > 1 && <span>· régénéré {row.generation}×</span>}
                      {row.empty && <span>· sans données</span>}
                    </span>
                  </button>
                  <span className={`text-xs font-medium ${verdict.tone}`}>{verdict.label}</span>
                  {row.longOverdue > 0 && (
                    <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                      {row.longOverdue} en retard
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PrvPanel>

      {selected && (
        <PrvPanel
          title={detail ? formatWeekRange(detail.weekStart as string, detail.weekEnd as string) : "Chargement…"}
          subtitle="Les chiffres sont calculés à partir des données réelles ; l'IA n'ajoute qu'un commentaire."
          action={
            <div className="flex flex-wrap gap-2">
              {detail && rows.find((r) => r.weekEnd === selected)?.downloadId && (
                <a
                  href={pdfUrl(selected, rows.find((r) => r.weekEnd === selected)!.downloadId!)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-ink/[0.07] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.12]"
                >
                  Télécharger le PDF
                </a>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  const result = await analyze(selected);
                  if (result) {
                    setNotice("Interprétation IA ajoutée au rapport.");
                    void open(selected);
                  }
                }}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Interpréter avec l&apos;IA
              </Button>
            </div>
          }
        >
          {!detail ? (
            <div className="flex items-center gap-2 text-sm text-ink/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PrvStat
                  label="Taux"
                  value={metrics?.completionRate === null || !metrics ? "n/a" : `${metrics.completionRate} %`}
                  tone="default"
                />
                <PrvStat
                  label="Planifiées terminées"
                  value={`${metrics?.completedPlanned.length ?? 0}/${metrics?.planned.length ?? 0}`}
                  tone="good"
                />
                <PrvStat label="Terminées (hors plan)" value={metrics?.completed.length ?? 0} />
                <PrvStat label="Reportées" value={metrics?.carriedOver.length ?? 0} />
                <PrvStat
                  label="En retard"
                  value={metrics?.longOverdue.length ?? 0}
                  tone={(metrics?.longOverdue.length ?? 0) > 0 ? "warn" : "muted"}
                />
              </div>

              {recommendations.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
                    Recommandations
                  </h3>
                  <ul className="space-y-2">
                    {recommendations.map((recommendation, index) => (
                      <li
                        key={`${recommendation.title}-${index}`}
                        className={`rounded-xl border p-3 ${
                          recommendation.kind === "reward"
                            ? "border-emerald-500/25 bg-emerald-500/5"
                            : recommendation.kind === "corrective"
                              ? "border-amber-500/25 bg-amber-500/5"
                              : "border-ink/5 bg-ink/[0.02]"
                        }`}
                      >
                        <p className="text-xs font-semibold text-ink">{recommendation.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-ink/65">{recommendation.detail}</p>
                        {recommendation.evidence.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {recommendation.evidence.map((evidence, i) => (
                              <li key={i} className="text-[11px] text-ink/45">
                                · {evidence}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ai && ai.interpretation.length > 0 && (
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
                  <h3 className="text-xs font-semibold text-ink">Interprétation IA</h3>
                  <p className="mt-0.5 text-[11px] text-ink/45">
                    Commentaire qualitatif : les chiffres ci-dessus ne dépendent pas de l&apos;IA.
                  </p>
                  {ai.interpretation.map((paragraph, index) => (
                    <p key={index} className="mt-2 text-[11px] leading-relaxed text-ink/75">
                      {paragraph}
                    </p>
                  ))}
                  {ai.focus.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {ai.focus.map((item, index) => (
                        <li key={index} className="text-[11px] text-ink/60">
                          → {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </PrvPanel>
      )}
    </div>
  );
}
