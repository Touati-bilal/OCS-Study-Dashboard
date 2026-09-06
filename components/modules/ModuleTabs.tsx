"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
}

export function ModuleTabs({
  tabs,
  active,
  onChange,
  color,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  color: string;
}) {
  return (
    <div className="no-scrollbar sticky top-[65px] z-10 flex gap-1 overflow-x-auto border-b border-white/5 bg-base-950/90 px-5 py-2 backdrop-blur-md">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              isActive ? "text-white" : "text-white/45 hover:text-white/70"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="module-tab-pill"
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: color + "26" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
