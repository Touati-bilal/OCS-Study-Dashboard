import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { OwnerLoginForm } from "@/components/prv/OwnerLoginForm";
import { hasOwnerSession, hasPrvSession } from "@/lib/prv/guard.server";

/**
 * The owner sign-in screen: the first of the two gates in front of PRV, and the first thing inside
 * the PRV area itself.
 *
 * It lives under `/prv` rather than at the root of the site: PRV has exactly one entry point and
 * everything behind it — the account form, the 4-digit code screen and the eight sections — now
 * sits in this one tree. Nothing outside `/prv` links here any more, so there is no PRV surface in
 * the OCS navigation, in a module page or in the OCS API.
 *
 * It is deliberately *outside* the `(private)` group, so the session check that guards the sections
 * does not apply to it: reaching the login must never require the very session it obtains. Its
 * parent layout (`app/(prv)/prv/layout.tsx`) runs no session check either, so a first-time visitor
 * gets the form instead of a redirect loop.
 *
 * It is a server component, so the redirect below is a real 307 decided before any markup exists.
 * No credential is rendered here, and the page deliberately shows no hint about which fields are
 * configured: that would tell an unauthenticated visitor how far the setup has been done.
 */
export const metadata: Metadata = {
  title: "Connexion — PRV",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PrvConnexionPage() {
  // Already signed in: send the owner to whichever step is still missing.
  if (await hasOwnerSession()) {
    redirect((await hasPrvSession()) ? "/prv" : "/prv/deverrouiller");
  }

  return (
    <div className="flex items-center justify-center py-6 md:py-14">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/10 bg-ink/[0.04]">
            <ShieldCheck className="h-6 w-6 text-teal-600 dark:text-teal-300" />
          </div>
          <h1 className="font-display text-xl font-semibold">Espace privé</h1>
          <p className="mt-1.5 text-sm text-ink/50">Connectez-vous pour continuer.</p>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
          <OwnerLoginForm />
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink/40">
          <KeyRound className="h-3 w-3" />
          Un code à 4 chiffres vous sera demandé ensuite.
        </p>
      </div>
    </div>
  );
}