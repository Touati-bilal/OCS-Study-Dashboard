/**
 * File-based private store for PRV.
 *
 * PRV data (access-code counters, generated reports and PDFs, push subscriptions, "À revoir"
 * items, settings) lives in a gitignored directory on the server. Nothing here is ever served
 * without going through an authorised route first.
 *
 * Writes are atomic (temp file + rename) and serialised per collection so a concurrent request
 * cannot interleave a read-modify-write and lose data.
 */
import "server-only";

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.PRV_DATA_DIR?.trim() || path.join(process.cwd(), ".prv-data");

/** Every collection the PRV area uses. Keeps the directory contents predictable. */
export const PRV_COLLECTIONS = [
  "auth-state",
  "reports",
  "review-items",
  "push-subscriptions",
  "notifications",
  "settings",
  "latest-snapshot",
] as const;

export type PrvCollection = (typeof PRV_COLLECTIONS)[number];

function ensureDir(): string {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  return DATA_DIR;
}

function filePathFor(collection: PrvCollection): string {
  return path.join(ensureDir(), `${collection}.json`);
}

/** One in-process lock per collection; requests queue instead of racing. */
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  // Run after the previous holder settles, and keep the chain alive either way.
  const result = previous.then(fn, fn);
  const tail = result.then(
    () => undefined,
    () => undefined
  );
  locks.set(key, tail);
  try {
    return await result;
  } finally {
    // Only the last waiter clears the entry, so a queued writer is never dropped.
    if (locks.get(key) === tail) locks.delete(key);
  }
}

export function readCollection<T>(collection: PrvCollection): T[] {
  const file = filePathFor(collection);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // A corrupted file must not take the whole PRV area down; it starts empty instead.
    return [];
  }
}

export function writeCollection<T>(collection: PrvCollection, items: T[]): void {
  const file = filePathFor(collection);
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(items, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}

/** Read-modify-write under the collection lock. The callback must be pure. */
export async function updateCollection<T>(
  collection: PrvCollection,
  updater: (current: T[]) => T[]
): Promise<T[]> {
  return withLock(collection, () => {
    const next = updater(readCollection<T>(collection));
    writeCollection(collection, next);
    return next;
  });
}

export function readSingleton<T>(collection: PrvCollection, fallback: T): T {
  const items = readCollection<T>(collection);
  return items.length > 0 ? items[0] : fallback;
}

export async function writeSingleton<T>(collection: PrvCollection, value: T): Promise<T> {
  await updateCollection<T>(collection, () => [value]);
  return value;
}

/** Opaque, unguessable identifier used for private download URLs (never a bare week number). */
export function newOpaqueId(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

export function getPrvDataDir(): string {
  return DATA_DIR;
}
