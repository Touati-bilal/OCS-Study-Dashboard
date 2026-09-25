import { NextRequest, NextResponse } from "next/server";
import { getModuleActivityGroups } from "@/lib/activities.server";

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId requis" }, { status: 400 });

  return NextResponse.json({ groups: getModuleActivityGroups(moduleId) });
}
