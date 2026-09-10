"use client";

import { Moon, Sun } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const isBlack = theme === "black";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isBlack ? "Passer au thème blanc" : "Passer au thème noir"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors hover:bg-ink/[0.08] hover:text-ink",
        className
      )}
    >
      {isBlack ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
