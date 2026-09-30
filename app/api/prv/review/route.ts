/**
 * GET    /api/prv/review — the "À revoir" list (points the owner flagged to come back to).
 * POST   /api/prv/review — add an item.
 * DELETE /api/prv/review — remove an item by id.
 *
 * The list is explicitly *not* a task list: these are notes to revisit, and creating one never
 * touches the task store. Stored server-side so it survives a cleared browser.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { newOpaqueId, readCollection, updateCollection } from "@/lib/prv/store.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReviewItem {
  id: string;
  text: string;
  moduleId: string | null;
  createdAt: string;
  done: boolean;
}

function list(): ReviewItem[] {
  return readCollection<ReviewItem>("review-items").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function GET(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  return NextResponse.json({ items: list() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const text = typeof raw.text === "string" ? raw.text.replace(/\u0000/g, "").trim().slice(0, 500) : "";
  if (text.length === 0) return NextResponse.json({ error: "Texte requis." }, { status: 400 });

  const item: ReviewItem = {
    id: newOpaqueId(9),
    text,
    moduleId: typeof raw.moduleId === "string" && /^[A-Za-z0-9-]{1,16}$/.test(raw.moduleId) ? raw.moduleId : null,
    createdAt: new Date().toISOString(),
    done: false,
  };
  await updateCollection<ReviewItem>("review-items", (items) => [...items, item]);
  return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  let id = "";
  try {
    const body = await request.json();
    id = typeof body?.id === "string" ? body.id.slice(0, 64) : "";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (id.length === 0) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });

  const before = list().length;
  await updateCollection<ReviewItem>("review-items", (items) => items.filter((item) => item.id !== id));
  return NextResponse.json({ ok: true, removed: before !== list().length }, { headers: { "Cache-Control": "no-store" } });
}
