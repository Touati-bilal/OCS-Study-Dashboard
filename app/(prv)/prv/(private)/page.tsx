"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, BrainCircuit, FolderTree, ListChecks, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PrvEmpty, PrvNotice, PrvPanel, PrvStat } from "@/components/prv/PrvPanel";
import { pdfUrl, usePrv } from "@/components/prv/usePrv";
import { formatWeekRange } from "@/lib/prv/weekly";
import { useAppStore } from "@/store/useAppStore";

interface ReportSummary {
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

const TRAJECTORY_LABEL: Record<string, string> = {
  improving: "En hausse",
  stable: "Stable",
  slipping: "En baisse",
  "insufficient-data": "Pas assez d'historique",
};

export default function PrvOverviewPage() {
  const { busy, error, generateReport, listReports } = usePrv();
  const tasks = useAppStore((state) => state.tasks);
  const studyOption = useAppStore((state) => state.studyOption);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    const payload = await listReports();
    if (payload) setReports(payload.reports as ReportSummary[]);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTasks = tasks.filter((task) => task.status !== "completed").length;
  const last = reports[0];

  return (
    <div className="space-y-5">
      <PrvPanel
        title="Espace privé PRV"
        subtitle="Données réelles du tableau de bord OCS. Rien n'est envoyé à un service externe sans votre action."
        action={
          <Button
            size="sm"
            onClick={async () => {
              const result = await generateReport();
              if (result) {
                setNotice(
                  result.generation > 1
                    ? `Semaine ${result.weekEnd} mise à jour (${result.generation}ᵉ génération, aucun doublon).`
                    : `Rapport créé pour la semaine ${result.weekEnd}.`
                );
                void refresh();
              }
            }}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Générer le rapport
          </Button>
        }
      >
        {studyOption !== "OCS" && (
          <PrvNotice tone="warn">
            PRV est réservé à OCS, mais votre option actuelle est {studyOption ?? "aucune"}. Les pages
            et les API PRV restent protégés côté serveur ; l&apos;interface n&apos;a simplement pas
            lieu d&apos;être affichée pour ce parcours.
          </PrvNotice>
        )}
        {notice && <PrvNotice tone="good">{notice}</PrvNotice>}
        {error && <PrvNotice tone="warn">{error}</PrvNotice>}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PrvStat label="Tâches ouvertes" value={openTasks} hint="Dans le tableau de bord" />
          <PrvStat label="Rapports" value={reports.length} hint="Semaines enregistrées" />
          <PrvStat
            label="Dernière progression"
            value={last ? `${last.weightedProgress} %` : "—"}
            hint="Pondérée, tous modules"
            tone={last ? "default" : "muted"}
          />
          <PrvStat
            label="En retard > 2 sem."
            value={last ? last.longOverdue : "—"}
            hint="À traiter en priorité"
            tone={last && last.longOverdue > 0 ? "warn" : "muted"}
          />
        </div>
      </PrvPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <PrvPanel title="Rapport le plus récent" subtitle="Les chiffres sont calculés, jamais estimés.">
          {last ? (
            <div className="space-y-2.5">
              <p className="text-sm text-ink">
                {formatWeekRange(last.weekStart, last.weekEnd)}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-ink/5 px-2 py-1 text-ink/70">
                  {last.completed}/{last.planned} tâches terminées
                </span>
                <span className="rounded-lg bg-ink/5 px-2 py-1 text-ink/70">
                  {TRAJECTORY_LABEL[last.trajectory] ?? last.trajectory}
                </span>
                {last.generation > 1 && (
                  <span className="rounded-lg bg-ink/5 px-2 py-1 text-ink/70">
                    régénéré {last.generation}×
                  </span>
                )}
              </div>
              <Link
                href="/prv/rapports"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline dark:text-teal-300"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Ouvrir le rapport
              </Link>
            </div>
          ) : (
            <PrvEmpty>
              Aucun rapport pour l&apos;instant. Utilisez « Générer le rapport » : les chiffres
              viennent de vos tâches, de vos objectifs de module et de vos résultats de quiz réels.
            </PrvEmpty>
          )}
        </PrvPanel>

        <PrvPanel title="Sections" subtitle="Toutes protégées par le code PRV côté serveur.">
          <ul className="grid grid-cols-2 gap-2">
            {[
              { href: "/prv/taches", label: "Tâches", icon: ListChecks },
              { href: "/prv/obsidian", label: "Obsidian", icon: FolderTree },
              { href: "/prv/ai", label: "IA", icon: BrainCircuit },
              { href: "/prv/rapports", label: "Rapports", icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded-xl border border-ink/5 bg-ink/[0.02] px-3 py-2.5 text-xs font-medium text-ink/75 transition-colors hover:border-teal-500/30 hover:text-ink"
                  >
                    <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink/45">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            Le code, la phrase de récupération et les clés IA restent sur le serveur. Un lien
            direct vers une page PRV sans session active redirige vers le déverrouillage.
          </p>
        </PrvPanel>
      </div>
    </div>
  );
}
