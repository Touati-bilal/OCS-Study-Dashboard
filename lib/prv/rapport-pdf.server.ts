/**
 * The weekly report PDF — the document the owner exports.
 *
 * Rendered on demand by an authorised route, held in memory, and streamed back with no-cache headers.
 * Nothing is written under `public/`, so there is no static URL to guess, and the buffer is rebuilt
 * from the stored report rather than cached to disk.
 *
 * The document follows one fixed structure, in this order: general information, task analysis, module
 * analysis, chapter / learning analysis, study consistency, performance, progress trend, overdue
 * tasks, rewards and warnings, and finally the owner's own notes.
 *
 * Two rules govern every figure printed here:
 *
 *   1. Nothing is invented. A value the store cannot support is printed as "n/a" with the reason,
 *      never as a zero and never as a plausible-looking guess.
 *   2. Nothing is inferred about the person. The document reports task states, dates and scores. It
 *      does not comment on motivation, mood, effort or wellbeing, and it never guesses why a task was
 *      left unfinished - it states how many days late it is and stops there.
 */

import "server-only";

import PDFDocument from "pdfkit";

import { getModuleById } from "@/lib/modules";
import type { DayActivity, ModuleWeekStat, TaskRef } from "./metrics";
import { filledObservations } from "./observations";
import type { StoredReport } from "./reports.server";
import { formatShortDate, formatWeekRange } from "./weekly";

const COLORS = {
  ink: "#0f172a",
  body: "#1e293b",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f1f5f9",
  accent: "#0f766e",
  accentSoft: "#ccfbf1",
  warn: "#b45309",
  warnSoft: "#fef3c7",
  good: "#15803d",
  goodSoft: "#dcfce7",
  down: "#b91c1c",
  downSoft: "#fee2e2",
} as const;

const PAGE_MARGIN = 44;

/** Placeholder used wherever a measurement the store cannot support would otherwise be printed. */
const NA = "n/a";

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - PAGE_MARGIN * 2;
}

/** Starts a new page when `needed` points would not fit, so no section is ever cut in half. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - 60) doc.addPage();
}

function sectionTitle(doc: PDFKit.PDFDocument, letter: string, text: string): void {
  ensureSpace(doc, 54);
  doc.moveDown(1.1);
  const y = doc.y;
  // A lettered chip keeps the A–F structure visible when the report is skimmed.
  doc.roundedRect(PAGE_MARGIN, y - 2, 20, 16, 4).fillColor(COLORS.accent).fill();
  doc
    .fontSize(9)
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .text(letter, PAGE_MARGIN + 5, y + 2, { width: 10, align: "center" });
  doc.fontSize(12.5).fillColor(COLORS.ink).font("Helvetica-Bold").text(text, PAGE_MARGIN + 27, y + 1);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, doc.y + 4)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 4)
    .stroke();
  doc.moveDown(0.6);
}

function subTitle(doc: PDFKit.PDFDocument, text: string): void {
  ensureSpace(doc, 30);
  doc.fontSize(10).fillColor(COLORS.accent).font("Helvetica-Bold").text(text);
  doc.moveDown(0.25);
}

function note(doc: PDFKit.PDFDocument, text: string): void {
  doc.fontSize(8).fillColor(COLORS.faint).font("Helvetica-Oblique").text(text);
  doc.moveDown(0.35);
}

/** A labelled figure followed by its value on the same line. */
function field(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  ink: string = COLORS.ink
): void {
  const startY = doc.y;
  doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica").text(`${label} : `, { continued: true });
  doc.fillColor(ink).font("Helvetica-Bold").text(value);
  if (doc.y === startY) doc.moveDown(0.22);
}

function bullets(doc: PDFKit.PDFDocument, items: string[], color: string = COLORS.body, limit = 20): void {
  if (items.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text("Aucun élément.");
    return;
  }
  for (const item of items.slice(0, limit)) {
    ensureSpace(doc, 16);
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica").text("• ", { continued: true });
    doc.fillColor(color).font("Helvetica").text(item);
  }
  if (items.length > limit) {
    doc.fontSize(8.5).fillColor(COLORS.faint).font("Helvetica-Oblique").text(`… et ${items.length - limit} autre(s).`);
  }
}

/**
 * A card of figures, laid out in a fixed grid.
 *
 * Values are printed exactly as given: the caller passes `"n/a"` when a figure is genuinely unknown,
 * so the grid can never round an absence into a number.
 */
function statGrid(doc: PDFKit.PDFDocument, stats: Array<{ label: string; value: string; tone?: "good" | "warn" | "down" | "muted" }>): void {
  const columns = 4;
  const gap = 8;
  const width = (contentWidth(doc) - gap * (columns - 1)) / columns;
  const toneColor = {
    good: COLORS.good,
    warn: COLORS.warn,
    down: COLORS.down,
    muted: COLORS.muted,
  } as const;

  stats.forEach((stat, index) => {
    if (index % columns === 0) {
      if (index > 0) doc.moveDown(0.5);
      ensureSpace(doc, 46);
    }
    const x = PAGE_MARGIN + (index % columns) * (width + gap);
    const y = doc.y;
    doc.roundedRect(x, y, width, 38, 5).fillColor(COLORS.soft).fill();
    doc.fontSize(7).fillColor(COLORS.muted).font("Helvetica").text(stat.label.toUpperCase(), x + 8, y + 6, {
      width: width - 16,
      ellipsis: true,
    });
    doc
      .fontSize(13)
      .fillColor(stat.tone ? toneColor[stat.tone] : COLORS.ink)
      .font("Helvetica-Bold")
      .text(stat.value, x + 8, y + 18, { width: width - 16, ellipsis: true });
    // pdfkit moves the cursor as it writes, so every cell is placed by absolute coordinates and the
    // cursor is restored to the row's baseline after the row is complete.
    if (index % columns === columns - 1 || index === stats.length - 1) {
      doc.y = y + 38;
      doc.x = PAGE_MARGIN;
    }
  });
}

