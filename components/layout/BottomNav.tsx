"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ShieldCheck, Layers, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/modules", label: "Modules", icon: ShieldCheck },
  { href: "/secondary", label: "EGTS", icon: Layers },
  { href: "/planning", label: "Planning", icon: CalendarClock },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass relative z-30 flex shrink-0 items-stretch justify-around border-t border-white/10 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV_ITEMS.map((item) => {
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
              className={cn("relative z-10 transition-colors", active ? "text-brand-400" : "text-white/45")}
              strokeWidth={active ? 2.3 : 1.9}
            />
            <span className={cn("relative z-10 transition-colors", active ? "text-brand-400" : "text-white/45")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
