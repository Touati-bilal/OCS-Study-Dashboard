import { PrvNav } from "@/components/prv/PrvNav";

/**
 * Outer shell for the whole `/prv` tree.
 *
 * It deliberately does *not* check the session: the unlock screen lives under `/prv` too and must
 * stay reachable. The authorisation check lives in `prv/(private)/layout.tsx`, which wraps only
 * the eight protected sections.
 *
 * The OCS-only rule lives there too, for the same reason: it guards private *data*, and on this
 * screen there is no data to guard. Running it here instead meant a visitor with no study option
 * saved yet - which is every first-time visitor, and exactly the person trying to sign in - was
 * redirected to the filière chooser instead of being able to enter the code.
 */
export const dynamic = "force-dynamic";

export default function PrvRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <PrvNav />
      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6 md:px-8 lg:px-10">{children}</main>
    </div>
  );
}
