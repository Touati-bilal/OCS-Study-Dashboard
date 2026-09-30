/**
 * Weekly report PDF.
 *
 * Rendered on demand by an authorised route, held in memory and streamed back with no-cache
 * headers - the file is never written under `public/`, so there is no predictable URL for anyone
 * to guess. An in-memory cache keyed on the report's updated timestamp avoids re-rendering a PDF
 * the moment a user clicks download twice.
 *
 * The PDF restates the same deterministic facts as the on-screen report. The AI interpretation is
 * clearly labelled as interpretation so it is never mistaken for a measured number.
 */

import "server-only";

import PDFDocument from "pdfkit";

import type { StoredReport } from "./reports.server";
import { formatShortDate, formatWeekRange } from "./weekly";

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  accent: "#0f766e",
  warn: "#b45309",
  good: "#15803d",
  panel: "#f8fafc",
} as const;

const PAGE_MARGIN = 48;

function heading(doc: PDFKit.PDFDocument, text: string, size = 13): void {
  doc.moveDown(0.8);
  doc.fillColor(COLORS.accent).fontSize(size).font("Helvetica-Bold").text(text);
  doc.moveDown(0.3);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(doc.x, doc.y + 2)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 2)
    .stroke();
  doc.moveDown(0.4);
}

function line(doc: PDFKit.PDFDocument, label: string, value: string, color: string = COLORS.ink): void {
  const startY = doc.y;
  doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica").text(`${label} `, { continued: true });
  doc.fillColor(color).font("Helvetica-Bold").text(value);
  if (doc.y === startY) doc.moveDown(0.25);
}

function bullets(doc: PDFKit.PDFDocument, items: string[], color: string = COLORS.ink): void {
  if (items.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text("Aucun élément.");
    return;
  }
  for (const item of items) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica").text("• ", { continued: true });
    doc.fillColor(color).font("Helvetica").text(item, { indent: 0 });
  }
}

function kvGrid(doc: PDFKit.PDFDocument, pairs: Array<[string, string]>): void {
  const startX = doc.x;
  const columnWidth = (doc.page.width - PAGE_MARGIN * 2) / 2;
  pairs.forEach(([label, value], index) => {
    const x = startX + (index % 2) * columnWidth;
    if (index % 2 === 0 && index > 0) doc.moveDown(0.55);
    doc.x = x;
    doc.fontSize(8.5).fillColor(COLORS.muted).font("Helvetica").text(label.toUpperCase());
    doc.fontSize(12).fillColor(COLORS.ink).font("Helvetica-Bold").text(value);
  });
  doc.x = startX;
}

/** A minimal bar drawn with rectangles; no chart library needed for a single-series view. */
function progressBar(doc: PDFKit.PDFDocument, ratio: number, width = 150): void {
  const y = doc.y - 9;
  const height = 7;
  doc.rect(doc.x, y, width, height).fillColor(COLORS.line).fill();
  const filled = Math.max(0, Math.min(1, ratio / 100)) * width;
  if (filled > 0) doc.roundedRect(doc.x, y, filled, height, 2).fillColor(COLORS.accent).fill();
  doc.fillColor(COLORS.ink).fontSize(9.5).font("Helvetica-Bold").text(`${Math.round(ratio * 10) / 10} %`, doc.x + width + 8, y - 1);
}

function footer(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 34;
    doc
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .text(
        `PRV · rapport du ${formatWeekRange(report.weekStart, report.weekEnd)} · document privé · page ${i + 1}/${range.count}`,
        PAGE_MARGIN,
        y,
        { width: doc.page.width - PAGE_MARGIN * 2, align: "center" }
      );
  }
}

