/**
 * Application metadata — single source of truth for the version.
 *
 * Version format (permanent, do not change without an explicit request):
 *
 *   V<MAJOR>.<MONTH>-<UPDATE>        e.g. V1.09-01
 *
 *   MAJOR   project phase/generation (V1, V2, ...) — only changed when a new major
 *           phase is explicitly decided, never automatically.
 *   MONTH   two digits, 01-12 (01 = January ... 12 = December).
 *   UPDATE  two digits, 01-10, the update counter within that month.
 *
 * Increment rules for a new update: keep MAJOR, use the current month, and raise
 * UPDATE (reset to 01 when the month changes). Never use semver or dates here.
 */
export const APP_NAME = "OCS Study Dashboard";

export const APP_VERSION = "V1.09-01";

export const APP_VERSION_LABEL = `Version ${APP_VERSION}`;
