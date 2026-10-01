/**
 * GET /api/prv/reports/[weekEnd]/pdf — the weekly report as a PDF.
 *
 * Three independent checks stand between a stranger and this file:
 *   1. a valid PRV session cookie,
 *   2. a report that actually exists for that week,
 *   3. the report's unguessable `downloadId` matching the `d` parameter.
 *
 * The week alone is not enough, and the file never lives under `public/`, so there is no static URL
 * to enumerate. Responses are `no-store` and the PDF is not attached to the page as a link target
 * a browser could prefetch.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, unauthorized } from "@/lib/prv/guard.server";
import { renderReportPdfCached } from "@/lib/prv/pdf.server";
import { renderRapportPdfCached } from "@/lib/prv/rapport-pdf.server";
import { findReport } from "@/lib/prv/reports.server";
import { getSettings } from "@/lib/prv/settings.server";
import { parseReportRef } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A date-bounded, unambiguous filename. Both ends are used so two custom ranges cannot collide. */
function safeFilename(weekStart: string, weekEnd: string, format: string): string {
  return format === "rapport"
    ? `rapport-prv-${weekStart}_${weekEnd}.pdf`
    : `rapport-prv-${weekEnd}.pdf`;
}

export async function GET(request: Request, { params }: { params: { weekEnd: string } }) {
  if (!(await requirePrvAccess(request))) return unauthorized();

  const ref = parseReportRef(params.weekEnd);
  if (!ref) return NextResponse.json({ error: "Semaine invalide." }, { status: 400 });

  const report = findReport(params.weekEnd, getSettings());
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  // The unguessable id is still required: knowing a period exists must not be enough to read it.
  const provided = new URL(request.url).searchParams.get("d");
  if (!provided || provided !== report.downloadId) {
    return NextResponse.json({ error: "Lien de téléchargement invalide." }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    // The `format` switch picks the document. `rapport` is the structured A–F weekly report; the
    // default stays the original weekly layout so an existing bookmark keeps rendering what it did.
    const format = new URL(request.url).searchParams.get("format") === "rapport" ? "rapport" : "summary";
    buffer =
      format === "rapport"
        ? await renderRapportPdfCached(report)
        : await renderReportPdfCached(report);
  } catch (error) {
    // The reason is logged server-side only; the caller just gets a generic failure.
    console.error("[prv] PDF generation failed", error);
    return NextResponse.json({ error: "Génération du PDF impossible." }, { status: 500 });
  }

  const format = new URL(request.url).searchParams.get("format") === "rapport" ? "rapport" : "summary";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${safeFilename(report.weekStart, report.weekEnd, format)}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
