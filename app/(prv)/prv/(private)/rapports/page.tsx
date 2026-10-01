"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PrvEmpty, PrvNotice, PrvPanel, PrvStat } from "@/components/prv/PrvPanel";
import { pdfUrl, usePrv } from "@/components/prv/usePrv";
import {
  OBSERVATION_FIELDS,
  OBSERVATION_LIMITS,
  type Observations,
} from "@/lib/prv/observations";
import {
  MAX_PERIOD_DAYS,
  formatWeekRange,
  getLastCompletedWeek,
  periodLength,
  todayIso,
} from "@/lib/prv/weekly";
import { useAppStore } from "@/store/useAppStore";

interface ReportRow {
  key: string;
  weekStart: string;
  weekEnd: string;
  generation: number;
  weightedProgress: number;
  trajectory: string;
  arrow: string;
  completionRate: number | null;
  planned: number;
  completed: number;
  overdue: number;
  longOverdue: number;
  periodDays: number;
  activityCount: number;
  canonicalWeek: boolean;
  empty: boolean;
  aiStatus: string;
  downloadId?: string;
  createdAt: string;
  updatedAt: string;
}

const TRAJECTORY: Record<string, { label: string; tone: string }> = {
  improving: { label: "En hausse", tone: "text-emerald-600 dark:text-emerald-400" },
  stable: { label: "Stable", tone: "text-ink/70" },
  slipping: { label: "En baisse", tone: "text-amber-600 dark:text-amber-400" },
  "insufficient-data": { label: "Historique insuffisant", tone: "text-ink/45" },
};

const ARROW: Record<string, string> = {
  up: "↑",
  flat: "→",
  down: "↓",
  unknown: "?",
};

