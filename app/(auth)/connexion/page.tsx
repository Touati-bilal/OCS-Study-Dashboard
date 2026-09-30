import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { OwnerLoginForm } from "@/components/prv/OwnerLoginForm";
import { hasOwnerSession, hasPrvSession } from "@/lib/prv/guard.server";

/**
 * The owner sign-in screen: the first of the two gates in front of PRV.
 *
 * It is a server component, so the redirect below is a real 307 decided before any markup exists.
 * This page lives in the dashboard's route group rather than the PRV one on purpose: reaching the
 * login must never require a PRV session, and the PRV tree is gated by exactly that.
 *
 * No credential is rendered here, and the page deliberately shows no hint about which fields are
 * configured: that would tell an unauthenticated visitor how far the setup has been done.
 */
export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  // Already signed in: send the owner to whichever step is still missing.
  if (await hasOwnerSession()) {
    redirect((await hasPrvSession()) ? "/prv" : "/prv/deverrouiller");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/10 bg-ink/[0.04]">
            <ShieldCheck className="h-6 w-6 text-brand-400" />
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
    </main>
  );
}
