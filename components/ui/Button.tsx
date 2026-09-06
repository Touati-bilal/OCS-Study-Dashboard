"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-glow",
  secondary: "bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/10",
  ghost: "bg-transparent text-white/70 hover:text-white hover:bg-white/[0.06]",
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