export default function PrvReportsPage() {
  const { busy, error, generateReport, listReports, getReport, saveReportNotes, analyze } = usePrv();
  const tasks = useAppStore((state) => state.tasks);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * The requested period.
   *
   * The default is the last completed week rather than "today", so a report never describes a day
   * that has not happened yet. Both ends are editable so any range can be analysed; the server
   * re-validates them, since a client-side check would be trivially bypassed.
   */
  const lastWeek = useMemo(() => getLastCompletedWeek(todayIso()), []);
  const [start, setStart] = useState<string>(lastWeek.weekStart);
  const [end, setEnd] = useState<string>(lastWeek.weekEnd);

  /** A range the user can actually submit, so the button never sends a half-filled form. */
  const rangeError =
    start > end
      ? "La date de début doit précéder la date de fin."
      : periodLength({ weekStart: start, weekEnd: end }) > MAX_PERIOD_DAYS
        ? `La période ne peut pas dépasser ${MAX_PERIOD_DAYS} jours.`
        : null;

  /**
   * Whether the chosen period already has a stored report.
   *
   * This drives the button label only — the server is the one that decides whether a save creates or
   * updates. Relabelling it here just tells the owner what to expect before they click.
   */
  const selectedExisting = rows.some((row) => row.weekStart === start && row.weekEnd === end);

  const refresh = async () => {
    const payload = await listReports();
    if (payload) setRows(payload.reports as ReportRow[]);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (ref: string) => {
    setSelected(ref);
    setDetail(null);
    const payload = await getReport(ref);
    if (payload) setDetail(payload);
  };

  const recommendations = useMemo(() => {
    const list = (detail?.recommendations ?? []) as Array<{ kind: string; title: string; detail: string; evidence: string[] }>;
    return list;
  }, [detail]);

  const selectedRow = rows.find((row) => row.key === selected) ?? null;
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
        title="Historique des rapports"
        subtitle="Une entrée par période. Régénérer la même période met à jour le rapport existant au lieu d'en créer un second."
        action={
          <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
        }
      >
        {notice && <PrvNotice tone="good">{notice}</PrvNotice>}
        {error && <PrvNotice tone="warn">{error}</PrvNotice>}
        {rows.length === 0 ? (
          <PrvEmpty>
            Aucun rapport enregistré. Choisissez une période puis utilisez « Générer » pour
            construire le rapport à partir de vos {tasks.length} tâche(s) réelles.
          </PrvEmpty>
        ) : (
          <ul className="divide-y divide-ink/5">
            {rows.map((row) => {
              const verdict = TRAJECTORY[row.trajectory] ?? { label: row.trajectory, tone: "text-ink/60" };
              return (
                <li key={row.key} className="flex flex-wrap items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void open(row.key)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-sm text-ink">
                      {formatWeekRange(row.weekStart, row.weekEnd)}
                      {!row.canonicalWeek && (
                        <span className="ml-2 rounded bg-ink/[0.07] px-1.5 py-0.5 text-[10px] text-ink/50">
                          période personnalisée
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
                      <span>{row.completed}/{row.planned} terminées</span>
                      {row.completionRate === null ? (
                        <span>· taux n/a</span>
                      ) : (
                        <span>· {row.completionRate} %</span>
                      )}
                      {row.periodDays > 0 && <span>· {row.periodDays} j</span>}
                      {row.generation > 1 && <span>· régénéré {row.generation}×</span>}
                      {row.empty && <span>· sans données</span>}
                      <span>· généré le {new Date(row.updatedAt).toLocaleString("fr-FR")}</span>
                    </span>
                  </button>
                  <span className={`text-xs font-medium ${verdict.tone}`}>
                    <span aria-hidden className="mr-1">
                      {ARROW[row.arrow] ?? ARROW.unknown}
                    </span>
                    {verdict.label}
                  </span>
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

      {/*
        The period form sits above the history on purpose: the history answers "what did I already
        generate", the form answers "what do I want to generate", and the second question comes
        first in the flow.
      */}
      <PrvPanel
        title="Générer un rapport"
        subtitle="La période est libre : une semaine, un mois, ou n'importe quel intervalle. Les données proviennent de vos tâches réelles."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink/60">
            Du
            <input
              type="date"
              value={start}
              max={end}
              onChange={(event) => setStart(event.target.value)}
              className="rounded-xl border border-ink/10 bg-background px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink/60">
            Au
            <input
              type="date"
              value={end}
              min={start}
              max={todayIso()}
              onChange={(event) => setEnd(event.target.value)}
              className="rounded-xl border border-ink/10 bg-background px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <Button
            size="sm"
            disabled={busy || Boolean(rangeError)}
            onClick={async () => {
              const result = await generateReport({ start, end });
              if (result) {
                setNotice(
                  result.generation > 1
                    ? `Rapport mis à jour pour ${formatWeekRange(result.weekStart, result.weekEnd)} (${result.generation}ᵉ génération).`
                    : `Rapport créé pour ${formatWeekRange(result.weekStart, result.weekEnd)}.`
                );
                await refresh();
                await open(result.key);
              }
            }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {selectedExisting ? "Regénérer" : "Générer"}
          </Button>
        </div>
        {rangeError && <PrvNotice tone="warn">{rangeError}</PrvNotice>}
        <p className="mt-2 text-[11px] text-ink/45">
          Les limites acceptées vont de {MAX_PERIOD_DAYS} jours au maximum. Une période future est
          refusée côté serveur : elle ne décrirait aucune donnée réelle.
        </p>
      </PrvPanel>

      {selected && (
        <PrvPanel
          title={detail ? formatWeekRange(detail.weekStart as string, detail.weekEnd as string) : "Chargement…"}
          subtitle="Les chiffres sont calculés à partir des données réelles ; l'IA n'ajoute qu'un commentaire."
          action={
            <div className="flex flex-wrap gap-2">
              {detail && selectedRow?.downloadId && (
                <a
                  href={pdfUrl(selected, selectedRow.downloadId, "rapport")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-ink/[0.07] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.12]"
                >
                  Générer le PDF
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
              {selected && <ObservationsPanel reportKey={selected} detail={detail} onSaved={() => void open(selected)} />}
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

/**
 * The owner's own notes for the selected period.
 *
 * Notes are optional and never required to read the report, so this panel starts collapsed when a
 * report has none. The form is keyed by the report so switching periods discards half-written text
 * instead of silently carrying one period's notes into another. Saving does not regenerate: the
 * metrics stay exactly as the last generation computed them.
 */
function ObservationsPanel({
  reportKey,
  detail,
  onSaved,
}: {
  reportKey: string;
  detail: Record<string, unknown>;
  onSaved: () => void;
}) {
  const { busy, error, saveReportNotes } = usePrv();
  const stored = (detail.observations ?? {}) as Observations;
  const [values, setValues] = useState<Observations>(stored);
  const [openForm, setOpenForm] = useState(Object.keys(stored).length > 0);

  // Re-seed from the server when a different report is opened.
  useEffect(() => {
    setValues(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey]);

  const dirty = OBSERVATION_FIELDS.some((field) => (values[field.key] ?? "") !== (stored[field.key] ?? ""));

  return (
    <div className="rounded-xl border border-ink/5 bg-ink/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-ink">Mes observations</h3>
          <p className="text-[11px] text-ink/45">
            facultatives. Elles s&apos;ajoutent au rapport et n&apos;influencent aucun chiffre.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpenForm((value) => !value)}>
          {openForm ? "Masquer" : "Ajouter"}
        </Button>
      </div>
      {openForm && (
        <div className="mt-3 space-y-3">
          {OBSERVATION_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-xs text-ink/60">
              {field.label}
              <textarea
                value={values[field.key] ?? ""}
                maxLength={OBSERVATION_LIMITS[field.key]}
                rows={2}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
                className="resize-y rounded-xl border border-ink/10 bg-background px-3 py-2 text-sm text-ink"
              />
            </label>
          ))}
          {error && <PrvNotice tone="warn">{error}</PrvNotice>}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={busy || !dirty}
              onClick={async () => {
                const result = await saveReportNotes(reportKey, values);
                if (result) onSaved();
              }}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enregistrer les observations
            </Button>
            {dirty && <span className="text-[11px] text-ink/45">modifications non enregistrées</span>}
          </div>
        </div>
      )}
    </div>
  );
}
