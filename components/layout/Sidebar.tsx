"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ShieldCheck, Layers, CalendarClock, LifeBuoy, ExternalLink, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_URL } from "@/lib/help";
import { APP_NAME, APP_VERSION_LABEL } from "@/lib/app-info";
import { useAppStore } from "@/store/useAppStore";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: LayoutDashboard, ocsOnly: false },
  { href: "/modules", label: "Modules", icon: ShieldCheck, ocsOnly: false },
  { href: "/secondary", label: "EGTS", icon: Layers, ocsOnly: false },
  { href: "/planning", label: "Planning", icon: CalendarClock, ocsOnly: false },
  // PRV is OCS-only and separately authenticated: the link is hidden for OCC / ORS, and the pages
  // themselves re-check the session on the server.
  { href: "/prv", label: "PRV", icon: Lock, ocsOnly: true },
];

const HELP_ITEM = { href: HELP_URL, label: "Help", icon: LifeBuoy, external: true };

export function Sidebar() {
  const pathname = usePathname();
  const studyOption = useAppStore((s) => s.studyOption);
  const items = NAV_ITEMS.filter((item) => !item.ocsOnly || studyOption === "OCS");

  return (
    <aside className="relative z-10 hidden w-60 shrink-0 flex-col border-r border-ink/8 bg-paper lg:w-64 md:flex">
      <div className="flex items-center gap-3 px-5 py-6 lg:px-6">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-ink/15 shadow-glow">
          <Image src="/logo.jpg" alt="Logo" fill sizes="40px" className="object-cover" priority />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold leading-tight text-ink">OCS Study</p>
          <p className="truncate text-[11px] leading-tight text-ink/40">Dashboard</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
            >
              {active && (
                <motion.div
                  layoutId="sidebar-pill"
                  className="absolute inset-0 rounded-xl bg-brand-500/15"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                size={19}
                className={cn("relative z-10 shrink-0 transition-colors", active ? "text-brand-400" : "text-ink/45")}
                strokeWidth={active ? 2.3 : 1.9}
              />
              <span className={cn("relative z-10 truncate transition-colors", active ? "text-ink" : "text-ink/55")}>
                {item.label}
              </span>
            </Link>
          );
        })}

        <a
          href={HELP_ITEM.href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
        >
          <LifeBuoy
            size={19}
            className="relative z-10 shrink-0 text-ink/45"
            strokeWidth={1.9}
          />
          <span className="relative z-10 truncate text-ink/55">Help</span>
          <ExternalLink size={13} className="relative z-10 ml-auto shrink-0 text-ink/25" />
        </a>
      </nav>

      <div className="flex items-center justify-between px-6 py-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] leading-tight text-ink/25">{APP_NAME}</p>
          <p className="truncate text-[11px] leading-tight text-ink/25">{APP_VERSION_LABEL}</p>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
