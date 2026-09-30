import { redirect } from "next/navigation";

import { PrvHydration } from "@/components/prv/PrvHydration";
import { PrvOcsGate } from "@/components/prv/PrvOcsGate";
import { hasPrvAccess, hasOwnerSession } from "@/lib/prv/guard.server";

/**
 * Server-side authorisation for the eight protected PRV sections.
 *
 * Two secrets stand in the way, and both are required here: the owner account (username + email +
 * password) and the 4-digit PRV code. The check runs in a server component, *before* any page markup
 * is produced, so a bookmarked or typed `/prv/...` URL without both sessions is redirected away and
 * no private data is rendered or streamed. Wrapping the sections in one route group means a newly
 * added PRV page is protected by default rather than by remembering to protect it, and the login and
 * code screens - which sit outside this group - stay reachable.
 *
 * The two are checked separately so the redirect lands on the step that is actually missing: no
 * account session goes to the login, a signed-in owner without the code goes to the code screen.
 *
 * The API routes are not covered here; each one performs its own check and returns a JSON 401.
 *
 * This check only works because the PRV tree is rendered on the server. It lives in a route group
 * whose root layout (`app/(prv)/layout.tsx`) contains no hydration gate, unlike the dashboard's
 * `AppShell`, which withholds `children` until the browser has hydrated. Anything placed under such
 * a gate is never server rendered, so an authorisation component there would be decorative.
 */
export const dynamic = "force-dynamic";

export default async function PrvPrivateLayout({ children }: { children: React.ReactNode }) {
  // Runs on the server for every request: a visit without both sessions is answered with a real 307
  // redirect, so no PRV markup, script payload or data ever leaves the server.
  if (!(await hasOwnerSession())) redirect("/connexion");
  if (!(await hasPrvAccess())) redirect("/prv/deverrouiller");
  // Defence in depth, and deliberately here rather than in the outer `/prv` layout: PRV is OCS-only,
  // so a browser whose store says OCC or ORS is sent back to its own dashboard. It guards the private
  // data these eight pages show, which is why the code screen - which shows no data and is exactly
  // where a first-time visitor has to be able to get to - is outside it.
  return (
    <>
      <PrvOcsGate />
      <PrvHydration>{children}</PrvHydration>
    </>
  );
}
