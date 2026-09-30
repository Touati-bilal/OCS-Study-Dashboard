import { RootShell, rootMetadata, rootViewport } from "../_shell";

export const metadata = { ...rootMetadata, title: "PRV — OCS Study Dashboard" };
export const viewport = rootViewport;

/**
 * Root layout for the whole PRV area.
 *
 * This layout is deliberately empty of any hydration gate, unlike `AppShell`. A client component
 * that withholds `children` until `useEffect` has run prevents *every* server component below it
 * from executing, which would silently turn the session check in `prv/(private)/layout.tsx` into a
 * no-op. Because the PRV tree is rendered on the server, that check can redirect a request for
 * `/prv/...` before a single byte of markup - let alone private data - is produced.
 *
 * The hydration spinner lives *inside* the gated subtree instead (see `PrvHydration`), so the
 * pages can still read the persisted store without React complaining about a mismatched tree.
 */
export default function PrvRootLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
