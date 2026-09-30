"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ShieldCheck, Layers, CalendarClock, LifeBuoy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_URL } from "@/lib/help";
import { useAppStore } from "@/store/useAppStore";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: LayoutDashboard, ocsOnly: false },
  { href: "/modules", label: "Modules", icon: ShieldCheck, ocsOnly: false },
  { href: "/secondary", label: "EGTS", icon: Layers, ocsOnly: false },
  { href: "/planning", label: "Planning", icon: CalendarClock, ocsOnly: false },
  // OCS-only; the server re-checks the PRV session on every /prv page.
  { href: "/prv", label: "PRV", icon: Lock, ocsOnly: true },
];

const HELP_ITEM = { href: HELP_URL, label: "Help", icon: LifeBuoy };

export function BottomNav() {
  const pathname = usePathname();
  const studyOption = useAppStore((s) => s.studyOption);
  const items = NAV_ITEMS.filter((item) => !item.ocsOnly || studyOption === "OCS");

  return (
    <nav className="glass relative z-30 flex shrink-0 items-stretch justify-around border-t border-ink/10 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium"
          >
            {active && (
              <motion.div
                layoutId="nav-pill"
                className="absolute top-0.5 h-9 w-9 rounded-full bg-brand-500/15"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Icon
              size={20}
              className={cn("relative z-10 transition-colors", active ? "text-brand-400" : "text-ink/45")}
              strokeWidth={active ? 2.3 : 1.9}
            />
            <span className={cn("relative z-10 transition-colors", active ? "text-brand-400" : "text-ink/45")}>
              {item.label}
            </span>
          </Link>
        );
      })}

      <a
        href={HELP_ITEM.href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium"
      >
        <HELP_ITEM.icon
          size={20}
          className="relative z-10 text-ink/45"
          strokeWidth={1.9}
        />
        <span className="relative z-10 text-ink/45">Help</span>
      </a>
    </nav>
  );
}
