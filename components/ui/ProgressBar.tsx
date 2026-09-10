"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  color = "#48a3ff",
  height = 8,
  className,
  showShimmer = true,
}: {
  value: number;
  color?: string;
  height?: number;
  className?: string;
  showShimmer?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-ink/[0.06]", className)}
      style={{ height }}
    >
      <motion.div
        className="relative h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        {showShimmer && clamped > 0 && (
          <div
            className="absolute inset-0 animate-shimmer opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              backgroundSize: "200% 100%",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
