"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import type { StudyOption } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OptionDef {
  code: StudyOption;
  title: string;
  description: string;
  accent: string;
  glow: string;
}

const OPTIONS: OptionDef[] = [
  {
    code: "OCS",
    title: "Cybersecurity",
    description: "Sécurité offensive, défensive et gestion des risques.",
    accent: "#48a3ff",
    glow: "rgba(72,163,255,0.18)",
  },
  {
    code: "OCC",
    title: "Cloud Computing",
    description: "Infrastructures, virtualisation et services cloud.",
    accent: "#2dd4bf",
    glow: "rgba(45,212,191,0.18)",
  },
  {
    code: "ORS",
    title: "Réseaux & Systèmes",
    description: "Administration réseaux, systèmes et infrastructures.",
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.18)",
  },
];

const WELCOME_MESSAGE = "Bilal kaytmenalkom sana dirasiya mewefa9a. Ila htajito ay haja, mrhba.";

/**
 * Gates the app on first visit behind a study-option selection, then shows a one-time
 * welcome message before handing off to the existing app. Renders nothing (lets the
 * caller render the real app) once an option is already saved and acknowledged.
 */
export function StudyOptionGate({ children }: { children: React.ReactNode }) {
  const studyOption = useAppStore((s) => s.studyOption);
  const setStudyOption = useAppStore((s) => s.setStudyOption);
  const [pendingWelcome, setPendingWelcome] = useState(false);

  if (!studyOption) {
    return (
      <SelectScreen
        onSelect={(code) => {
          setStudyOption(code);
          setPendingWelcome(true);
        }}
      />
    );
  }

  if (pendingWelcome) {
    return <WelcomeScreen onContinue={() => setPendingWelcome(false)} />;
  }

  return <>{children}</>;
}

function ScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-y-auto bg-paper px-5 py-10 md:h-screen">
      <div className="pointer-events-none fixed inset-0 bg-grid-glow" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}

function SelectScreen({ onSelect }: { onSelect: (code: StudyOption) => void }) {
  return (
    <ScreenFrame>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass rounded-3xl p-6 shadow-card md:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-black ring-1 ring-ink/15 shadow-glow">
            <Image src="/logo.jpg" alt="Logo" fill sizes="56px" className="object-cover" priority />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-ink">Choisis ta filière</h1>
          <p className="mt-1.5 text-sm text-ink/55">
            Le tableau de bord s&apos;adapte à ta filière d&apos;études.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 * i, ease: "easeOut" }}
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -2 }}
              onClick={() => onSelect(opt.code)}
              className="group flex items-center gap-4 rounded-2xl border border-ink/10 bg-ink/[0.04] p-4 text-left transition-colors hover:bg-ink/[0.08]"
              style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02)` }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                style={{ backgroundColor: opt.glow, color: opt.accent }}
              >
                {opt.code}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-ink">
                  {opt.code} — {opt.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink/50">{opt.description}</p>
              </div>
              <div
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full transition-transform group-hover:scale-125"
                )}
                style={{ backgroundColor: opt.accent }}
              />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </ScreenFrame>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <ScreenFrame>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="glass flex flex-col items-center rounded-3xl p-6 text-center shadow-card md:p-8"
        >
          <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-black ring-1 ring-ink/15 shadow-glow">
            <Image src="/logo.jpg" alt="Logo" fill sizes="56px" className="object-cover" priority />
          </div>
          <p className="mt-5 text-balance text-base leading-relaxed text-ink/90">{WELCOME_MESSAGE}</p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={onContinue}
            className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-colors hover:bg-brand-600"
          >
            Continuer
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </ScreenFrame>
  );
}