/**
 * A real table with a header row, column widths and zebra striping.
 *
 * Column widths are fractions of the content width and are normalised, so a caller cannot produce a
 * layout wider than the page. A page break inside the header repeats it, which is what makes a long
 * task list readable.
 */
function table(
  doc: PDFKit.PDFDocument,
  columns: Array<{ header: string; width: number; align?: "left" | "right" }>,
  rows: string[][]
): void {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const widths = columns.map((column) => (column.width / total) * contentWidth(doc));
  const PAD = 5;

  const drawHeader = () => {
    ensureSpace(doc, 26);
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, contentWidth(doc), 16).fillColor(COLORS.accentSoft).fill();
    let x = PAGE_MARGIN;
    columns.forEach((column, index) => {
      const width = widths[index];
      doc
        .fontSize(7.5)
        .fillColor(COLORS.accent)
        .font("Helvetica-Bold")
        .text(column.header.toUpperCase(), x + PAD, y + 5, {
          width: width - PAD * 2,
          align: column.align ?? "left",
          ellipsis: true,
          lineBreak: false,
        });
      x += width;
    });
    doc.y = y + 16;
    doc.x = PAGE_MARGIN;
  };

  drawHeader();

  if (rows.length === 0) {
    doc.fontSize(9).fillColor(COLORS.muted).font("Helvetica-Oblique").text("Aucune ligne.");
    doc.moveDown(0.4);
    return;
  }

  rows.forEach((row, rowIndex) => {
    if (doc.y + 18 > doc.page.height - 60) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (rowIndex % 2 === 1) {
      doc.rect(PAGE_MARGIN, y, contentWidth(doc), 15).fillColor(COLORS.soft).fill();
    }
    let x = PAGE_MARGIN;
    columns.forEach((column, index) => {
      const width = widths[index];
      doc
        .fontSize(8)
        .fillColor(COLORS.body)
        .font("Helvetica")
        .text(row[index] ?? "", x + PAD, y + 4, {
          width: width - PAD * 2,
          align: column.align ?? "left",
          ellipsis: true,
          lineBreak: false,
        });
      x += width;
    });
    doc.y = y + 15;
    doc.x = PAGE_MARGIN;
  });
  doc.moveDown(0.5);
}

/** A horizontal bar with its percentage printed beside it. `null` renders as an explicit "n/a". */
function bar(doc: PDFKit.PDFDocument, ratio: number | null, width = 140): void {
  const y = doc.y;
  const height = 6;
  if (ratio === null) {
    doc.fontSize(8.5).fillColor(COLORS.faint).font("Helvetica-Oblique").text(`${NA} — non mesurable`, PAGE_MARGIN, y - 1);
    doc.y = y + 12;
    return;
  }
  doc.roundedRect(PAGE_MARGIN, y, width, height, 3).fillColor(COLORS.line).fill();
  const filled = (Math.max(0, Math.min(100, ratio)) / 100) * width;
  if (filled > 0) doc.roundedRect(PAGE_MARGIN, y, filled, height, 3).fillColor(COLORS.accent).fill();
  doc
    .fontSize(8.5)
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .text(`${Math.round(ratio * 10) / 10} %`, PAGE_MARGIN + width + 8, y - 2, { lineBreak: false });
  doc.y = y + 12;
}

/** Vertical bars for the per-day consistency chart, one per day of the period. */
function dayChart(doc: PDFKit.PDFDocument, days: DayActivity[]): void {
  const max = Math.max(1, ...days.map((d) => Math.max(d.completed, d.planned)));
  const width = contentWidth(doc);
  const gap = 4;
  const barWidth = Math.max(8, (width - gap * (days.length - 1)) / Math.max(1, days.length));
  const chartHeight = 62;
  const baseline = doc.y + chartHeight;

  ensureSpace(doc, chartHeight + 40);
  days.forEach((day, index) => {
    const x = PAGE_MARGIN + index * (barWidth + gap);
    const plannedHeight = (day.planned / max) * (chartHeight - 14);
    const doneHeight = (day.completed / max) * (chartHeight - 14);

    // Planned: outline only. Completed: filled. The two are never merged into one series.
    doc
      .rect(x, baseline - plannedHeight, barWidth, plannedHeight)
      .strokeColor(COLORS.faint)
      .lineWidth(0.5)
      .stroke();
    if (doneHeight > 0) {
      doc.rect(x, baseline - doneHeight, barWidth, doneHeight).fillColor(COLORS.accent).fill();
    }
    doc
      .fontSize(6)
      .fillColor(day.active ? COLORS.ink : COLORS.faint)
      .font("Helvetica")
      .text(day.label.split(" ")[0].slice(0, 3), x, baseline + 3, { width: barWidth, align: "center", lineBreak: false });
    doc
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text(day.date.slice(8), x, baseline + 12, { width: barWidth, align: "center", lineBreak: false });
  });

  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, baseline)
    .lineTo(PAGE_MARGIN + width, baseline)
    .stroke();
  doc.y = baseline + 22;
  doc.x = PAGE_MARGIN;
  doc.fontSize(8).fillColor(COLORS.muted).font("Helvetica").text(
    "Barre pleine = tâches terminées le jour · contour = tâches dont l'échéance tombe ce jour · " +
      `échelle jusqu'à ${max}.`
  );
  doc.moveDown(0.5);
}

