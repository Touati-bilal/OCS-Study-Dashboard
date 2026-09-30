import { AppShell } from "@/components/layout/AppShell";
import { RootShell, rootMetadata, rootViewport } from "../_shell";

export const metadata = rootMetadata;
export const viewport = rootViewport;

/**
 * Root layout for the study dashboard itself (home, modules, planning, EGTS).
 *
 * `AppShell` intentionally renders nothing until hydration, because the sidebar, bottom nav and
 * store-driven content all read `localStorage`. That is fine here: these pages have no private
 * server state to protect.
 */
export default function MainRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell>
      <AppShell>{children}</AppShell>
    </RootShell>
  );
}
