import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Shown by the file sections when `/api/uploads` or `/api/module-files` answers 401.
 *
 * Those routes read and write the owner's documents on the server, so they require the signed-in
 * account. This line exists so the section explains itself instead of showing an empty list with no
 * reason, and so the way in is one click away.
 */
export function SignInToManageFiles() {
  return (
    <p className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2 text-[11px] text-ink/50">
      <Lock size={12} className="shrink-0 text-ink/30" />
      <span>
        Connectez-vous pour importer ou supprimer des fichiers.{" "}
        <Link href="/connexion" className="font-medium text-brand-400 underline underline-offset-2">
          Se connecter
        </Link>
      </span>
    </p>
  );
}