function pct(value: number | null): string {
  return value === null ? NA : `${value} %`;
}

function taskLine(task: TaskRef, overdueLabel = ""): string {
  const deadline = task.deadline ? formatShortDate(task.deadline) : "sans échéance";
  const priority = task.priority === "prof" ? "prof" : task.priority === "important" ? "important" : "normal";
  return `« ${task.title} » — échéance ${deadline} · priorité ${priority}${overdueLabel}`;
}

// --------------------------------------------------------------------------- sections

function sectionGeneral(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  sectionTitle(doc, "A", "Informations générales");

  statGrid(doc, [
    { label: "Période", value: `${formatShortDate(metrics.weekStart)} → ${formatShortDate(metrics.weekEnd)}` },
    { label: "Nombre de jours", value: String(metrics.periodDays) },
    {
      label: "Modules travaillés",
      value: String(metrics.modules.filter((m) => m.tasksCompletedInPeriod > 0 || m.chaptersStudied > 0 || m.quizAttemptsInPeriod > 0).length),
    },
    { label: "Tâches totales suivies", value: String(metrics.totals.completedAllTime + metrics.totals.openAtWeekEnd) },
    { label: "Tâches prévues", value: String(metrics.planned.length) },
    {
      label: "Tâches terminées",
      value: String(metrics.completedPlanned.length),
      tone: "good",
    },
    {
      label: "Tâches non terminées",
      value: String(metrics.incomplete.length),
      tone: metrics.incomplete.length > 0 ? "warn" : undefined,
    },
    {
      label: "Taux d'achèvement",
      value: pct(metrics.completionRate),
      tone: metrics.completionRate === null ? "muted" : metrics.completionRate >= 70 ? "good" : "warn",
    },
    {
      label: "Taux d'inachèvement",
      value: pct(metrics.unfinishedRate),
      tone: metrics.unfinishedRate === null ? "muted" : metrics.unfinishedRate > 0 ? "warn" : "good",
    },
  ]);

  doc.moveDown(0.7);
  field(doc, "Rapport généré le", formatShortDate(report.updatedAt.slice(0, 10)));
  field(doc, "Première génération le", formatShortDate(report.createdAt.slice(0, 10)));
  field(
    doc,
    "Type de période",
    report.canonicalWeek ? "Semaine calendaire complète (7 jours)" : `Période personnalisée (${metrics.periodDays} jours)`
  );
  field(doc, "Enregistrements d'activité datés", `${metrics.activityCount} (tâches terminées ${metrics.completed.length} · quiz ${metrics.quiz.attemptsInWeek} · notes ${metrics.journal.entriesInWeek})`);
  field(doc, "Heures d'étude de la période", metrics.periodHours === null ? `${NA} — aucun relevé antérieur` : `${metrics.periodHours} h`);

  if (metrics.emptyPeriod) {
    doc.moveDown(0.5);
    doc
      .roundedRect(PAGE_MARGIN, doc.y, contentWidth(doc), 34, 5)
      .fillColor(COLORS.warnSoft)
      .fill();
    doc
      .fontSize(9)
      .fillColor(COLORS.warn)
      .font("Helvetica-Bold")
      .text(
        "Aucune activité enregistrée sur cette période : aucune tâche terminée, aucun quiz, aucune note journal. " +
          "Les sections suivantes affichent « n/a » plutôt que des chiffres.",
        PAGE_MARGIN + 10,
        doc.y + 7,
        { width: contentWidth(doc) - 20 }
      );
    doc.y += 40;
    doc.x = PAGE_MARGIN;
  }
}

