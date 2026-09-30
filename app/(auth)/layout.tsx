import { RootShell, rootMetadata, rootViewport } from "../_shell";

export const metadata = { ...rootMetadata, title: "Connexion" };
export const viewport = rootViewport;

/**
 * Root layout for the sign-in screen.
 *
 * `/connexion` is deliberately outside the dashboard's `(main)` group. `AppShell` renders nothing
 * until the browser has hydrated, and `StudyOptionGate` then shows the filière chooser to anyone
 * who has not picked one yet. Both would be wrong here: a visitor who follows a redirect out of PRV
 * has to be able to sign in immediately, without being asked to choose OCS, OCC or ORS first, and
 * without the dashboard sidebar wrapped around a login form.
 *
 * So this layout is the same bare document shell the PRV area uses, with no hydration gate. Nothing
 * below it needs the store, and the form itself is a client component that fetches its own state.
 */
export default function AuthRootLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
