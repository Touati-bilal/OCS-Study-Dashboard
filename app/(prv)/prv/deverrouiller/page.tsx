"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label } from "@/components/ui/Field";

/**
 * The PRV unlock screen: the second of two gates, entered only after the owner account is signed in
 * at /connexion. The 4-digit code is checked server-side against a peppered scrypt hash; it is never
 * stored in plaintext, never logged and never sent back to the browser.
 *
 * Nothing here reveals whether a digit was correct or how many attempts are left: the server
 * answers with one generic message for a wrong code, a lockout and a misconfiguration alike, and
 * this screen shows that message unchanged. The only distinction it surfaces is "not configured",
 * which the owner needs in order to know they need to set an environment variable - it carries no
 * information about the code itself.
 */
type Phase = "checking" | "unconfigured" | "ready" | "locked";

function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [phrase, setPhrase] = useState("");

  const destination = searchParams.get("suite");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prv/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((status) => {
        if (cancelled) return;
        if (status.authenticated) {
          // Already unlocked (for instance after a refresh): go straight in.
          router.replace(destination && destination.startsWith("/prv") ? destination : "/prv");
          return;
        }
        // The code is the second gate: without the account session there is nothing to unlock.
        if (!status.ownerAuthenticated) {
          router.replace(destination && destination.startsWith("/prv") ? `${destination}?suite=${encodeURIComponent(destination)}` : "/connexion");
          return;
        }
        if (!status.configured) {
          setPhase("unconfigured");
          return;
        }
        setPhase(status.locked ? "locked" : "ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [destination, router]);

  const enter = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/prv/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        router.replace(destination && destination.startsWith("/prv") ? destination : "/prv");
        router.refresh();
        return;
      }
      if (response.status === 503) {
        setPhase("unconfigured");
        return;
      }
      if (response.status === 423) {
        setPhase("locked");
        setMessage(payload.locked ? "Trop d'essais. PRV est temporairement verrouillé." : message);
        return;
      }
      // Wrong code, or an expired lock: same wording either way.
      setMessage(payload.error ?? "Accès PRV refusé.");
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
      setCode("");
    }
  }, [busy, code, destination, message, router]);

  const recover = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/prv/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        router.replace("/prv");
        router.refresh();
        return;
      }
      setMessage(payload.error ?? "Accès PRV refusé.");
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
      setPhrase("");
    }
  }, [busy, phrase, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass w-full max-w-sm rounded-2xl p-6 shadow-card"
      >
        <div className="mb-5 flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-ink">Espace privé PRV</h1>
            <p className="text-xs text-ink/55">Accès réservé OCS</p>
          </div>
        </div>

        {phase === "checking" && (
          <div className="flex items-center gap-2 text-sm text-ink/55">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
          </div>
        )}

        {phase === "unconfigured" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <p className="text-xs leading-relaxed text-ink/80">
                PRV n&apos;est pas encore configuré sur ce serveur. Lancez{" "}
                <code className="rounded bg-ink/10 px-1 py-0.5 text-[11px]">npm run prv:setup</code>{" "}
                pour définir le compte et le code à 4 chiffres, puis relancez l&apos;application.
                Seul un hash est enregistré : aucun secret n&apos;est stocké en clair.
              </p>
            </div>
            <p className="text-xs text-ink/50">Voir <code className="rounded bg-ink/10 px-1">.env.example</code>.</p>
          </div>
        )}

        {phase !== "checking" && phase !== "unconfigured" && (
          <div className="space-y-4">
            {phase === "locked" && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-ink/80">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <span>
                  Trop de tentatives. Le code est temporairement désactivé. Utilisez la phrase de
                  récupération ci-dessous, ou attendez la fin du verrouillage.
                </span>
              </div>
            )}

            {showRecovery ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void recover();
                }}
                className="space-y-3"
              >
                <FieldGroup>
                  <Label>Phrase de récupération</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={phrase}
                    onChange={(event) => setPhrase(event.target.value)}
                    placeholder="••••"
                  />
                </FieldGroup>
                <p className="text-[11px] leading-relaxed text-ink/50">
                  Elle est vérifiée côté serveur, jamais stockée en clair, et sert aussi à lever un
                  verrouillage.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy || phrase.length === 0} className="flex-1">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Récupérer l&apos;accès
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowRecovery(false)}>
                    Retour
                  </Button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void enter();
                }}
                className="space-y-3"
              >
                <FieldGroup>
                  <Label>Code à 4 chiffres</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="text-center text-lg tracking-[0.5em]"
                  />
                  <p className="mt-1.5 text-[11px] text-ink/45">
                    Trois essais de suite, puis verrouillage temporaire.
                  </p>
                </FieldGroup>
                <Button type="submit" disabled={busy || code.length !== 4} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Déverrouiller
                </Button>
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="w-full text-[11px] text-ink/50 underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  J&apos;ai oublié le code
                </button>
              </form>
            )}

            {message && (
              <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5 text-xs text-ink/80">
                {message}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper">
          <Loader2 className="h-5 w-5 animate-spin text-ink/30" />
        </div>
      }
    >
      <UnlockForm />
    </Suspense>
  );
}
