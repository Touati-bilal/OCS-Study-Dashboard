"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-glow",
  secondary: "bg-ink/[0.07] text-ink hover:bg-ink/[0.12] border border-ink/10",
  ghost: "bg-transparent text-ink/70 hover:text-ink hover:bg-ink/[0.06]",
  danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30",
};

export function Button({
  children,
  variant = "primary",
  className,
  size = "md",
  ...rest
}: HTMLMotionProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
