"use client";

import Image from "next/image";
import { motion } from "framer-motion";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function HeroHeader() {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="relative overflow-hidden px-5 pb-6 pt-6 md:px-8 md:pt-8 lg:px-10">
      <motion.div
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium capitalize text-white/45"
          >
            {dateStr}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-1 font-display text-2xl font-bold"
          >
            {getGreeting()} <span className="shimmer-text">👋</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-0.5 text-sm text-white/55"
          >
            Voici l&apos;état de ta formation
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-black ring-1 ring-white/15 shadow-glow"
        >
          <Image src="/logo.jpg" alt="Logo" fill sizes="56px" className="object-cover" priority />
        </motion.div>
      </div>
    </div>
  );
}
