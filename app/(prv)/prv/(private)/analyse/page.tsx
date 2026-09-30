"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PrvEmpty, PrvNotice, PrvPanel, PrvStat } from "@/components/prv/PrvPanel";
import { usePrv } from "@/components/prv/usePrv";
import { formatWeekRange } from "@/lib/prv/weekly";

interface Row {
  weekStart: string;
  weekEnd: string;
  completionRate: number | null;
  weightedProgress: number;
  trajectory: string;
  longOverdue: number;
  empty: boolean;
}

/**
 * PRV · Analyse.
 *
 * The trend is drawn from the stored reports, so the chart is a rendering of real generated
 * numbers. Each point links to its week, and the verdict shown is the one whose explicit rule fired
 * - the same rule text the report and the PDF display.
 */
const TRAJECTORY_COPY: Record<string, { label: string; tone: string; hint: string }> = {
  improving: { label: "En hausse", tone: "text-emerald-600 dark:text-emerald-400", hint: "La progression pondérée dépasse la moyenne récente d'au moins le seuil configuré." },
  stable: { label: "Stable", tone: "text-ink/70", hint: "La variation reste sous le seuil configuré." },
  slipping: { label: "En baisse", tone: "text-amber-600 dark:text-amber-400", hint: "La progression pondérée recule d'au moins le seuil configuré." },
  "insufficient-data": { label: "Historique insuffisant", tone: "text-ink/45", hint: "Il faut au moins deux semaines pour conclure." },
};

export default function PrvAnalysePage() {
  const { busy, error, listReports } = usePrv();
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listReports().then((payload) => {
      if (!cancelled && payload) setRows((payload.reports as Row[]).slice().reverse());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = rows[rows.length - 1];
  const verdict = last ? TRAJECTORY_COPY[last.trajectory] ?? TRAJECTORY_COPY["insufficient-data"] : null;
  const max = Math.max(100, ...rows.map((row) => row.weightedProgress));

  return (
    <div className="space-y-5">
      {error && <PrvNotice tone="warn">{error}</PrvNotice>}

      <PrvPanel title="Analyse" subtitle="Tendance sur les semaines réellement générées.">
        {rows.length === 0 ? (
          <PrvEmpty>
            Aucun rapport à analyser. Générez-en un depuis <Link href="/prv/rapports" className="underline">Rapports</Link>.
          </PrvEmpty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PrvStat label="Semaines" value={rows.length} />
              <PrvStat
                label="Progression"
                value={`${last.weightedProgress} %`}
                hint="Pondérée, coefficient × poids"
              />
              <PrvStat
                label="Taux de complétion"
                value={last.completionRate === null ? "n/a" : `${last.completionRate} %`}
                tone={last.completionRate === null ? "muted" : "default"}
              />
              <PrvStat
                label="En retard"
                value={last.longOverdue}
                tone={last.longOverdue > 0 ? "warn" : "muted"}
              />
            </div>

            {verdict && (
              <div className="mt-3 rounded-xl border border-ink/5 bg-ink/[0.02] p-3">
                <p className={`text-sm font-semibold ${verdict.tone}`}>{verdict.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink/55">{verdict.hint}</p>
              </div>
            )}
          </>
        )}
      </PrvPanel>

      {rows.length > 0 && (
        <PrvPanel title="Progression pondérée par semaine" subtitle="Barres calculées à partir des rapports stockés.">
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.weekEnd} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[11px] text-ink/50">
                  {formatWeekRange(row.weekStart, row.weekEnd).replace(/ \d{4}$/, "")}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                  <span
                    className="block h-full rounded-full bg-teal-500/70"
                    style={{ width: `${Math.min(100, (row.weightedProgress / max) * 100)}%` }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-ink/60">
                  {row.weightedProgress} %
                </span>
                {row.empty && <span className="shrink-0 text-[10px] text-ink/35">vide</span>}
              </li>
            ))}
          </ul>
        </PrvPanel>
      )}

      {last && (
        <PrvPanel
          title="Lire la règle"
          subtitle="Le verdict n'est pas une intuition : voici ce qu'il signifie."
          action={
            <Link
              href="/prv/rapports"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline dark:text-teal-300"
            >
              <Sparkles className="h-3.5 w-3.5" /> Voir le détail
            </Link>
          }
        >
          <ul className="space-y-2 text-[11px] leading-relaxed text-ink/65">
            <li>
              <strong className="text-ink">Pondération.</strong> Chaque module compte pour son
              coefficient, puis pour le poids que vous fixez dans les paramètres (0,75 par défaut
              pour M202, M203 et M204).
            </li>
            <li>
              <strong className="text-ink">Seuil de tendance.</strong> L&apos;écart entre la semaine
              courante et la moyenne des semaines précédentes décide entre hausse, stabilité et
              baisse. Vous pouvez le régler.
            </li>
            <li>
              <strong className="text-ink">Règle de retard.</strong> Au-delà du nombre de jours que
              vous fixez, une tâche est signalée et une action corrective est proposée.
            </li>
          </ul>
          {busy && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Actualisation…
            </p>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={busy}
            onClick={async () => {
              const payload = await listReports();
              if (payload) {
                setRows((payload.reports as Row[]).slice().reverse());
                setNotice("Analyse actualisée.");
              }
            }}
          >
            Actualiser
          </Button>
          {notice && <p className="mt-2 text-[11px] text-ink/45">{notice}</p>}
        </PrvPanel>
      )}
    </div>
  );
}
