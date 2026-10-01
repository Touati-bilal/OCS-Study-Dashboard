"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BrainCircuit,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  Lock,
  Settings2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly, so "/prv" is not highlighted while inside "/prv/taches". */
  exact?: boolean;
}

/** The eight PRV sections. OCS-only, and each one is a server-gated route under /prv. */
const SECTIONS: Section[] = [
  { href: "/prv", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/prv/taches", label: "Tâches", icon: ListChecks },
  { href: "/prv/obsidian", label: "Obsidian", icon: FolderTree },
  { href: "/prv/ai", label: "IA", icon: BrainCircuit },
  { href: "/prv/rapports", label: "Rapport", icon: BarChart3 },
  { href: "/prv/analyse", label: "Analyse", icon: Sparkles },
  { href: "/prv/notifications", label: "Notifications", icon: Bell },
  { href: "/prv/parametres", label: "Paramètres privés", icon: Settings2 },
];

export function PrvNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
            <Lock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">PRV</p>
            <p className="truncate text-[11px] text-ink/50">Espace privé · OCS</p>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          Quitter
        </Link>
      </div>

      <nav className="mx-auto w-full max-w-6xl overflow-x-auto px-5 pb-2 md:px-8 lg:px-10">
        <ul className="flex w-max items-center gap-1">
          {SECTIONS.map((section) => {
            const active = section.exact
              ? pathname === section.href
              : pathname === section.href || pathname.startsWith(`${section.href}/`);
            const Icon = section.icon;
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                      : "text-ink/55 hover:bg-ink/5 hover:text-ink"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
