"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  delay = 0,
  hover = true,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; hover?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      whileHover={hover ? { y: -3, transition: { duration: 0.2 } } : undefined}
      className={cn("glass rounded-2xl shadow-card", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
