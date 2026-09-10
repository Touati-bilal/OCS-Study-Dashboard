"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ShieldCheck, Layers, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/modules", label: "Modules", icon: ShieldCheck },
  { href: "/secondary", label: "EGTS", icon: Layers },
  { href: "/planning", label: "Planning", icon: CalendarClock },
];

export function Sidebar() {
  const pathname = usePathname();

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
        {NAV_ITEMS.map((item) => {
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
      </nav>

      <div className="flex items-center justify-between px-6 py-5">
        <span className="text-[11px] text-ink/25">OCS Study Dashboard</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