function sectionTasks(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  sectionTitle(doc, "B", "Analyse des tâches");

  statGrid(doc, [
    { label: "Terminées sur la période", value: String(metrics.completed.length), tone: "good" },
    { label: "Planifiées et terminées", value: `${metrics.completedPlanned.length}/${metrics.planned.length}` },
    { label: "Planifiées non terminées", value: String(metrics.incomplete.length), tone: metrics.incomplete.length > 0 ? "warn" : undefined },
    { label: "Créées sur la période", value: String(metrics.totals.createdThisWeek) },
    { label: "Reportées d'avant", value: String(metrics.carriedOver.length), tone: metrics.carriedOver.length > 0 ? "warn" : undefined },
    { label: "En retard", value: String(metrics.overdue.length), tone: metrics.overdue.length > 0 ? "warn" : undefined },
    {
      label: `En retard > ${report.settings.overdueWarningDays} j`,
      value: String(metrics.longOverdue.length),
      tone: metrics.longOverdue.length > 0 ? "down" : undefined,
    },
    { label: "Encore ouvertes", value: String(metrics.totals.openAtWeekEnd) },
  ]);

  doc.moveDown(0.7);

  subTitle(doc, "Tâches terminées sur la période");
  table(
    doc,
    [
      { header: "Tâche", width: 46 },
      { header: "Module", width: 18 },
      { header: "Terminée le", width: 18 },
      { header: "Priorité", width: 18 },
    ],
    metrics.completed.slice(0, 40).map((task) => [
      task.title,
      moduleCodeOf(task.moduleId),
      task.completedAt ? formatShortDate(task.completedAt.slice(0, 10)) : NA,
      task.priority,
    ])
  );

  subTitle(doc, "Tâches prévues non terminées");
  table(
    doc,
    [
      { header: "Tâche", width: 44 },
      { header: "Module", width: 17 },
      { header: "Échéance", width: 17 },
      { header: "Priorité", width: 12 },
      { header: "Jours de retard", width: 10, align: "right" },
    ],
    metrics.incomplete.slice(0, 40).map((task) => [
      task.title,
      moduleCodeOf(task.moduleId),
      task.deadline ? formatShortDate(task.deadline) : NA,
      task.priority,
      task.daysOverdue > 0 ? String(task.daysOverdue) : "—",
    ])
  );

  subTitle(doc, "Répartition par priorité (tâches prévues sur la période)");
  table(
    doc,
    [
      { header: "Priorité", width: 34 },
      { header: "Total", width: 16, align: "right" },
      { header: "Terminées", width: 16, align: "right" },
      { header: "Ouvertes", width: 16, align: "right" },
      { header: "Taux", width: 18, align: "right" },
    ],
    (["prof", "important", "normal"] as const).map((priority) => {
      const bucket = metrics.byPriority[priority];
      return [
        priority,
        String(bucket.total),
        String(bucket.completed),
        String(bucket.open),
        bucket.total === 0 ? NA : pct(bucket.completionRate),
      ];
    })
  );

  subTitle(doc, "Répartition par statut (toutes les tâches suivies)");
  const tracked = metrics.totals.byStatus.todo + metrics.totals.byStatus.in_progress + metrics.totals.byStatus.completed;
  const statusLabels: Array<[string, "todo" | "in_progress" | "completed"]> = [
    ["À faire", "todo"],
    ["En cours", "in_progress"],
    ["Terminées", "completed"],
  ];
  table(
    doc,
    [
      { header: "Statut", width: 60 },
      { header: "Tâches", width: 20, align: "right" },
      { header: "Part", width: 20, align: "right" },
    ],
    statusLabels.map(([label, status]) => {
      const count = metrics.totals.byStatus[status];
      return [label, String(count), tracked === 0 ? NA : pct(Math.round((count / tracked) * 1000) / 10)];
    })
  );
  note(doc, "Les trois statuts sont ceux du tableau de tâches de l'application, comptés sur toutes les tâches suivies par ce rapport.");

  const important = metrics.incomplete
    .filter((task) => task.priority !== "normal")
    .slice(0, 10)
    .map((task) => taskLine(task, task.daysOverdue > 0 ? ` · ${task.daysOverdue} j de retard` : ""));
  subTitle(doc, "Tâches importantes laissées ouvertes");
  if (important.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text(
      "Aucune tâche importante ou demandée par le professeur n'est restée ouverte sur la période."
    );
    doc.moveDown(0.5);
  } else {
    bullets(doc, important);
  }
}

/** The module's own code for a task, resolved from the curriculum the app already defines. */
function moduleCodeOf(moduleId: string | null): string {
  if (!moduleId) return "—";
  return getModuleById(moduleId)?.code ?? moduleId;
}

function sectionModules(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  sectionTitle(doc, "C", "Analyse des modules");

  if (metrics.modules.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text(
      "Aucun module n'a de données d'avancement sur cette période."
    );
    doc.moveDown(0.5);
    return;
  }

  table(
    doc,
    [
      { header: "Module", width: 30 },
      { header: "Début", width: 10, align: "right" },
      { header: "Fin", width: 10, align: "right" },
      { header: "Variation", width: 11, align: "right" },
      { header: "Act. faites", width: 11, align: "right" },
      { header: "Act. restantes", width: 12, align: "right" },
      { header: "Quiz", width: 8, align: "right" },
      { header: "Heures", width: 8, align: "right" },
    ],
    metrics.modules.map((module) => [
      `${module.code} · ${module.name}`,
      module.startProgress === null ? NA : pct(module.startProgress),
      pct(module.endProgress),
      module.progressChange === null ? NA : `${module.progressChange > 0 ? "+" : ""}${module.progressChange} pts`,
      `${module.activitiesCompleted}/${module.objectivesTotal}`,
      String(module.activitiesRemaining),
      module.bestQuizPercentage === null ? "—" : `${module.bestQuizPercentage} %`,
      module.hoursDelta === null ? `${module.hoursStudied}*` : `${module.hoursDelta} h`,
    ])
  );
  note(
    doc,
    "Act. faites / restantes = objectifs d'apprentissage validés, l'unité de suivi que l'application enregistre " +
      "réellement. Le suivi est fait par objectif et par chapitre, pas par document : aucun fichier n'est " +
      "compté comme « activité ». * heures cumulées du module, la variation n'étant mesurable qu'entre deux relevés. " +
      "« Début » reste n/a tant qu'aucun rapport antérieur n'existe pour servir de point de départ."
  );

  doc.moveDown(0.6);
  for (const entry of metrics.modules) {
    ensureSpace(doc, 72);
    moduleBlock(doc, entry);
  }
}

function moduleBlock(doc: PDFKit.PDFDocument, module: ModuleWeekStat): void {
  const y = doc.y;
  doc.fontSize(10).fillColor(COLORS.ink).font("Helvetica-Bold").text(
    `${module.code} — ${module.name}`,
    PAGE_MARGIN,
    y,
    { width: contentWidth(doc) - 150, ellipsis: true, lineBreak: false }
  );
  bar(doc, module.endProgress, 140);
  doc.y = y + 16;
  doc.x = PAGE_MARGIN;

  doc.fontSize(8.5).fillColor(COLORS.muted).font("Helvetica").text(
    `coefficient ${module.coefficient} · variation ${module.progressChange === null ? NA : `${module.progressChange > 0 ? "+" : ""}${module.progressChange} pts`} · ` +
      `${module.activitiesCompleted}/${module.objectivesTotal} objectifs validés · ${module.chaptersDone}/${module.chaptersTotal} chapitres terminés · ` +
      `${module.chaptersStudied} chapitre(s) travaillé(s) sur la période · ${module.tasksCompletedInPeriod} tâche(s) terminée(s) · ` +
      `quiz ${module.quizAttemptsInPeriod === 0 ? "aucun" : `${module.quizAttemptsInPeriod} tentative(s), meilleur ${module.bestQuizPercentage} %`}`,
    PAGE_MARGIN,
    doc.y,
    { width: contentWidth(doc) }
  );
  doc.moveDown(0.5);
}

