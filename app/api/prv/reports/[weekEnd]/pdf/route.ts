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
import { findReportByWeek } from "@/lib/prv/reports.server";
import { toIsoDate } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(weekEnd: string): string {
  return `rapport-prv-${weekEnd}.pdf`;
}

export async function GET(request: Request, { params }: { params: { weekEnd: string } }) {
  if (!(await requirePrvAccess(request))) return unauthorized();

  const weekEnd = toIsoDate(params.weekEnd);
  if (!weekEnd) return NextResponse.json({ error: "Semaine invalide." }, { status: 400 });

  const report = findReportByWeek(weekEnd);
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  const provided = new URL(request.url).searchParams.get("d");
  if (!provided || provided !== report.downloadId) {
    return NextResponse.json({ error: "Lien de téléchargement invalide." }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderReportPdfCached(report);
  } catch (error) {
    // The reason is logged server-side only; the caller just gets a generic failure.
    console.error("[prv] PDF generation failed", error);
    return NextResponse.json({ error: "Génération du PDF impossible." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${safeFilename(weekEnd)}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