export function renderReportPdf(report: StoredReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { metrics } = report;

    // --- header ---
    doc.fontSize(20).fillColor(COLORS.ink).font("Helvetica-Bold").text("Rapport hebdomadaire PRV");
    doc
      .fontSize(11)
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .text(formatWeekRange(report.weekStart, report.weekEnd));
    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Document privé · généré le ${formatShortDate(report.updatedAt.slice(0, 10))}` +
          (report.generation > 1 ? ` · régénéré ${report.generation}× (même semaine, aucun doublon)` : ""),
        { continued: false }
      );

    if (metrics.empty) {
      doc.moveDown(1);
      doc
        .fontSize(11)
        .fillColor(COLORS.warn)
        .font("Helvetica-Bold")
        .text("Aucune donnée enregistrée pour cette semaine.");
      doc
        .moveDown(0.4)
        .fontSize(9.5)
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .text(
          "Le rapport ne contient que des données réelles. Ajoutez des tâches ou des objectifs de module pour le remplir."
        );
      footer(doc, report);
      doc.end();
      return;
    }

    // --- summary ---
    heading(doc, "Vue d'ensemble");
    kvGrid(doc, [
      ["Tâches prévues", String(metrics.planned.length)],
      [
        "Planifiées terminées",
        `${metrics.completedPlanned.length}/${metrics.planned.length}`,
      ],
      ["Terminées (hors plan)", String(metrics.completed.length)],
      ["Taux de complétion", metrics.completionRate === null ? "n/a" : `${metrics.completionRate} %`],
      ["Incomplètes", String(metrics.incomplete.length)],
      ["Encore ouvertes", String(metrics.totals.openAtWeekEnd)],
      ["Reportées", String(metrics.carriedOver.length)],
    ]);

    // --- trajectory ---
    heading(doc, "Tendance");
    line(doc, "Verdict :", report.trajectory.headline, report.trajectory.trajectory === "slipping" ? COLORS.warn : COLORS.good);
    line(doc, "Règle appliquée :", report.trajectory.rule, COLORS.muted);
    doc.moveDown(0.2);
    line(doc, "Progression pondérée :", `${report.weightedProgress} %`);
    progressBar(doc, report.weightedProgress);
    if (report.trajectory.points.length > 1) {
      doc.moveDown(0.3);
      doc.fontSize(8.5).fillColor(COLORS.muted).font("Helvetica");
      doc.text(
        report.trajectory.points
          .map((p) => `${p.weekEnd} : ${Math.round(p.weightedProgress * 10) / 10} %`)
          .join("   ·   "),
        { width: doc.page.width - PAGE_MARGIN * 2 }
      );
    }

    // --- priority distribution ---
    heading(doc, "Répartition par priorité");
    kvGrid(doc, [
      ["Demandé par le prof", `${metrics.byPriority.prof.completed}/${metrics.byPriority.prof.total}`],
      ["Important", `${metrics.byPriority.important.completed}/${metrics.byPriority.important.total}`],
      ["Normal", `${metrics.byPriority.normal.completed}/${metrics.byPriority.normal.total}`],
      ["Créées cette semaine", String(metrics.totals.createdThisWeek)],
    ]);

    // --- module progress ---
    if (metrics.modules.length > 0) {
      heading(doc, "Progression par module");
      for (const moduleStat of metrics.modules) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        const rate = moduleStat.objectivesTotal > 0 ? moduleStat.objectiveRate : moduleStat.chapterRate;
        doc
          .fontSize(10)
          .fillColor(COLORS.ink)
          .font("Helvetica-Bold")
          .text(`${moduleStat.code} — ${moduleStat.name}`, { width: doc.page.width - PAGE_MARGIN * 2 - 170 });
        doc.x = PAGE_MARGIN;
        progressBar(doc, rate);
        doc.moveDown(0.15);
        doc
          .fontSize(8.5)
          .fillColor(COLORS.muted)
          .font("Helvetica")
          .text(
            `coefficient ${moduleStat.coefficient} · pondération ${moduleStat.objectivesDone}/${moduleStat.objectivesTotal} objectifs · ` +
              `${moduleStat.chaptersDone}/${moduleStat.chaptersTotal} chapitres terminés · ${moduleStat.hoursStudied} h cumulées`
          );
        doc.moveDown(0.4);
      }
    }

    // --- overdue ---
    if (metrics.longOverdue.length > 0) {
      heading(doc, `En retard de plus de ${report.settings.overdueWarningDays} jours`);
      doc.fontSize(9.5).fillColor(COLORS.warn).font("Helvetica-Bold")
        .text(`${metrics.longOverdue.length} tâche(s) à traiter en priorité.`, { continued: false });
      bullets(
        doc,
        metrics.longOverdue
          .slice(0, 15)
          .map((t) => `${t.title} — ${t.daysOverdue} jours de retard (échéance ${t.deadline ?? "—"})`),
        COLORS.warn
      );
    }

    if (metrics.carriedOver.length > 0) {
      heading(doc, "Tâches reportées d'une semaine antérieure");
      bullets(doc, metrics.carriedOver.slice(0, 15).map((t) => `${t.title} — échéance ${t.deadline ?? "—"}`));
    }

    // --- recommendations ---
    heading(doc, "Recommandations");
    for (const recommendation of report.recommendations) {
      if (doc.y > doc.page.height - 140) doc.addPage();
      const color =
        recommendation.kind === "reward" ? COLORS.good : recommendation.kind === "corrective" ? COLORS.warn : COLORS.accent;
      doc.fontSize(10).fillColor(color).font("Helvetica-Bold").text(recommendation.title);
      doc.fontSize(9).fillColor(COLORS.ink).font("Helvetica").text(recommendation.detail);
      if (recommendation.evidence.length > 0) {
        doc.moveDown(0.15);
        bullets(doc, recommendation.evidence.slice(0, 4), COLORS.muted);
      }
      if (recommendation.proposal) {
        doc.moveDown(0.15);
        doc
          .fontSize(8.5)
          .fillColor(COLORS.muted)
          .font("Helvetica-Oblique")
          .text("Proposition de tâche — à confirmer manuellement, rien n'est créé automatiquement.");
      }
      doc.moveDown(0.45);
    }

    // --- AI interpretation, clearly separated ---
    if (report.ai && report.ai.interpretation.length > 0) {
      heading(doc, "Interprétation IA");
      doc
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .font("Helvetica-Oblique")
        .text(
          "Texte généré par IA : commentaire qualitatif, indépendant des chiffres calculés ci-dessus.",
          { continued: false }
        );
      doc.moveDown(0.3);
      for (const paragraph of report.ai.interpretation) {
        doc.fontSize(9.5).fillColor(COLORS.ink).font("Helvetica").text(paragraph);
        doc.moveDown(0.25);
      }
      if (report.ai.focus.length > 0) {
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(COLORS.accent).font("Helvetica-Bold").text("Priorités proposées");
        bullets(doc, report.ai.focus);
      }
    }

    // --- unclear points ---
    if (metrics.journal.unclear.length > 0) {
      heading(doc, "Points notés comme non compris");
      bullets(doc, metrics.journal.unclear.slice(0, 10));
    }

    footer(doc, report);
    doc.end();
  });
}

const cache = new Map<string, { stamp: string; buffer: Buffer }>();
const CACHE_LIMIT = 8;

/** Renders a report, reusing the previous buffer while the report is unchanged. */
export async function renderReportPdfCached(report: StoredReport): Promise<Buffer> {
  const cached = cache.get(report.key);
  if (cached && cached.stamp === report.updatedAt) return cached.buffer;
  const buffer = await renderReportPdf(report);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(report.key, { stamp: report.updatedAt, buffer });
  return buffer;
}