function sectionChapters(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  sectionTitle(doc, "D", "Analyse des chapitres / apprentissages");

  const studied = metrics.chapters.filter((chapter) => chapter.studied);
  if (studied.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text(
      "Aucun chapitre n'a d'activité datée sur cette période. Un chapitre est compté comme travaillé seulement " +
        "si une tâche y a été terminée ou si un quiz de ce chapitre a été passé dans la période."
    );
    doc.moveDown(0.5);
  } else {
    table(
      doc,
      [
        { header: "Module", width: 16 },
        { header: "Chapitre", width: 38 },
        { header: "Objectifs", width: 16, align: "right" },
        { header: "Tâches finies", width: 15, align: "right" },
        { header: "Quiz", width: 15, align: "right" },
      ],
      studied.map((chapter) => [
        moduleCodeOf(chapter.moduleId),
        chapter.title,
        `${chapter.objectivesDone}/${chapter.objectivesTotal}`,
        String(chapter.completedInPeriod),
        chapter.quizInPeriod === null ? "—" : `${chapter.quizInPeriod.percentage} %`,
      ])
    );
    note(
      doc,
      "Tâches finies et quiz sont datés dans la période. Les objectifs affichent l'état actuel du chapitre, " +
        "que l'application ne daterait pas individuellement."
    );
  }

  if (metrics.quiz.attempts.length > 0) {
    doc.moveDown(0.5);
    subTitle(doc, "Résultats de quiz de la période");
    table(
      doc,
      [
        { header: "Date", width: 18 },
        { header: "Module", width: 20 },
        { header: "Chapitre", width: 26 },
        { header: "Score", width: 12, align: "right" },
        { header: "Bonnes", width: 12, align: "right" },
        { header: "Total", width: 12, align: "right" },
      ],
      metrics.quiz.attempts.map((attempt) => [
        formatShortDate(attempt.date),
        moduleCodeOf(attempt.moduleId),
        attempt.chapterId ? chapterTitle(attempt.moduleId, attempt.chapterId) : "quiz de module",
        `${attempt.percentage} %`,
        String(attempt.correct),
        String(attempt.total),
      ])
    );
  }
}

function chapterTitle(moduleId: string, chapterId: string): string {
  const curriculum = getModuleById(moduleId);
  if (!curriculum) return chapterId;
  const chapter = curriculum.chapters.find((c) => c.id === chapterId);
  return chapter ? chapter.title : chapterId;
}

function sectionConsistency(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  sectionTitle(doc, "E", "Cohérence de travail");

  dayChart(doc, metrics.days);

  table(
    doc,
    [
      { header: "Jour", width: 30 },
      { header: "Prévues", width: 12, align: "right" },
      { header: "Terminées", width: 14, align: "right" },
      { header: "Créées", width: 12, align: "right" },
      { header: "Non faites", width: 13, align: "right" },
      { header: "Quiz", width: 9, align: "right" },
      { header: "Notes", width: 10, align: "right" },
    ],
    metrics.days.map((day) => [
      day.label,
      String(day.planned),
      String(day.completed),
      String(day.created),
      String(day.missed),
      String(day.quizzes),
      String(day.journalEntries),
    ])
  );

  const active = metrics.days.filter((d) => d.active).length;
  const quiet = metrics.days.filter((d) => !d.active).map((d) => d.label);
  doc.moveDown(0.4);
  field(doc, "Jours avec au moins un enregistrement", `${active}/${metrics.periodDays}`);
  field(doc, "Jours sans aucun enregistrement", quiet.length === 0 ? "aucun" : quiet.join(", "));
  field(
    doc,
    "Tâches en retard déjà ouvertes au début de la période",
    String(metrics.carriedOver.length)
  );
}

function sectionPerformance(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  sectionTitle(doc, "F", "Performance de la période");

  statGrid(doc, [
    {
      label: "Taux d'achèvement",
      value: pct(metrics.completionRate),
      tone: metrics.completionRate === null ? "muted" : metrics.completionRate >= 70 ? "good" : "warn",
    },
    {
      label: "Taux d'inachèvement",
      value: pct(metrics.unfinishedRate),
      tone: metrics.unfinishedRate === null ? "muted" : metrics.unfinishedRate > 0 ? "warn" : "good",
    },
    { label: "Activité datée", value: String(metrics.activityCount) },
    { label: "Progression pondérée", value: pct(report.weightedProgress) },
    {
      label: "Quiz (moyenne)",
      value: metrics.quiz.averagePercentage === null ? NA : `${metrics.quiz.averagePercentage} %`,
      tone: metrics.quiz.averagePercentage === null ? "muted" : undefined,
    },
    {
      label: "Quiz (meilleur)",
      value: metrics.quiz.bestPercentage === null ? NA : `${metrics.quiz.bestPercentage} %`,
      tone: "muted",
    },
    {
      label: "Tâches en retard",
      value: String(metrics.overdue.length),
      tone: metrics.overdue.length > 0 ? "warn" : undefined,
    },
    {
      label: `Retard > ${report.settings.overdueWarningDays} j`,
      value: String(metrics.longOverdue.length),
      tone: metrics.longOverdue.length > 0 ? "down" : undefined,
    },
  ]);

  doc.moveDown(0.7);
  field(doc, "Tâches terminées (toutes périodes confondues)", String(metrics.totals.completedAllTime));
  field(doc, "Tâches encore ouvertes", String(metrics.totals.openAtWeekEnd));
  field(
    doc,
    "Quiz",
    metrics.quiz.attemptsInWeek === 0
      ? "aucune tentative enregistrée sur la période"
      : `${metrics.quiz.attemptsInWeek} tentative(s) · ${metrics.quiz.correctAnswers}/${metrics.quiz.totalQuestions} bonnes réponses · meilleur ${metrics.quiz.bestPercentage} % · plus bas ${metrics.quiz.lowestPercentage} %`
  );
  field(
    doc,
    "Heures d'étude",
    metrics.periodHours === null
      ? `${NA} — le total du module est cumulatif et aucun relevé antérieur n'existe pour en déduire la période`
      : `${metrics.periodHours} h sur la période`
  );

  const noteUnclear = metrics.journal.unclear.slice(0, 8);
  if (noteUnclear.length > 0) {
    doc.moveDown(0.4);
    subTitle(doc, "Points notés comme non compris dans vos notes de la période");
    bullets(doc, noteUnclear.map((text) => `« ${text.length > 110 ? `${text.slice(0, 110)}…` : text} »`), COLORS.warn, 8);
  }
}

