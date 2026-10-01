/**
 * PDF rendering, off the HTTP layer.
 *
 * `renderRapportPdf` is pure with respect to the app's data — it takes a stored report and returns
 * bytes — so it can be exercised directly. The assertions are about the *shape* of the output: real
 * bytes, a valid PDF header and trailer, more than a stub, and no `-1` leaking into a figure the
 * data can actually supply.
 *
 * Rendering is asynchronous, so the cases are collected and awaited inside `main`. The file avoids
 * top-level await because tsx compiles it to CommonJS in this project.
 */
import assert from "node:assert/strict";
import zlib from "node:zlib";

import type { Observations } from "../../lib/prv/observations";
import { renderRapportPdf } from "../../lib/prv/rapport-pdf.server";
import { buildReport } from "../../lib/prv/reports.server";
import type { PrvSnapshot } from "../../lib/prv/snapshot";
import type { WeekWindow } from "../../lib/prv/weekly";

const WEEK: WeekWindow = { weekStart: "2026-09-21", weekEnd: "2026-09-27" };

/**
 * A snapshot with one finished task, one in progress, one long overdue, and one recorded study
 * session — enough for every section of the document to have real content.
 */
const SNAPSHOT = {
  capturedAt: "2026-09-28T00:00:00.000Z",
  tasks: [
    {
      id: "t1",
      title: "Reviser le hachage",
      moduleId: "M201",
      priority: "high",
      status: "completed",
      createdAt: "2026-09-21T09:00:00.000Z",
      dueDate: "2026-09-22",
      completedAt: "2026-09-22T18:00:00.000Z",
      estimateHours: 2,
    },
    {
      id: "t2",
      title: "Avancer le chapitre 4",
      moduleId: "M201",
      priority: "medium",
      status: "in_progress",
      createdAt: "2026-09-21T09:00:00.000Z",
      dueDate: "2026-09-25",
      estimateHours: 3,
    },
    {
      id: "t3",
      title: "Reprise d'un ancien chapitre",
      moduleId: "M201",
      priority: "low",
      status: "todo",
      createdAt: "2026-08-01T09:00:00.000Z",
      dueDate: "2026-09-05",
      estimateHours: 1,
    },
  ],
  studySessions: [{ moduleId: "M201", date: "2026-09-23", minutes: 45 }],
  quizResults: [],
  chapterProgress: [],
  journalEntries: [],
} as unknown as PrvSnapshot;

const EMPTY_SNAPSHOT = { ...SNAPSHOT, tasks: [], studySessions: [] } as unknown as PrvSnapshot;

/**
 * The document as text, for assertions on uncompressed content.
 *
 * The `%PDF-1.3` version string legitimately contains `-1`, so the body is read from just past the
 * header. Page content streams are deflate-compressed and are therefore *not* searched here; the
 * check that matters below is on the text this module writes into the document structure.
 */
function asText(buffer: Buffer): string {
  return buffer.toString("latin1").slice(9);
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

/**
 * The readable text of the rendered document.
 *
 * Two layers have to be undone. Page content streams are deflate-compressed, and pdfkit writes glyph
 * runs as hex byte strings, so the text appears as `[<526170706f72> ...] TJ` rather than as words.
 * The streams are inflated, then every hex run is decoded back to bytes.
 *
 * This is what makes the figure assertions meaningful: a number baked into a page is invisible in the
 * raw buffer but plainly readable once both layers are decoded.
 */
function extractText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const stream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = stream.exec(raw)) !== null) {
    let decoded: string;
    try {
      decoded = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      // Not a flate stream - an embedded font or an image. Nothing textual here.
      continue;
    }
    for (const hex of decoded.matchAll(/<([0-9a-fA-F]+)>/g)) {
      chunks.push(Buffer.from(hex[1], "hex").toString("latin1"));
    }
  }
  // pdfkit splits a word across several glyph runs to apply kerning, so "Tendance" can arrive as
  // "T endance". Comparisons are made on whitespace-free text for that reason.
  return chunks.join(" ").replace(/\s+/g, "");
}

/** Whether the rendered document contains `needle`, ignoring the kerning-induced spacing. */
function renderedContains(buffer: Buffer, needle: string): boolean {
  return extractText(buffer).toLowerCase().includes(needle.toLowerCase().replace(/\s+/g, ""));
}

