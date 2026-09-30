"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useHydrated } from "@/hooks/useHydrated";
import { useAppStore } from "@/store/useAppStore";

/**
 * Defence in depth: PRV is an OCS-only area.
 *
 * The session check in `app/(prv)/prv/(private)/layout.tsx` is the real authorisation and runs on
 * the server. This adds the study-option rule, which the server cannot enforce: `studyOption` lives
 * in `localStorage` and never leaves the browser.
 *
 * The rule is strict - only `OCS` is allowed. Someone who picked OCC or ORS is sent back to their
 * own dashboard, and someone who has not finished onboarding is sent to onboarding rather than
 * shown a PRV that has no OCS data to report on.
 *
 * Note what this is *not*: a way to reach OCS data from another exam. A session alone does not
 * carry any study data; every number on a PRV page arrives from `collectSnapshot()`, which keeps
 * only OCS module tasks. Someone holding the code could of course post a hand-built payload, so the
 * server treats the snapshot as untrusted input and sanitises it.
 *
 * It renders nothing, so it never delays or blocks a page.
 */
export function PrvOcsGate() {
  const hydrated = useHydrated();
  const studyOption = useAppStore((state) => state.studyOption);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (studyOption !== "OCS") router.replace("/");
  }, [hydrated, studyOption, router]);

  return null;
}