function sectionTrend(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { trajectory, weightedProgress } = report;
  sectionTitle(doc, "→", "Tendance de progression");

  const tone =
    trajectory.trajectory === "slipping"
      ? { ink: COLORS.down, soft: COLORS.downSoft, label: "Baisse" }
      : trajectory.trajectory === "improving"
        ? { ink: COLORS.good, soft: COLORS.goodSoft, label: "En hausse" }
        : trajectory.trajectory === "stable"
          ? { ink: COLORS.accent, soft: COLORS.accentSoft, label: "Stable" }
          : { ink: COLORS.muted, soft: COLORS.soft, label: "Données insuffisantes" };

  const boxTop = doc.y;
  ensureSpace(doc, 76);
  doc.roundedRect(PAGE_MARGIN, boxTop, contentWidth(doc), 62, 6).fillColor(tone.soft).fill();
  doc.fontSize(30).fillColor(tone.ink).font("Helvetica-Bold").text(
    trajectory.arrow,
    PAGE_MARGIN + 14,
    boxTop + 14,
    { width: 46, align: "center", lineBreak: false }
  );
  doc
    .fontSize(12)
    .fillColor(tone.ink)
    .font("Helvetica-Bold")
    .text(tone.label, PAGE_MARGIN + 66, boxTop + 14, { width: contentWidth(doc) - 80, lineBreak: false });
  doc
    .fontSize(9)
    .fillColor(COLORS.body)
    .font("Helvetica")
    .text(trajectory.headline, PAGE_MARGIN + 66, boxTop + 32, { width: contentWidth(doc) - 80 });
  doc.y = boxTop + 68;
  doc.x = PAGE_MARGIN;

  doc.moveDown(0.4);
  field(doc, "Progression pondérée actuelle", pct(weightedProgress));
  bar(doc, weightedProgress, 160);
  field(doc, "Écart avec la période précédente", trajectory.delta === null ? NA : `${trajectory.delta > 0 ? "+" : ""}${trajectory.delta} pts`);
  field(doc, "Règle appliquée", trajectory.rule);

  doc.moveDown(0.4);
  subTitle(doc, "Pourquoi cette tendance, d'après les données");
  bullets(doc, trajectory.explain);

  if (trajectory.points.length > 1) {
    doc.moveDown(0.4);
    subTitle(doc, "Historique des progressions pondérées");
    table(
      doc,
      [
        { header: "Période", width: 46 },
        { header: "Progression pondérée", width: 27, align: "right" },
        { header: "Taux d'achèvement", width: 27, align: "right" },
      ],
      trajectory.points.map((point) => [
        point.label,
        pct(point.weightedProgress),
        pct(point.completionRate),
      ])
    );
  }

  note(
    doc,
    "La tendance compare uniquement des pourcentages calculés sur vos tâches, vos objectifs et vos quiz. " +
      "Aucune conclusion sur l'effort, la motivation ou l'état personnel n'en est tirée."
  );
}

