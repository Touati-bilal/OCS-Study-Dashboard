/**
 * The most recent real store snapshot, kept server-side for the weekly cron.
 *
 * The real study data lives in the browser's `localStorage`, which a server-side cron cannot read.
 * Rather than invent data for scheduled runs, the browser deposits its sanitised snapshot here
 * whenever the owner uses PRV, and the cron rebuilds the report from *that* - real numbers, just
 * as fresh as the last visit.
 *
 * The snapshot is sanitised before it is stored and carries no credentials, so holding it on the
 * server is no worse than holding the same data in the browser that produced it.
 */

import "server-only";

import { readSingleton, writeSingleton } from "./store.server";
import { emptySnapshot, type PrvSnapshot } from "./snapshot";

interface StoredSnapshot {
  snapshot: PrvSnapshot;
  storedAt: string;
}

export async function saveLatestSnapshot(snapshot: PrvSnapshot): Promise<void> {
  await writeSingleton<StoredSnapshot>("latest-snapshot", {
    snapshot,
    storedAt: new Date().toISOString(),
  });
}

/** Returns the stored snapshot, or `null` when the owner has never opened PRV. */
export function getLatestSnapshot(): { snapshot: PrvSnapshot; storedAt: string } | null {
  const stored = readSingleton<StoredSnapshot | null>("latest-snapshot", null);
  if (!stored || typeof stored !== "object" || !stored.snapshot) return null;
  return { snapshot: stored.snapshot, storedAt: stored.storedAt };
}

export { emptySnapshot };