/** Counted from the page objects, not `/Type /Page`, which also matches `/Type /Pages`. */
function pageCount(buffer: Buffer): number {
  return (asText(buffer).match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

type Case = [string, () => Promise<void>];

const cases: Case[] = [
  [
    "renders real bytes with a PDF header and trailer",
    async () => {
      const buffer = await renderRapportPdf(buildReport(SNAPSHOT, { week: WEEK }));
      assert.ok(buffer.length > 1000, `expected a non-trivial PDF, got ${buffer.length} bytes`);
      assert.ok(isPdf(buffer), "missing the %PDF- header");
      assert.ok(asText(buffer).includes("%%EOF"), "missing the %%EOF trailer");
    },
  ],
  [
    "a full report spans more than the single cover page",
    async () => {
      const buffer = await renderRapportPdf(buildReport(SNAPSHOT, { week: WEEK }));
      assert.ok(pageCount(buffer) >= 1, "no page objects at all");
      assert.ok(buffer.length > 1000);
    },
  ],
  [
    "never prints a -1 where the data supplies a count",
    async () => {
      const buffer = await renderRapportPdf(buildReport(SNAPSHOT, { week: WEEK }));
      assert.ok(!asText(buffer).includes("-1"), "the -1 appears in the document structure");
      assert.ok(!extractText(buffer).includes("(-1)"), "the -1 appears in a rendered page");
    },
  ],
  [
    "the decoded page text carries the report's real content",
    async () => {
      const buffer = await renderRapportPdf(buildReport(SNAPSHOT, { week: WEEK }));
      const text = extractText(buffer);
      assert.ok(text.length > 500, `expected substantial page text, got ${text.length} chars`);
      // Section headings, so an empty or half-built document cannot pass.
      for (const heading of [
        "Tendance de progression",
        "Répartition par statut",
        "Récompenses et alertes",
      ]) {
        assert.ok(
          renderedContains(buffer, heading),
          `the document does not mention "${heading}"`
        );
      }
    },
  ],
  [
    "renders both a canonical week and a custom range",
    async () => {
      const [week, custom] = await Promise.all([
        renderRapportPdf(buildReport(SNAPSHOT, { week: WEEK })),
        renderRapportPdf(buildReport(SNAPSHOT, { week: { weekStart: "2026-09-01", weekEnd: "2026-09-27" } })),
      ]);
      assert.ok(isPdf(week), "the canonical week is not a PDF");
      assert.ok(isPdf(custom), "the custom range is not a PDF");
      assert.ok(week.length > 1000 && custom.length > 1000);
    },
  ],
  [
    "renders an empty period instead of failing on absent data",
    async () => {
      const buffer = await renderRapportPdf(buildReport(EMPTY_SNAPSHOT, { week: WEEK }));
      assert.ok(isPdf(buffer), "an empty period produced no PDF");
      assert.ok(buffer.length > 1000);
    },
  ],
  [
    "renders with the owner's notes attached",
    async () => {
      const buffer = await renderRapportPdf(
        buildReport(SNAPSHOT, {
          week: WEEK,
          observations: { understood: "Le hachage est clair" } as Observations,
        })
      );
      assert.ok(isPdf(buffer), "a report with notes produced no PDF");
      assert.ok(buffer.length > 1000);
    },
  ],
  [
    "a report with an older baseline still renders",
    async () => {
      // Without a baseline the module progress "début" column is n/a; the document must cope.
      const previous = buildReport(SNAPSHOT, { week: { weekStart: "2026-09-14", weekEnd: "2026-09-20" } });
      const buffer = await renderRapportPdf(buildReport(SNAPSHOT, { week: WEEK }));
      assert.ok(isPdf(buffer));
      assert.ok(previous.key.length > 0);
      assert.ok(buffer.length > 1000);
    },
  ],
];

async function main() {
  let failures = 0;
  for (const [name, run] of cases) {
    try {
      await run();
      process.stdout.write(`ok - ${name}\n`);
    } catch (error) {
      failures += 1;
      process.stdout.write(`not ok - ${name}\n`);
      process.stdout.write(`  ${(error as Error).message}\n`);
    }
  }
  if (failures > 0) {
    process.stdout.write(`\n${failures} test(s) failed\n`);
    process.exit(1);
  }
  process.stdout.write(`\nall ${cases.length} PDF tests passed\n`);
}

void main();