function sectionOverdue(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;
  const threshold = report.settings.overdueWarningDays;

  sectionTitle(doc, "!", "Tâches en retard");

  if (metrics.overdue.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text(
      "Aucune tâche ouverte n'est dépassée par son échéance à la fin de la période."
    );
    doc.moveDown(0.5);
    return;
  }

  if (metrics.carriedOver.length > 0) {
    subTitle(doc, "Tâches reportées d'une période antérieure");
    table(
      doc,
      [
        { header: "Tâche", width: 40 },
        { header: "Échéance", width: 18 },
        { header: "Jours de retard", width: 20, align: "right" },
        { header: "Priorité", width: 22 },
      ],
      metrics.carriedOver.slice(0, 30).map((task) => [
        task.title,
        task.deadline ? formatShortDate(task.deadline) : NA,
        String(task.daysOverdue),
        task.priority,
      ])
    );
  }

  if (metrics.longOverdue.length > 0) {
    doc.moveDown(0.3);
    subTitle(doc, `En retard depuis plus de ${threshold} jours (${metrics.longOverdue.length} tâche${metrics.longOverdue.length > 1 ? "s" : ""})`);

    const alertTop = doc.y;
    ensureSpace(doc, 40);
    doc.roundedRect(PAGE_MARGIN, alertTop, contentWidth(doc), 30, 5).fillColor(COLORS.downSoft).fill();
    doc
      .fontSize(9.5)
      .fillColor(COLORS.down)
      .font("Helvetica-Bold")
      .text(
        "Cette tâche est en retard depuis plus de deux semaines.",
        PAGE_MARGIN + 10,
        alertTop + 10,
        { width: contentWidth(doc) - 20 }
      );
    doc.y = alertTop + 36;
    doc.x = PAGE_MARGIN;
    note(doc, "Phrase appliquée à chacune des tâches listées ci-dessous. Aucune raison n'est supposée : le rapport n'indique que le nombre de jours de retard.");

    table(
      doc,
      [
        { header: "Tâche", width: 36 },
        { header: "Module", width: 14 },
        { header: "Échéance", width: 16 },
        { header: "Jours", width: 10, align: "right" },
        { header: "Priorité", width: 12 },
        { header: "Statut", width: 12 },
      ],
      metrics.longOverdue
        .slice()
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .map((task) => [
          task.title,
          moduleCodeOf(task.moduleId),
          task.deadline ? formatShortDate(task.deadline) : NA,
          String(task.daysOverdue),
          task.priority,
          task.status === "in_progress" ? "en cours" : "à faire",
        ])
    );
  }

  const remaining = metrics.overdue.filter((task) => !metrics.longOverdue.some((t) => t.id === task.id));
  if (remaining.length > 0) {
    doc.moveDown(0.3);
    subTitle(doc, "Autres tâches en retard (moins de deux semaines)");
    table(
      doc,
      [
        { header: "Tâche", width: 48 },
        { header: "Échéance", width: 20 },
        { header: "Jours", width: 12, align: "right" },
        { header: "Priorité", width: 20 },
      ],
      remaining.slice(0, 25).map((task) => [
        task.title,
        task.deadline ? formatShortDate(task.deadline) : NA,
        String(task.daysOverdue),
        task.priority,
      ])
    );
  }
}

function sectionRewards(doc: PDFKit.PDFDocument, report: StoredReport): void {
  sectionTitle(doc, "★", "Récompenses et alertes");

  if (report.recommendations.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text(
      "Aucun indicateur à signaler sur cette période."
    );
    doc.moveDown(0.5);
    return;
  }

  for (const recommendation of report.recommendations) {
    ensureSpace(doc, 70);
    const tone =
      recommendation.kind === "reward"
        ? { ink: COLORS.good, soft: COLORS.goodSoft, tag: "RÉCOMPENSE" }
        : recommendation.kind === "corrective"
          ? { ink: COLORS.warn, soft: COLORS.warnSoft, tag: "ALERTE" }
          : { ink: COLORS.accent, soft: COLORS.accentSoft, tag: "INFORMATION" };

    const boxTop = doc.y;
    // Height is reserved before drawing so a long title cannot overflow the tinted block.
    const titleHeight = doc.fontSize(10).font("Helvetica-Bold").heightOfString(recommendation.title, {
      width: contentWidth(doc) - 24,
    });
    const detailHeight = doc.fontSize(8.8).font("Helvetica").heightOfString(recommendation.detail, {
      width: contentWidth(doc) - 24,
    });
    const evidenceHeight = recommendation.evidence.length
      ? doc.fontSize(8.2).font("Helvetica").heightOfString(
          recommendation.evidence.map((e) => `• ${e}`).join("\n"),
          { width: contentWidth(doc) - 30 }
        )
      : 0;
    const boxHeight = 20 + titleHeight + detailHeight + evidenceHeight + 14;

    doc.roundedRect(PAGE_MARGIN, boxTop, contentWidth(doc), boxHeight, 6).fillColor(tone.soft).fill();
    doc
      .fontSize(7)
      .fillColor(tone.ink)
      .font("Helvetica-Bold")
      .text(tone.tag, PAGE_MARGIN + 12, boxTop + 7, { width: contentWidth(doc) - 24, lineBreak: false });
    doc
      .fontSize(10)
      .fillColor(tone.ink)
      .font("Helvetica-Bold")
      .text(recommendation.title, PAGE_MARGIN + 12, boxTop + 19, { width: contentWidth(doc) - 24 });
    doc
      .fontSize(8.8)
      .fillColor(COLORS.body)
      .font("Helvetica")
      .text(recommendation.detail, PAGE_MARGIN + 12, doc.y + 2, { width: contentWidth(doc) - 24 });
    if (recommendation.evidence.length > 0) {
      doc
        .fontSize(8.2)
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .text(recommendation.evidence.map((e) => `• ${e}`).join("\n"), PAGE_MARGIN + 16, doc.y + 3, {
          width: contentWidth(doc) - 30,
        });
    }
    doc.y = boxTop + boxHeight + 8;
    doc.x = PAGE_MARGIN;
  }

  note(
    doc,
    "Chaque message est déclenché par une valeur mesurée, citée dans sa zone « evidence ». " +
      "Aucune appréciation médicale, psychologique ou professionnelle n'est formulée."
  );
}

function sectionObservations(doc: PDFKit.PDFDocument, report: StoredReport): void {
  sectionTitle(doc, "✎", "Observations de la période");

  const filled = filledObservations(report.observations);
  if (filled.length === 0) {
    doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text(
      "Aucune observation n'a été écrite pour cette période. Ce bloc est facultatif et n'est jamais rempli automatiquement."
    );
    doc.moveDown(0.5);
    return;
  }

  note(
    doc,
    "Notes rédigées par vos soins. Elles ne sont ni générées ni modifiées par l'application."
  );
  for (const entry of filled) {
    ensureSpace(doc, 40);
    const labelTop = doc.y;
    doc.fontSize(9.5).fillColor(COLORS.accent).font("Helvetica-Bold").text(entry.label, PAGE_MARGIN, labelTop, {
      width: contentWidth(doc),
    });
    doc
      .fontSize(9.5)
      .fillColor(COLORS.body)
      .font("Helvetica")
      .text(entry.text, PAGE_MARGIN, doc.y + 2, { width: contentWidth(doc) });
    doc.moveDown(0.6);
  }
}

