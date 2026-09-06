"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  backHref,
  right,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  right?: React.ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/5 bg-base-950/80 px-5 py-4 backdrop-blur-md"
    >
      <div className="flex items-center gap-2 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-white/45">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </motion.header>
  );
}
