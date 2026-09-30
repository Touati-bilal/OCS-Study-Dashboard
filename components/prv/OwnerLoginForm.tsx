"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Lock, LogIn } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FieldGroup, Input, Label } from "@/components/ui/Field";

/**
 * The owner sign-in form: username + email + password.
 *
 * The three values are posted to /api/prv/login and are never stored anywhere on the client. The
 * password field is a password input, is never mirrored into state that could be logged, and is
 * cleared as soon as the request resolves. Nothing typed here is ever rendered back into the page,
 * and the error text is the server's generic message, unchanged, so the form cannot be used to find
 * out which of the three fields was wrong.
 */
export function OwnerLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setMessage(null);
      setDetail(null);
      try {
        const response = await fetch("/api/prv/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const payload = await response.json().catch(() => ({}));

        // Do not keep the password around once the request is done.
        setPassword("");

        if (response.ok) {
          // Straight to the 4-digit code, which is the second gate.
          router.replace("/prv/deverrouiller");
          router.refresh();
          return;
        }
        setMessage(typeof payload?.error === "string" ? payload.error : "Connexion refusée.");
        if (typeof payload?.detail === "string") setDetail(payload.detail);
      } catch {
        setMessage("Connexion impossible pour le moment.");
      } finally {
        setBusy(false);
      }
    },
    [busy, email, password, router, username]
  );

  return (
    <form onSubmit={submit} className="space-y-1">
      <FieldGroup>
        <Label htmlFor="prv-username">Identifiant</Label>
        <Input
          id="prv-username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="prv-email">Adresse e-mail</Label>
        <Input
          id="prv-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="prv-password">Mot de passe</Label>
        <Input
          id="prv-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </FieldGroup>

      {message && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0">
            <p className="text-xs leading-relaxed text-ink/80">{message}</p>
            {detail && <p className="mt-1 text-[11px] leading-relaxed text-ink/50">{detail}</p>}
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Se connecter
      </Button>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink/40">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        La vérification se fait uniquement sur le serveur. Le mot de passe n&apos;est ni stocké en
        clair, ni conservé par le navigateur, ni renvoyé par l&apos;API : seul un hash scrypt est
        enregistré.
      </p>
    </form>
  );
}