/** Repeats the private-document footer and the provenance line on every page. */
function footer(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 30;
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN, y - 8)
      .lineTo(doc.page.width - PAGE_MARGIN, y - 8)
      .stroke();
    doc
      .fontSize(7.2)
      .fillColor(COLORS.faint)
      .font("Helvetica")
      .text(
        `Document privé · rapport du ${formatWeekRange(report.weekStart, report.weekEnd)} · page ${i + 1}/${range.count}`,
        PAGE_MARGIN,
        y,
        { width: contentWidth(doc), align: "center", lineBreak: false }
      );
    doc
      .fontSize(6.6)
      .fillColor(COLORS.faint)
      .font("Helvetica")
      .text(
        "Chiffres calculés à partir des données réelles de l'application · aucune donnée d'exemple",
        PAGE_MARGIN,
        y + 10,
        { width: contentWidth(doc), align: "center", lineBreak: false }
      );
  }
}

function cover(doc: PDFKit.PDFDocument, report: StoredReport): void {
  const { metrics } = report;

  // A slim accent band: the study-dashboard identity without a logo, so nothing depends on an asset.
  doc.rect(0, 0, doc.page.width, 6).fillColor(COLORS.accent).fill();

  doc.moveDown(1.4);
  doc.fontSize(8.5).fillColor(COLORS.accent).font("Helvetica-Bold").text("OCS STUDY DASHBOARD · RAPPORT HEBDOMADAIRE");
  doc.moveDown(0.5);
  doc.fontSize(22).fillColor(COLORS.ink).font("Helvetica-Bold").text("Rapport de période");
  doc.moveDown(0.2);
  doc
    .fontSize(13)
    .fillColor(COLORS.body)
    .font("Helvetica")
    .text(`${formatShortDate(metrics.weekStart)}  →  ${formatShortDate(metrics.weekEnd)}`, { continued: false });
  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .text(
      `${metrics.periodDays} jour${metrics.periodDays > 1 ? "s" : ""} · ${metrics.planned.length} tâche(s) prévue(s) · ` +
        `${metrics.completed.length} terminée(s) · taux d'achèvement ${pct(metrics.completionRate)} · ` +
        `tendance ${report.trajectory.arrow}`,
      { continued: false }
    );

  doc.moveDown(0.8);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .stroke();
  doc.moveDown(0.6);

  // A one-paragraph summary, entirely composed of figures already printed elsewhere in the document.
  const summaryParts = [
    metrics.planned.length === 0
      ? `aucune tâche n'avait d'échéance sur la période, donc le taux d'achèvement n'est pas calculable`
      : `${metrics.completedPlanned.length} des ${metrics.planned.length} tâches prévues ont été terminées (${pct(metrics.completionRate)})`,
    `${metrics.completed.length} tâche(s) terminée(s) au total sur la période`,
    `${metrics.activityCount} enregistrement(s) d'activité daté(s)`,
    metrics.overdue.length === 0
      ? "aucune tâche en retard"
      : `${metrics.overdue.length} tâche(s) en retard, dont ${metrics.longOverdue.length} depuis plus de ${report.settings.overdueWarningDays} jours`,
    metrics.quiz.attemptsInWeek === 0
      ? "aucun quiz passé"
      : `${metrics.quiz.attemptsInWeek} quiz passé(s), moyenne ${metrics.quiz.averagePercentage} %`,
  ];
  doc.fontSize(9.5).fillColor(COLORS.muted).font("Helvetica-Oblique").text("Résumé — " + summaryParts.join(" · ") + ".");
  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .fillColor(COLORS.faint)
    .font("Helvetica")
    .text(
      `Document privé généré le ${formatShortDate(report.updatedAt.slice(0, 10))}` +
        (report.generation > 1 ? ` · régénéré ${report.generation}× sur la même période` : "") +
        " · toutes les valeurs proviennent des tâches, objectifs, quiz et notes réellement enregistrés dans l'application."
    );
}

export function renderRapportPdf(report: StoredReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    cover(doc, report);
    sectionGeneral(doc, report);
    sectionTasks(doc, report);
    sectionModules(doc, report);
    sectionChapters(doc, report);
    sectionConsistency(doc, report);
    sectionPerformance(doc, report);
    sectionTrend(doc, report);
    sectionOverdue(doc, report);
    sectionRewards(doc, report);
    sectionObservations(doc, report);

    footer(doc, report);
    doc.end();
  });
}

const cache = new Map<string, { stamp: string; buffer: Buffer }>();
const CACHE_LIMIT = 6;

/**
 * Renders the report, reusing the previous buffer while nothing in it has changed.
 *
 * Keyed on the reference *and* the update stamp, because notes are saved through a different route
 * than the figures: a note edit bumps `updatedAt` too, so the PDF can never go stale behind an edit.
 */
export async function renderRapportPdfCached(report: StoredReport): Promise<Buffer> {
  const cached = cache.get(report.key);
  if (cached && cached.stamp === report.updatedAt) return cached.buffer;
  const buffer = await renderRapportPdf(report);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(report.key, { stamp: report.updatedAt, buffer });
  return buffer;
}
